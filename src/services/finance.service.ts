import "server-only";

import { BusinessRuleError, NotFoundError } from "@/lib/errors";
import { withTransaction, type Tx } from "@/lib/db";
import { writeAudit, type AuditContext } from "@/lib/audit";
import { toMoney } from "@/lib/utils/money";
import { accountingService } from "@/services/accounting.service";
import prisma from "@/lib/db";
import type { AuthorizedContext } from "@/lib/permissions/authorize";
import type {
  PayReceivableInput,
  PayPayableInput,
} from "@/schema/finance.schema";
import { recordCashTx, getDefaultCashAccount } from "@/lib/finance/cash-ledger";

const ACC_CASH = "1-1000",
  ACC_BANK = "1-1100";
const ACC_AR = "1-1200",
  ACC_AP = "2-1000";

async function getBranch(tx: Tx, branchId: string) {
  const b = await tx.branch.findUnique({
    where: { id: branchId },
    select: { id: true, code: true },
  });
  if (!b) throw new NotFoundError("Cabang");
  return b;
}

export const financeService = {
  /** Pelunasan piutang: CAS paidAmount (D60), kas +, jurnal Dr Kas / Cr Piutang. */
  async payReceivable(ctx: AuthorizedContext, input: PayReceivableInput) {
    return withTransaction(async (tx) => {
      const amount = toMoney(input.amount);

      const recv = await tx.receivable.findUnique({
        where: { id: input.receivableId },
        include: { sale: { select: { invoiceNumber: true } } },
      });
      if (!recv) throw new NotFoundError("Piutang");
      if (recv.branchId !== ctx.branchId && !ctx.isSuperAdmin) {
        throw new BusinessRuleError(
          "FORBIDDEN",
          "Piutang bukan milik cabang aktif",
        );
      }

      const remaining = recv.amount.minus(recv.paidAmount);
      if (amount.gt(remaining)) {
        throw new BusinessRuleError(
          "OVERPAY",
          `Sisa piutang ${remaining.toFixed(2)}, diminta ${amount.toFixed(2)}`,
        );
      }

      // CAS: hanya update jika paidAmount masih seperti yang dibaca
      const newPaid = recv.paidAmount.plus(amount);
      const claimed = await tx.receivable.updateMany({
        where: { id: recv.id, paidAmount: recv.paidAmount },
        data: {
          paidAmount: newPaid,
          status: newPaid.gte(recv.amount) ? "PAID" : "PARTIAL",
        },
      });
      if (claimed.count === 0) {
        throw new BusinessRuleError(
          "CONCURRENT_MODIFICATION",
          "Piutang berubah — muat ulang halaman",
        );
      }

      // Kas masuk: CASH → akun Kas, lainnya → Bank (D35)
      const acc = await getDefaultCashAccount(
        tx,
        recv.branchId,
        input.method === "CASH" ? "CASH" : "BANK",
      );
      await recordCashTx(tx, {
        accountId: acc.id,
        branchId: recv.branchId,
        type: "RECEIVABLE_PAYMENT",
        amount,
        userId: ctx.userId,
        referenceType: "Receivable",
        referenceId: recv.id,
        note: `Pelunasan ${recv.sale.invoiceNumber}${input.reference ? ` · ${input.reference}` : ""}`,
      });

      const branch = await getBranch(tx, recv.branchId);
      await accountingService.createPostedJournal(tx, branch, {
        memo: `Pelunasan piutang ${recv.sale.invoiceNumber}`,
        sourceType: "RECEIVABLE_PAYMENT",
        sourceId: recv.id,
        lines: [
          {
            accountCode: input.method === "CASH" ? ACC_CASH : ACC_BANK,
            debit: amount,
          },
          { accountCode: ACC_AR, credit: amount },
        ],
      });

      await writeAudit(
        tx,
        ctx,
        "RECEIVABLE_PAYMENT",
        "Receivable",
        recv.id,
        { paidAmount: recv.paidAmount.toFixed(2) },
        { paidAmount: newPaid.toFixed(2) },
      );
    });
  },

  /** Pelunasan utang: CAS, kas − (guard saldo), jurnal Dr Utang / Cr Kas. */
  async payPayable(ctx: AuthorizedContext, input: PayPayableInput) {
    return withTransaction(async (tx) => {
      const amount = toMoney(input.amount);

      const pay = await tx.payable.findUnique({
        where: { id: input.payableId },
        include: { purchase: { select: { purchaseNumber: true } } },
      });
      if (!pay) throw new NotFoundError("Utang");
      if (pay.branchId !== ctx.branchId && !ctx.isSuperAdmin) {
        throw new BusinessRuleError(
          "FORBIDDEN",
          "Utang bukan milik cabang aktif",
        );
      }

      const remaining = pay.amount.minus(pay.paidAmount);
      if (amount.gt(remaining)) {
        throw new BusinessRuleError(
          "OVERPAY",
          `Sisa utang ${remaining.toFixed(2)}, diminta ${amount.toFixed(2)}`,
        );
      }

      const newPaid = pay.paidAmount.plus(amount);
      const claimed = await tx.payable.updateMany({
        where: { id: pay.id, paidAmount: pay.paidAmount },
        data: {
          paidAmount: newPaid,
          status: newPaid.gte(pay.amount) ? "PAID" : "PARTIAL",
        },
      });
      if (claimed.count === 0) {
        throw new BusinessRuleError(
          "CONCURRENT_MODIFICATION",
          "Utang berubah — muat ulang halaman",
        );
      }

      const acc = await getDefaultCashAccount(
        tx,
        pay.branchId,
        input.method === "CASH" ? "CASH" : "BANK",
      );
      // Keluar kas — bisa INSUFFICIENT_CASH_FUND → rollback semua (D59)
      await recordCashTx(tx, {
        accountId: acc.id,
        branchId: pay.branchId,
        type: "PAYABLE_PAYMENT",
        amount: amount.neg(),
        userId: ctx.userId,
        referenceType: "Payable",
        referenceId: pay.id,
        note: `Pelunasan ${pay.purchase.purchaseNumber}${input.reference ? ` · ${input.reference}` : ""}`,
      });

      const branch = await getBranch(tx, pay.branchId);
      await accountingService.createPostedJournal(tx, branch, {
        memo: `Pelunasan utang ${pay.purchase.purchaseNumber}`,
        sourceType: "PAYABLE_PAYMENT",
        sourceId: pay.id,
        lines: [
          { accountCode: ACC_AP, debit: amount },
          {
            accountCode: input.method === "CASH" ? ACC_CASH : ACC_BANK,
            credit: amount,
          },
        ],
      });

      await writeAudit(
        tx,
        ctx,
        "PAYABLE_PAYMENT",
        "Payable",
        pay.id,
        { paidAmount: pay.paidAmount.toFixed(2) },
        { paidAmount: newPaid.toFixed(2) },
      );
    });
  },

  // Read-only untuk UI Part 3
  listReceivables: (branchId: string) =>
    prisma.receivable.findMany({
      where: { branchId, status: { in: ["UNPAID", "PARTIAL"] } },
      orderBy: { createdAt: "asc" },
      include: {
        customer: { select: { name: true } },
        sale: { select: { invoiceNumber: true, grandTotal: true } },
      },
      take: 100,
    }),
  listPayables: (branchId: string) =>
    prisma.payable.findMany({
      where: { branchId, status: { in: ["UNPAID", "PARTIAL"] } },
      orderBy: { createdAt: "asc" },
      include: {
        supplier: { select: { name: true } },
        purchase: { select: { purchaseNumber: true } },
      },
      take: 100,
    }),
};
