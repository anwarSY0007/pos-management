import "server-only";

import { BusinessRuleError, ForbiddenError, isUniqueViolation, NotFoundError } from "@/lib/errors";
import {  withTransaction, type Tx } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { Money, toMoney } from "@/lib/utils/money";
import { nextDocumentNumber } from "@/lib/utils/sequence";
import {
  computeCart,
  allocatePayments,
  type CartLineInput,
  type PaymentInput,
} from "@/lib/sales/pricing";
import { accountingService } from "@/services/accounting.service";
import { inventoryRepository } from "@/repositories/inventory.repository";
import { saleRepository } from "@/repositories/sale.repository";
import type { AuthorizedContext } from "@/lib/permissions/authorize";
import type { CheckoutInput } from "@/schema/sale.schema";

// COA (seeded)
const ACC_CASH = "1-1000";
const ACC_BANK = "1-1100";
const ACC_AR = "1-1200";
const ACC_INVENTORY = "1-1300";
const ACC_AP_TAX = "2-1100"; // Utang PPN Keluaran
const ACC_SALES = "4-1000";
const ACC_COGS = "5-1000";

// const min = (a: ReturnType<typeof toMoney>, b: ReturnType<typeof toMoney>) =>
//   a.lte(b) ? a : b;

async function getBranch(tx: Tx, branchId: string) {
  const branch = await tx.branch.findUnique({
    where: { id: branchId },
    select: { id: true, code: true },
  });
  if (!branch) throw new NotFoundError("Cabang");
  return branch;
}

/** Pecah nilai jurnal revenue/alokasi — skip entri nol (CHECK DB melarang baris 0). */
function revenueLines(
  alloc: ReturnType<typeof allocatePayments>,
  revenue: ReturnType<typeof toMoney>,
  tax: ReturnType<typeof toMoney>,
) {
  const lines: Array<{
    accountCode: string;
    debit?: ReturnType<typeof toMoney>;
    credit?: ReturnType<typeof toMoney>;
  }> = [];
  if (alloc.cashNet.gt(0))
    lines.push({ accountCode: ACC_CASH, debit: alloc.cashNet });
  if (alloc.bankNet.gt(0))
    lines.push({ accountCode: ACC_BANK, debit: alloc.bankNet });
  if (alloc.ar.gt(0)) lines.push({ accountCode: ACC_AR, debit: alloc.ar });
  if (revenue.gt(0)) lines.push({ accountCode: ACC_SALES, credit: revenue });
  if (tax.gt(0)) lines.push({ accountCode: ACC_AP_TAX, credit: tax });
  return lines;
}

