import "server-only";

import { NotFoundError } from "@/lib/errors";
import { withTransaction, type Tx } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { toMoney } from "@/lib/utils/money";
import { nextDocumentNumber } from "@/lib/utils/sequence";
import { accountingService } from "@/services/accounting.service";
import prisma from "@/lib/db";
import type { AuthorizedContext } from "@/lib/permissions/authorize";
import type { CreateExpenseInput } from "@/schema/finance.schema";
import { recordCashTx } from "@/lib/finance/cash-ledger";

const ACC_CASH = "1-1000",
  ACC_BANK = "1-1100";

async function getBranch(tx: Tx, branchId: string) {
  const b = await tx.branch.findUnique({
    where: { id: branchId },
    select: { id: true, code: true },
  });
  if (!b) throw new NotFoundError("Cabang");
  return b;
}

export const expenseService = {
  /** D53: Dr [akun beban 6-xxxx] / Cr Kas|Bank. Saldo kas diguard atomik. */
  async create(ctx: AuthorizedContext, input: CreateExpenseInput) {
    return withTransaction(async (tx) => {
      const amount = toMoney(input.amount);

      const account = await tx.cashAccount.findFirst({
        where: { id: input.accountId, branchId: ctx.branchId, isActive: true },
      });
      if (!account) throw new NotFoundError("Akun kas/bank");

      const coa = await tx.chartOfAccount.findFirst({
        where: { code: input.expenseAccount, isActive: true },
      });
      if (!coa) throw new NotFoundError("Akun beban");

      const branch = await getBranch(tx, ctx.branchId);
      const expenseNumber = await nextDocumentNumber(tx, branch, "EXP");
      const expenseDate = new Date(`${input.expenseDate}T00:00:00`);

      const expense = await tx.expense.create({
        data: {
          expenseNumber,
          branchId: ctx.branchId,
          accountId: account.id,
          expenseAccount: input.expenseAccount,
          category: input.category,
          description: input.description || null,
          amount,
          expenseDate,
          note: input.note || null,
          userId: ctx.userId,
        },
      });

      // Kas berkurang — INSUFFICIENT_CASH_FUND mungkin (rollback semua)
      await recordCashTx(tx, {
        accountId: account.id,
        branchId: ctx.branchId,
        type: "EXPENSE",
        amount: amount.neg(),
        userId: ctx.userId,
        referenceType: "Expense",
        referenceId: expense.id,
        note: `${expenseNumber} · ${input.category}`,
      });

      await accountingService.createPostedJournal(tx, branch, {
        memo: `Beban ${expenseNumber} — ${input.category}`,
        sourceType: "EXPENSE",
        sourceId: expense.id,
        lines: [
          { accountCode: input.expenseAccount, debit: amount },
          {
            accountCode: account.type === "CASH" ? ACC_CASH : ACC_BANK,
            credit: amount,
          },
        ],
      });

      await writeAudit(tx, ctx, "EXPENSE_CREATE", "Expense", expense.id, null, {
        expenseNumber,
        category: input.category,
        amount: amount.toFixed(2),
      });
      return expense;
    });
  },

  list: (branchId: string, params: { page: number; pageSize: number }) => {
    const where = { branchId };
    return prisma
      .$transaction([
        prisma.expense.findMany({
          where,
          orderBy: { expenseDate: "desc" },
          skip: (params.page - 1) * params.pageSize,
          take: params.pageSize,
          include: {
            account: { select: { name: true } },
            user: { select: { name: true } },
          },
        }),
        prisma.expense.count({ where }),
      ])
      .then(([items, total]) => ({
        items,
        total,
        page: params.page,
        pageSize: params.pageSize,
        pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
      }));
  },
};
