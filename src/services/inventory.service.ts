import "server-only";

import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";
import { withTransaction, type Tx } from "@/lib/db";
import { writeAudit, type AuditContext } from "@/lib/audit";
import { toMoney } from "@/lib/utils/money";
import { nextDocumentNumber } from "@/lib/utils/sequence";
import { accountingService } from "@/services/accounting.service";
import { inventoryRepository } from "@/repositories/inventory.repository";
import prisma from "@/lib/db";
import type { AuthorizedContext } from "@/lib/permissions/authorize";
import type {
  InitializeStockInput,
  AdjustStockInput,
  StockOverviewParams,
  MovementListParams,
  CreateTransferInput,
  CreateOpnameInput,
  CompleteOpnameInput,
} from "@/schema/inventory.schema";

const INVENTORY_ACCOUNT = "1-1300"; // Persediaan Barang
const STOCK_DIFF_ACCOUNT = "5-9000"; // Selisih Persediaan

export const inventoryService = {
  /** D19: hanya jika belum ada row stok. Setelah itu → adjust. */
  async initializeStock(ctx: AuthorizedContext, input: InitializeStockInput) {
    return withTransaction(async (tx) => {
      const qty = toMoney(input.qty);
      if (qty.lte(0))
        throw new BusinessRuleError(
          "INVALID_QTY",
          "Kuantitas harus lebih dari 0",
        );

      const product = await this.getActiveProduct(tx, input.productId);

      const existing = await tx.productStock.findUnique({
        where: {
          productId_branchId: {
            productId: input.productId,
            branchId: ctx.branchId,
          },
        },
      });
      if (existing) {
        throw new ConflictError(
          "Stok awal sudah pernah di-set. Gunakan Penyesuaian Stok.",
        );
      }

      await tx.productStock.create({
        data: {
          productId: input.productId,
          branchId: ctx.branchId,
          quantity: qty,
        },
      });

      await tx.stockMovement.create({
        data: {
          productId: input.productId,
          branchId: ctx.branchId,
          quantity: qty,
          type: "INITIAL_STOCK",
          unitCost: product.purchasePrice,
          note: input.note || null,
          userId: ctx.userId,
        },
      });

      // Jurnal: Dr Persediaan / Cr Selisih Persediaan (modal awal)
      const branch = await this.getBranch(tx, ctx.branchId);
      const value = qty.mul(product.purchasePrice);
      await accountingService.createPostedJournal(tx, branch, {
        memo: `Stok awal ${product.sku} — ${product.name}`,
        sourceType: "STOCK_INIT",
        sourceId: input.productId,
        lines: [
          { accountCode: INVENTORY_ACCOUNT, debit: value },
          { accountCode: STOCK_DIFF_ACCOUNT, credit: value },
        ],
      });

      await writeAudit(
        tx,
        ctx,
        "STOCK_INITIALIZE",
        "ProductStock",
        `${input.productId}:${ctx.branchId}`,
        null,
        { qty: qty.toFixed(3), note: input.note },
      );
    });
  },

  /** D20: note wajib. OUT → atomic conditional decrement (anti-minus). */
  async adjust(ctx: AuthorizedContext, input: AdjustStockInput) {
    return withTransaction(async (tx) => {
      const qty = toMoney(input.qty);
      if (qty.lte(0))
        throw new BusinessRuleError(
          "INVALID_QTY",
          "Kuantitas harus lebih dari 0",
        );

      const product = await this.getActiveProduct(tx, input.productId);

      if (input.direction === "OUT") {
        const res = await inventoryRepository.decrementIfEnough(
          tx,
          input.productId,
          ctx.branchId,
          qty,
        );
        if (res.count === 0) {
          const stock = await inventoryRepository.getStock(
            input.productId,
            ctx.branchId,
          );
          throw new BusinessRuleError(
            "INSUFFICIENT_STOCK",
            `Stok tidak cukup (tersedia ${stock?.quantity ?? 0})`,
          );
        }
      } else {
        await inventoryRepository.incrementOrCreate(
          tx,
          input.productId,
          ctx.branchId,
          qty,
        );
      }

      await tx.stockMovement.create({
        data: {
          productId: input.productId,
          branchId: ctx.branchId,
          quantity: input.direction === "IN" ? qty : qty.neg(),
          type: input.direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
          unitCost: product.purchasePrice,
          note: input.note,
          userId: ctx.userId,
        },
      });

      // Jurnal: IN → Dr Persediaan / Cr Selisih · OUT → Dr Selisih / Cr Persediaan
      const branch = await this.getBranch(tx, ctx.branchId);
      const value = qty.mul(product.purchasePrice);
      await accountingService.createPostedJournal(tx, branch, {
        memo: `Penyesuaian stok ${input.direction === "IN" ? "masuk" : "keluar"} ${product.sku}: ${input.note}`,
        sourceType: "STOCK_ADJUSTMENT",
        sourceId: input.productId,
        lines:
          input.direction === "IN"
            ? [
                { accountCode: INVENTORY_ACCOUNT, debit: value },
                { accountCode: STOCK_DIFF_ACCOUNT, credit: value },
              ]
            : [
                { accountCode: STOCK_DIFF_ACCOUNT, debit: value },
                { accountCode: INVENTORY_ACCOUNT, credit: value },
              ],
      });

      await writeAudit(
        tx,
        ctx,
        "STOCK_ADJUSTMENT",
        "ProductStock",
        `${input.productId}:${ctx.branchId}`,
        null,
        { direction: input.direction, qty: qty.toFixed(3), note: input.note },
      );
    });
  },

  async getBranch(
    tx:
      Parameters<Parameters<typeof prisma.$transaction>[0]>[0] | typeof prisma,
    branchId: string,
  ) {
    const branch = await tx.branch.findUnique({
      where: { id: branchId },
      select: { id: true, code: true },
    });
    if (!branch) throw new NotFoundError("Cabang");
    return branch;
  },

  async getActiveProduct(
    tx:
      Parameters<Parameters<typeof prisma.$transaction>[0]>[0] | typeof prisma,
    productId: string,
  ) {
    const product = await tx.product.findFirst({
      where: { id: productId, status: "ACTIVE" },
    });
    if (!product) throw new NotFoundError("Produk");
    return product;
  },

  // ================== TRANSFER ==================

  /** Kirim: stok origin berkurang SEKARANG (atomic), status IN_TRANSIT. Tanpa jurnal (D24). */
  async sendTransfer(ctx: AuthorizedContext, input: CreateTransferInput) {
    return withTransaction(async (tx) => {
      if (input.toBranchId === ctx.branchId) {
        throw new BusinessRuleError(
          "SAME_BRANCH",
          "Cabang tujuan sama dengan cabang aktif",
        );
      }
      const toBranch = await tx.branch.findFirst({
        where: { id: input.toBranchId, isActive: true },
      });
      if (!toBranch) throw new NotFoundError("Cabang tujuan");

      // Dedupe productId
      const seen = new Set<string>();
      for (const item of input.items) {
        if (seen.has(item.productId)) {
          throw new BusinessRuleError(
            "DUPLICATE_PRODUCT",
            "Ada produk duplikat di daftar",
          );
        }
        seen.add(item.productId);
      }

      const origin = await this.getBranch(tx, ctx.branchId);
      const transferNumber = await nextDocumentNumber(tx, origin, "TRF");

      const transfer = await tx.stockTransfer.create({
        data: {
          transferNumber,
          fromBranchId: ctx.branchId,
          toBranchId: input.toBranchId,
          note: input.note || null,
          createdById: ctx.userId,
          items: {
            create: input.items.map((i) => ({
              productId: i.productId,
              quantity: toMoney(i.qty),
            })),
          },
        },
        include: { items: true },
      });

      // Kurangi stok origin — atomic per item; satu gagal → semua rollback
      for (const item of transfer.items) {
        const product = await this.getActiveProduct(tx, item.productId);
        const res = await inventoryRepository.decrementIfEnough(
          tx,
          item.productId,
          ctx.branchId,
          item.quantity,
        );
        if (res.count === 0) {
          const stock = await inventoryRepository.getStock(
            item.productId,
            ctx.branchId,
          );
          throw new BusinessRuleError(
            "INSUFFICIENT_STOCK",
            `Stok ${product.sku} tidak cukup (tersedia ${stock?.quantity ?? 0})`,
          );
        }
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            branchId: ctx.branchId,
            quantity: item.quantity.neg(),
            type: "TRANSFER_OUT",
            referenceType: "StockTransfer",
            referenceId: transfer.id,
            unitCost: product.purchasePrice,
            note: `Kirim ke ${toBranch.code}`,
            userId: ctx.userId,
          },
        });
      }

      await writeAudit(
        tx,
        ctx,
        "STOCK_TRANSFER_SEND",
        "StockTransfer",
        transfer.id,
        null,
        { transferNumber, to: toBranch.code, items: input.items.length },
      );
      return transfer;
    });
  },

  /** Terima: state guard atomic (anti double-receive), stok tujuan bertambah. */
  async receiveTransfer(ctx: AuthorizedContext, transferId: string) {
    return withTransaction(async (tx) => {
      const transfer = await inventoryRepository.findTransferById(transferId);
      if (!transfer) throw new NotFoundError("Transfer");
      if (transfer.toBranchId !== ctx.branchId) {
        throw new ForbiddenError("Hanya cabang tujuan yang dapat menerima");
      }

      // ATOMIC state guard: hanya update jika masih IN_TRANSIT
      const claimed = await tx.stockTransfer.updateMany({
        where: { id: transferId, status: "IN_TRANSIT" },
        data: {
          status: "RECEIVED",
          receivedById: ctx.userId,
          receivedAt: new Date(),
        },
      });
      if (claimed.count === 0) {
        throw new BusinessRuleError(
          "ALREADY_PROCESSED",
          "Transfer sudah diproses sebelumnya",
        );
      }

      for (const item of transfer.items) {
        const product = await this.getActiveProduct(tx, item.productId);
        await inventoryRepository.incrementOrCreate(
          tx,
          item.productId,
          ctx.branchId,
          item.quantity,
        );
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            branchId: ctx.branchId,
            quantity: item.quantity,
            type: "TRANSFER_IN",
            referenceType: "StockTransfer",
            referenceId: transfer.id,
            unitCost: product.purchasePrice,
            note: `Terima dari ${transfer.fromBranch.code}`,
            userId: ctx.userId,
          },
        });
      }

      await writeAudit(
        tx,
        ctx,
        "STOCK_TRANSFER_RECEIVE",
        "StockTransfer",
        transferId,
        { status: "IN_TRANSIT" },
        { status: "RECEIVED" },
      );
    });
  },

  /** Cancel IN_TRANSIT: stok kembali ke origin + movement TRANSFER_IN. */
  async cancelTransfer(ctx: AuthorizedContext, transferId: string) {
    return withTransaction(async (tx) => {
      const transfer = await inventoryRepository.findTransferById(transferId);
      if (!transfer) throw new NotFoundError("Transfer");
      if (transfer.fromBranchId !== ctx.branchId && !ctx.isSuperAdmin) {
        throw new ForbiddenError(
          "Hanya cabang pengirim yang dapat membatalkan",
        );
      }

      const claimed = await tx.stockTransfer.updateMany({
        where: { id: transferId, status: "IN_TRANSIT" },
        data: { status: "CANCELLED" },
      });
      if (claimed.count === 0) {
        throw new BusinessRuleError(
          "ALREADY_PROCESSED",
          "Transfer sudah diproses sebelumnya",
        );
      }

      for (const item of transfer.items) {
        const product = await this.getActiveProduct(tx, item.productId);
        await inventoryRepository.incrementOrCreate(
          tx,
          item.productId,
          transfer.fromBranchId,
          item.quantity,
        );
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            branchId: transfer.fromBranchId,
            quantity: item.quantity,
            type: "TRANSFER_IN",
            referenceType: "STOCK_TRANSFER_CANCEL",
            referenceId: transfer.id,
            unitCost: product.purchasePrice,
            note: `Batal transfer ${transfer.transferNumber}`,
            userId: ctx.userId,
          },
        });
      }

      await writeAudit(
        tx,
        ctx,
        "STOCK_TRANSFER_CANCEL",
        "StockTransfer",
        transferId,
        { status: "IN_TRANSIT" },
        { status: "CANCELLED" },
      );
    });
  },

  // ================== OPNAME ==================

  async createOpname(ctx: AuthorizedContext, input: CreateOpnameInput) {
    return withTransaction(async (tx) => {
      const branch = await this.getBranch(tx, ctx.branchId);
      const opnameNumber = await nextDocumentNumber(tx, branch, "OPN");

      // Snapshot expected dari cache stok saat ini (tanpa duplikat)
      const uniqueIds = [...new Set(input.productIds)];
      const stocks = await tx.productStock.findMany({
        where: { branchId: ctx.branchId, productId: { in: uniqueIds } },
      });
      const qtyByProduct = new Map(
        stocks.map((s) => [s.productId, s.quantity]),
      );

      const opname = await tx.stockOpname.create({
        data: {
          opnameNumber,
          branchId: ctx.branchId,
          note: input.note || null,
          createdById: ctx.userId,
          items: {
            create: uniqueIds.map((productId) => ({
              productId,
              expectedQty: qtyByProduct.get(productId) ?? toMoney(0),
            })),
          },
        },
      });

      await writeAudit(
        tx,
        ctx,
        "STOCK_OPNAME_CREATE",
        "StockOpname",
        opname.id,
        null,
        { opnameNumber, products: uniqueIds.length },
      );
      return opname;
    });
  },

  /**
   * Complete: delta = counted − stok SAAT INI (bukan snapshot, D25).
   * Jurnal agregat net selisih (D26). State guard atomic.
   */
  async completeOpname(ctx: AuthorizedContext, input: CompleteOpnameInput) {
    return withTransaction(async (tx) => {
      const opname = await inventoryRepository.findOpnameById(input.id);
      if (!opname) throw new NotFoundError("Opname");
      if (opname.branchId !== ctx.branchId)
        throw new ForbiddenError("branch.access");

      const countedMap = new Map(
        input.items.map((i) => [i.itemId, toMoney(i.countedQty)]),
      );
      const branch = await this.getBranch(tx, ctx.branchId);

      let netValue = toMoney(0); // (+) bertambah, (−) berkurang
      const movementData: Array<{
        productId: string;
        quantity: ReturnType<typeof toMoney>;
        unitCost: ReturnType<typeof toMoney>;
        productSku: string;
      }> = [];

      for (const item of opname.items) {
        const counted = countedMap.get(item.id);
        if (counted === undefined) {
          throw new BusinessRuleError(
            "MISSING_COUNT",
            `Hitungan belum lengkap untuk ${item.product.sku}`,
          );
        }

        // Stok terkini DI DALAM tx — robust terhadap perubahan sejak create
        const current = await tx.productStock.findUnique({
          where: {
            productId_branchId: {
              productId: item.productId,
              branchId: ctx.branchId,
            },
          },
        });
        const currentQty = current?.quantity ?? toMoney(0);
        const delta = counted.minus(currentQty);

        // Simpan diff informasi vs snapshot
        await tx.stockOpnameItem.update({
          where: { id: item.id },
          data: {
            countedQty: counted,
            diffQty: counted.minus(item.expectedQty),
          },
        });

        if (delta.eq(0)) continue;

        const product = item.product;
        if (delta.gt(0)) {
          await inventoryRepository.incrementOrCreate(
            tx,
            item.productId,
            ctx.branchId,
            delta,
          );
        } else {
          // current sudah di-read dalam tx; atomic decrement tetap dipakai
          const res = await inventoryRepository.decrementIfEnough(
            tx,
            item.productId,
            ctx.branchId,
            delta.abs(),
          );
          if (res.count === 0) {
            throw new BusinessRuleError(
              "INSUFFICIENT_STOCK",
              `Stok ${product.sku} berubah concurrent — ulangi opname item ini`,
            );
          }
        }

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            branchId: ctx.branchId,
            quantity: delta,
            type: delta.gt(0) ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
            referenceType: "StockOpname",
            referenceId: opname.id,
            unitCost: product.purchasePrice,
            note: `Opname ${opname.opnameNumber}`,
            userId: ctx.userId,
          },
        });

        netValue = netValue.plus(delta.mul(product.purchasePrice));
        movementData.push({
          productId: item.productId,
          quantity: delta,
          unitCost: product.purchasePrice,
          productSku: product.sku,
        });
      }

      // Jurnal agregat: satu entry net selisih
      if (!netValue.eq(0)) {
        if (netValue.gt(0)) {
          await accountingService.createPostedJournal(tx, branch, {
            memo: `Opname ${opname.opnameNumber} — selisih lebih (${movementData.length} item)`,
            sourceType: "STOCK_OPNAME",
            sourceId: opname.id,
            lines: [
              { accountCode: "1-1300", debit: netValue },
              { accountCode: "5-9000", credit: netValue },
            ],
          });
        } else {
          const v = netValue.abs();
          await accountingService.createPostedJournal(tx, branch, {
            memo: `Opname ${opname.opnameNumber} — selisih kurang (${movementData.length} item)`,
            sourceType: "STOCK_OPNAME",
            sourceId: opname.id,
            lines: [
              { accountCode: "5-9000", debit: v },
              { accountCode: "1-1300", credit: v },
            ],
          });
        }
      }

      // State guard atomic
      const claimed = await tx.stockOpname.updateMany({
        where: { id: opname.id, status: "DRAFT" },
        data: {
          status: "COMPLETED",
          completedById: ctx.userId,
          completedAt: new Date(),
        },
      });
      if (claimed.count === 0) {
        throw new BusinessRuleError(
          "ALREADY_PROCESSED",
          "Opname sudah diselesaikan",
        );
      }

      await writeAudit(
        tx,
        ctx,
        "STOCK_OPNAME_COMPLETE",
        "StockOpname",
        opname.id,
        { status: "DRAFT" },
        { status: "COMPLETED", netValue: netValue.toFixed(2) },
      );
    });
  },

  // Read-only
  getStockOverview: (branchId: string, params: StockOverviewParams) =>
    inventoryRepository.listStockOverview(branchId, params),
  listMovements: (branchId: string, params: MovementListParams) =>
    inventoryRepository.listMovements(branchId, params),
  findTransferById: (id: string) => inventoryRepository.findTransferById(id),
  listTransfers: (branchId: string, params: { status: string }) =>
    inventoryRepository.listTransfers(branchId, params),
  findOpnameById: (id: string) => inventoryRepository.findOpnameById(id),
  listOpnames: (branchId: string, params: { status: string }) =>
    inventoryRepository.listOpnames(branchId, params),
};