export const saleService = {
  /**
   * CHECKOUT — satu transaksi (§19):
   * validasi harga server → stok atomic → Sale+Items(snapshot) → Payment
   * → Movement → Receivable → Jurnal(revenue+COGS) → Audit → COMMIT
   */
  async checkout(ctx: AuthorizedContext, input: CheckoutInput) {
    // Idempotency fast-path (di luar tx — read-only)
    const existing = await saleRepository.findByRequestId(input.requestId);
    if (existing) return existing;

    // Duplikat produk di cart → tolak (client yang merge)
    const ids = input.items.map((i) => i.productId);
    if (new Set(ids).size !== ids.length) {
      throw new BusinessRuleError(
        "DUPLICATE_PRODUCT",
        "Ada produk duplikat di keranjang",
      );
    }

    try {
      const sale = await withTransaction(
        async (tx) => {
          // 1. SERVER TRUTH: harga & pajak dari DB, bukan client (D29)
          const products = await tx.product.findMany({
            where: { id: { in: ids }, status: "ACTIVE" },
          });
          if (products.length !== ids.length) throw new NotFoundError("Produk");
          const byId = new Map(products.map((p) => [p.id, p]));

          const cartLines: CartLineInput[] = input.items.map((i) => {
            const p = byId.get(i.productId)!;
            return {
              unitPrice: p.sellingPrice,
              taxRate: p.taxRate,
              quantity: toMoney(i.quantity),
              discount: toMoney(i.discount ?? "0"),
            };
          });
          const totals = computeCart(
            cartLines,
            toMoney(input.saleDiscount ?? "0"),
          );

          // 2. Alokasi pembayaran
          const paymentInputs: PaymentInput[] = input.payments.map((p) => ({
            method: p.method,
            amount: toMoney(p.amount),
          }));
          const alloc = allocatePayments(paymentInputs, totals.grandTotal);

          // 3. STOK — atomic decrement, anti-oversell (§17)
          for (const line of totals.lines) {
            const productId =
              input.items[totals.lines.indexOf(line)]!.productId;
            const res = await inventoryRepository.decrementIfEnough(
              tx,
              productId,
              ctx.branchId,
              line.quantity,
            );
            if (res.count === 0) {
              const p = byId.get(productId)!;
              throw new BusinessRuleError(
                "INSUFFICIENT_STOCK",
                `Stok ${p.sku} tidak cukup`,
              );
            }
          }

          // 4. Nomor invoice
          const branch = await getBranch(tx, ctx.branchId);
          const invoiceNumber = await nextDocumentNumber(tx, branch, "INV");

          // 5. Credit sale → wajib customer + cek limit (D33)
          const due = alloc.ar;
          const customerId = input.customerId ?? null;
          if (due.gt(0)) {
            if (!customerId) {
              throw new BusinessRuleError(
                "CUSTOMER_REQUIRED",
                "Sisa pembayaran > 0 wajib memilih pelanggan (kredit)",
              );
            }
            const customer = await tx.customer.findFirst({
              where: { id: customerId, status: "ACTIVE" },
            });
            if (!customer) throw new NotFoundError("Pelanggan");

            const agg = await tx.receivable.aggregate({
              where: { customerId, status: { in: ["UNPAID", "PARTIAL"] } },
              _sum: { amount: true, paidAmount: true },
            });
            const outstanding = (agg._sum.amount ?? toMoney(0)).minus(
              agg._sum.paidAmount ?? toMoney(0),
            );
            if (outstanding.plus(due).gt(customer.creditLimit)) {
              throw new BusinessRuleError(
                "CREDIT_LIMIT_EXCEEDED",
                `Limit kredit ${customer.name} tidak cukup (terpakai ${outstanding.toFixed(2)})`,
              );
            }
          }

          // 6. Sale + items (snapshot D30)
          const paymentStatus = alloc.effectivePaid.gte(totals.grandTotal)
            ? "PAID"
            : "PARTIAL";

          const sale = await tx.sale.create({
            data: {
              invoiceNumber,
              requestId: input.requestId,
              branchId: ctx.branchId,
              customerId,
              cashierId: ctx.userId,
              subtotal: totals.subtotal,
              discount: totals.discount,
              tax: totals.tax,
              grandTotal: totals.grandTotal,
              paidAmount: alloc.effectivePaid,
              changeAmount: alloc.change,
              paymentStatus,
              status: "COMPLETED",
              note: input.note || null,
              items: {
                create: totals.lines.map((line, idx) => {
                  const p = byId.get(input.items[idx]!.productId)!;
                  return {
                    productId: p.id,
                    productName: p.name, // snapshot
                    sku: p.sku, // snapshot
                    quantity: line.quantity,
                    unitPrice: line.unitPrice,
                    costPrice: p.purchasePrice, // D30: COGS historis
                    discount: line.discount,
                    taxRate: line.taxRate,
                    subtotal: line.lineSubtotal,
                    taxAmount: line.lineTax,
                  };
                }),
              },
              payments: {
                create: input.payments
                  .filter((p) => toMoney(p.amount).gt(0))
                  .map((p) => ({
                    method: p.method,
                    amount: toMoney(p.amount),
                    reference: p.reference || null,
                  })),
              },
            },
            include: { items: true, payments: true },
          });

          // 7. Stock movements (SALE, negatif)
          for (let idx = 0; idx < totals.lines.length; idx++) {
            const line = totals.lines[idx]!;
            const p = byId.get(input.items[idx]!.productId)!;
            await tx.stockMovement.create({
              data: {
                productId: p.id,
                branchId: ctx.branchId,
                quantity: line.quantity.neg(),
                type: "SALE",
                referenceType: "Sale",
                referenceId: sale.id,
                unitCost: p.purchasePrice,
                note: invoiceNumber,
                userId: ctx.userId,
              },
            });
          }

          // 8. Receivable (D33)
          if (due.gt(0) && customerId) {
            await tx.receivable.create({
              data: {
                saleId: sale.id,
                branchId: ctx.branchId,
                customerId,
                amount: due,
                paidAmount: toMoney(0),
                status: "UNPAID",
              },
            });
          }

          // 9. JURNAL — revenue (D32) + COGS
          const revenue = totals.subtotal.minus(totals.discount);
          const revLines = revenueLines(alloc, revenue, totals.tax);
          if (revLines.length >= 2) {
            await accountingService.createPostedJournal(tx, branch, {
              memo: `Penjualan ${invoiceNumber}`,
              sourceType: "SALE",
              sourceId: sale.id,
              lines: revLines,
            });
          }
          const cogs = totals.lines.reduce(
            (acc, line, idx) =>
              acc.plus(
                byId
                  .get(input.items[idx]!.productId)!
                  .purchasePrice.mul(line.quantity),
              ),
            toMoney(0),
          );
          if (cogs.gt(0)) {
            await accountingService.createPostedJournal(tx, branch, {
              memo: `COGS ${invoiceNumber}`,
              sourceType: "SALE_COGS",
              sourceId: sale.id,
              lines: [
                { accountCode: ACC_COGS, debit: cogs },
                { accountCode: ACC_INVENTORY, credit: cogs },
              ],
            });
          }

          // 10. Audit
          await writeAudit(tx, ctx, "SALE_CREATE", "Sale", sale.id, null, {
            invoiceNumber,
            grandTotal: totals.grandTotal.toFixed(2),
            paid: alloc.effectivePaid.toFixed(2),
            items: totals.lines.length,
          });

          return sale;
        },
        { timeout: 20_000 },
      );

      return sale;
    } catch (error) {
      // Idempotency: race double-submit → P2002 requestId → kembalikan existing
      if (isUniqueViolation(error, "requestId")) {
        const race = await saleRepository.findByRequestId(input.requestId);
        if (race) return race;
      }
      throw error;
    }
  },

  /**
   * CANCEL — state guard atomic, restock, reversal jurnal.
   * Receivable belum dibayar → baris dihapus (audit + jurnal reversal mencatat, D37).
   * Receivable sudah ada pembayaran → tolak (refund = Phase 6).
   */
  async cancel(ctx: AuthorizedContext, saleId: string) {
    return withTransaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { items: true, payments: true, receivable: true },
      });
      if (!sale) throw new NotFoundError("Penjualan");
      if (sale.branchId !== ctx.branchId && !ctx.isSuperAdmin) {
        throw new ForbiddenError("sale.cancel");
      }

      // Guard atomic
      const claimed = await tx.sale.updateMany({
        where: { id: saleId, status: "COMPLETED" },
        data: { status: "CANCELLED" },
      });
      if (claimed.count === 0) {
        throw new BusinessRuleError(
          "ALREADY_PROCESSED",
          "Penjualan sudah dibatalkan",
        );
      }

      // Receivable rules
      if (sale.receivable) {
        if (sale.receivable.paidAmount.gt(0)) {
          throw new BusinessRuleError(
            "REFUND_REQUIRED",
            "Piutang sudah dibayar sebagian/parcel — gunakan alur retur (Phase 6)",
          );
        }
        await tx.receivable.delete({ where: { id: sale.receivable.id } });
      }

      // Restock + movement
      for (const item of sale.items) {
        await inventoryRepository.incrementOrCreate(
          tx,
          item.productId,
          sale.branchId,
          item.quantity,
        );
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            branchId: sale.branchId,
            quantity: item.quantity, // positif = kembali
            type: "SALE_RETURN",
            referenceType: "SaleCancel",
            referenceId: sale.id,
            unitCost: item.costPrice,
            note: `Batal ${sale.invoiceNumber}`,
            userId: ctx.userId,
          },
        });
      }

      // Reversal jurnal (deterministik dari payments tersimpan)
      const branch = await getBranch(tx, sale.branchId);
      const alloc = allocatePayments(
        sale.payments.map((p) => ({ method: p.method, amount: p.amount })),
        sale.grandTotal,
      );
      const revenue = sale.subtotal.minus(sale.discount);

      const revLines = revenueLines(
        { ...alloc, ar: toMoney(0) }, // piutang sudah dihapus
        revenue,
        sale.tax,
      );
      // Reversal: debit ↔ credit dibalik, piutang jadi kredit pengembalian
      const reversalLines: Array<{
        accountCode: string;
        debit?: Money;
        credit?: Money;
      }> = revLines.map((l) =>
        l.debit
          ? { accountCode: l.accountCode, credit: l.debit }
          : { accountCode: l.accountCode, debit: l.credit! },
      );

      if (sale.receivable) {
        reversalLines.push({
          accountCode: ACC_AR,
          credit: sale.receivable.amount,
        });
      }
      if (reversalLines.length >= 2) {
        await accountingService.createPostedJournal(tx, branch, {
          memo: `Pembatalan ${sale.invoiceNumber}`,
          sourceType: "SALE_CANCEL",
          sourceId: sale.id,
          lines: reversalLines,
        });
      }

      const cogs = sale.items.reduce(
        (acc, i) => acc.plus(i.costPrice.mul(i.quantity)),
        toMoney(0),
      );
      if (cogs.gt(0)) {
        await accountingService.createPostedJournal(tx, branch, {
          memo: `Reversal COGS ${sale.invoiceNumber}`,
          sourceType: "SALE_CANCEL_COGS",
          sourceId: sale.id,
          lines: [
            { accountCode: ACC_INVENTORY, debit: cogs },
            { accountCode: ACC_COGS, credit: cogs },
          ],
        });
      }

      await writeAudit(
        tx,
        ctx,
        "SALE_CANCEL",
        "Sale",
        sale.id,
        { status: "COMPLETED" },
        { status: "CANCELLED" },
      );
    });
  },

  findById: saleRepository.findById,
  list: saleRepository.list,
};
