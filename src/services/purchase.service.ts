import "server-only";

import { BusinessRuleError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { withTransaction, type Tx } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { toMoney } from "@/lib/utils/money";
import { nextDocumentNumber } from "@/lib/utils/sequence";
import { accountingService } from "@/services/accounting.service";
import { inventoryRepository } from "@/repositories/inventory.repository";
import { purchaseRepository } from "@/repositories/purchase.repository";
import type { AuthorizedContext } from "@/lib/permissions/authorize";
import type {
  CreatePurchaseInput,
  ReceivePurchaseInput,
} from "@/schema/purchase.schema";

const ACC_INVENTORY = "1-1300";
const ACC_AP = "2-1000"; // Utang Usaha

async function getBranch(tx: Tx, branchId: string) {
  const branch = await tx.branch.findUnique({
    where: { id: branchId },
    select: { id: true, code: true },
  });
  if (!branch) throw new NotFoundError("Cabang");
  return branch;
}

export const purchaseService = {
  /** DRAFT (default) — jika input.status ORDERED langsung, tetap lewat create. */
  async create(
    ctx: AuthorizedContext,
    input: CreatePurchaseInput,
    orderNow = false,
  ) {
    return withTransaction(async (tx) => {
      const supplier = await tx.supplier.findFirst({
        where: { id: input.supplierId, status: "ACTIVE" },
      });
      if (!supplier) throw new NotFoundError("Supplier");

      // Produk aktif & duplikat check
      const ids = input.items.map((i) => i.productId);
      if (new Set(ids).size !== ids.length) {
        throw new BusinessRuleError("DUPLICATE_PRODUCT", "Ada produk duplikat");
      }
      const products = await tx.product.findMany({
        where: { id: { in: ids } },
      });
      if (products.length !== ids.length) throw new NotFoundError("Produk");

      const branch = await getBranch(tx, ctx.branchId);
      const purchaseNumber = await nextDocumentNumber(tx, branch, "PUR");

      const purchase = await tx.purchase.create({
        data: {
          purchaseNumber,
          branchId: ctx.branchId,
          supplierId: input.supplierId,
          createdById: ctx.userId,
          status: orderNow ? "ORDERED" : "DRAFT",
          note: input.note || null,
          orderedAt: orderNow ? new Date() : null,
          items: {
            create: input.items.map((i) => {
              const unitCost = toMoney(i.unitCost);
              return {
                productId: i.productId,
                quantity: toMoney(i.qty),
                unitCost,
                subtotal: unitCost.mul(toMoney(i.qty)),
              };
            }),
          },
        },
        include: { items: true },
      });

      await writeAudit(
        tx,
        ctx,
        "PURCHASE_CREATE",
        "Purchase",
        purchase.id,
        null,
        {
          purchaseNumber,
          supplier: supplier.name,
          items: input.items.length,
          ordered: orderNow,
        },
      );
      return purchase;
    });
  },

  /** DRAFT → ORDERED. Guard atomic. Tanpa dampak stok/jurnal (D41/D44). */
  async order(ctx: AuthorizedContext, purchaseId: string) {
    return withTransaction(async (tx) => {
      const purchase = await purchaseRepository.findById(purchaseId);
      if (!purchase) throw new NotFoundError("Pembelian");
      if (purchase.branchId !== ctx.branchId && !ctx.isSuperAdmin) {
        throw new ForbiddenError("purchase.update");
      }

      const claimed = await tx.purchase.updateMany({
        where: { id: purchaseId, status: "DRAFT" },
        data: { status: "ORDERED", orderedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new BusinessRuleError(
          "ALREADY_PROCESSED",
          "Hanya DRAFT yang bisa dipesan",
        );
      }

      await writeAudit(
        tx,
        ctx,
        "PURCHASE_ORDER",
        "Purchase",
        purchaseId,
        { status: "DRAFT" },
        { status: "ORDERED" },
      );
    });
  },

  /**
   * RECEIVE (parsial didukung, D39): stok +, movement PURCHASE,
   * jurnal Dr Persediaan / Cr Utang (nilai diterima), Payable upsert (D42).
   * State machine: ORDERED/PARTIAL → (PARTIAL|RECEIVED).
   */
  async receive(ctx: AuthorizedContext, input: ReceivePurchaseInput) {
    return withTransaction(async (tx) => {
      const purchase = await purchaseRepository.findById(input.id);
      if (!purchase) throw new NotFoundError("Pembelian");
      if (purchase.branchId !== ctx.branchId && !ctx.isSuperAdmin) {
        throw new ForbiddenError("purchase.receive");
      }
      if (purchase.status !== "ORDERED" && purchase.status !== "PARTIAL") {
        throw new BusinessRuleError(
          "INVALID_STATE",
          `Status ${purchase.status} tidak bisa menerima barang`,
        );
      }

      const itemsById = new Map(purchase.items.map((i) => [i.id, i]));
      const branch = await getBranch(tx, purchase.branchId);

      // Validasi semua qty dulu — satu invalid, batal semuanya (atomik)
      const toReceive: Array<{
        itemId: string;
        productId: string;
        qty: ReturnType<typeof toMoney>;
        unitCost: ReturnType<typeof toMoney>;
        sku: string;
      }> = [];
      for (const reqItem of input.items) {
        const item = itemsById.get(reqItem.itemId);
        if (!item) throw new NotFoundError("Item pembelian");

        const qty = toMoney(reqItem.qty);
        if (qty.lte(0)) {
          throw new BusinessRuleError(
            "INVALID_QTY",
            `Qty ${item.product.sku} harus > 0`,
          );
        }
        const remaining = item.quantity.minus(item.quantityReceived);
        if (qty.gt(remaining)) {
          throw new BusinessRuleError(
            "OVER_RECEIVE",
            `${item.product.sku}: sisa belum diterima ${remaining}, diminta ${qty}`,
          );
        }
        toReceive.push({
          itemId: item.id,
          productId: item.productId,
          qty,
          unitCost: item.unitCost,
          sku: item.product.sku,
        });
      }

      // Terapkan: stok + movement + update item
      let receivedValue = toMoney(0);
      for (const r of toReceive) {
        await inventoryRepository.incrementOrCreate(
          tx,
          r.productId,
          purchase.branchId,
          r.qty,
        );
        await tx.stockMovement.create({
          data: {
            productId: r.productId,
            branchId: purchase.branchId,
            quantity: r.qty,
            type: "PURCHASE",
            referenceType: "Purchase",
            referenceId: purchase.id,
            unitCost: r.unitCost,
            note: purchase.purchaseNumber,
            userId: ctx.userId,
          },
        });
        await tx.purchaseItem.update({
          where: { id: r.itemId },
          data: { quantityReceived: { increment: r.qty } },
        });
        receivedValue = receivedValue.plus(r.qty.mul(r.unitCost));
      }

      // Status: RECEIVED jika semua item penuh
      const fresh = await tx.purchaseItem.findMany({
        where: { purchaseId: purchase.id },
      });
      const allDone = fresh.every((i) => i.quantityReceived.gte(i.quantity));
      const newStatus = allDone ? "RECEIVED" : "PARTIAL";

      const claimed = await tx.purchase.updateMany({
        where: {
          id: purchase.id,
          status: { in: ["ORDERED", "PARTIAL"] },
        },
        data: {
          status: newStatus,
          receivedAt: allDone ? new Date() : null,
        },
      });
      if (claimed.count === 0) {
        throw new BusinessRuleError(
          "ALREADY_PROCESSED",
          "Pembelian sudah diproses concurrent",
        );
      }

      // Jurnal: Dr Persediaan / Cr Utang Usaha (D41) — nilai diterima
      await accountingService.createPostedJournal(tx, branch, {
        memo: `Penerimaan ${purchase.purchaseNumber}${allDone ? "" : " (parsial)"}`,
        sourceType: "PURCHASE_RECEIVE",
        sourceId: purchase.id,
        lines: [
          { accountCode: ACC_INVENTORY, debit: receivedValue },
          { accountCode: ACC_AP, credit: receivedValue },
        ],
      });

      // Payable upsert (D42)
      await tx.payable.upsert({
        where: { purchaseId: purchase.id },
        create: {
          purchaseId: purchase.id,
          branchId: purchase.branchId,
          supplierId: purchase.supplierId,
          amount: receivedValue,
          status: "UNPAID",
        },
        update: { amount: { increment: receivedValue } },
      });

      await writeAudit(
        tx,
        ctx,
        "PURCHASE_RECEIVE",
        "Purchase",
        purchase.id,
        null,
        {
          receivedValue: receivedValue.toFixed(2),
          items: toReceive.length,
          newStatus,
        },
      );
    });
  },

  /** CANCEL: hanya DRAFT/ORDERED tanpa penerimaan (D44). Tanpa restock/jurnal. */
  async cancel(ctx: AuthorizedContext, purchaseId: string) {
    return withTransaction(async (tx) => {
      const purchase = await purchaseRepository.findById(purchaseId);
      if (!purchase) throw new NotFoundError("Pembelian");
      if (purchase.branchId !== ctx.branchId && !ctx.isSuperAdmin) {
        throw new ForbiddenError("purchase.cancel");
      }

      const hasReceived = purchase.items.some((i) => i.quantityReceived.gt(0));
      if (hasReceived) {
        throw new BusinessRuleError(
          "HAS_RECEIPT",
          "Sudah ada penerimaan barang — gunakan retur beli (Phase 6)",
        );
      }

      const claimed = await tx.purchase.updateMany({
        where: { id: purchaseId, status: { in: ["DRAFT", "ORDERED"] } },
        data: { status: "CANCELLED" },
      });
      if (claimed.count === 0) {
        throw new BusinessRuleError(
          "ALREADY_PROCESSED",
          "Pembelian sudah diproses",
        );
      }

      await writeAudit(
        tx,
        ctx,
        "PURCHASE_CANCEL",
        "Purchase",
        purchaseId,
        { status: purchase.status },
        { status: "CANCELLED" },
      );
    });
  },

  findById: purchaseRepository.findById,
  list: purchaseRepository.list,
};
