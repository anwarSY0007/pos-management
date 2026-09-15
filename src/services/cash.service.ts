import "server-only";

import { BusinessRuleError, NotFoundError } from "@/lib/errors";
import { withTransaction, type Tx } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { toMoney } from "@/lib/utils/money";
import { recordCashTx } from "@/lib/finance/cash-ledger";
import { accountingService } from "@/services/accounting.service";
import prisma from "@/lib/db";
import type { AuthorizedContext } from "@/lib/permissions/authorize";
import type {
  CreateCashAccountInput,
  TransferCashInput,
  AdjustCashInput,
  CashTransactionListParams,
} from "@/schema/finance.schema";

const ACC_CASH = "1-1000",
  ACC_BANK = "1-1100",
  ACC_CAPITAL = "3-1000";
const ACC_OTHER_INCOME = "4-9000",
  ACC_OTHER_EXPENSE = "6-9000";

async function getBranch(tx: Tx, branchId: string) {
  const b = await tx.branch.findUnique({
    where: { id: branchId },
    select: { id: true, code: true },
  });
  if (!b) throw new NotFoundError("Cabang");
  return b;
}

export const cashService = {
  /** D52: opening balance > 0 → CashTx ADJUSTMENT + jurnal Dr Kas/Cr Modal. */
  async createAccount(ctx: AuthorizedContext, input: CreateCashAccountInput) {
    return withTransaction(async (tx) => {
      const branch = await getBranch(tx, ctx.branchId);
      const opening = toMoney(input.openingBalance ?? "0");

      const account = await tx.cashAccount.create({
        data: {
          branchId: ctx.branchId,
          name: input.name,
          type: input.type,
          accountNumber: input.accountNumber || null,
          currentBalance: opening,
        },
      });

      if (opening.gt(0)) {
        await recordCashTx(tx, {
          accountId: account.id,
          branchId: ctx.branchId,
          type: "ADJUSTMENT",
          amount: opening,
          userId: ctx.userId,
          note: `Saldo awal ${account.name}`,
        });
        await accountingService.createPostedJournal(tx, branch, {
          memo: `Saldo awal ${account.name}`,
          sourceType: "CASH_OPENING",
          sourceId: account.id,
          lines: [
            {
              accountCode: input.type === "CASH" ? ACC_CASH : ACC_BANK,
              debit: opening,
            },
            { accountCode: ACC_CAPITAL, credit: opening },
          ],
        });
      }

      await writeAudit(
        tx,
        ctx,
        "CASH_ACCOUNT_CREATE",
        "CashAccount",
        account.id,
        null,
        { name: input.name, type: input.type, opening: opening.toFixed(2) },
      );
      return account;
    });
  },

  /** D51: 2 baris ledger terhubung groupId, tanpa jurnal. */
  async transfer(ctx: AuthorizedContext, input: TransferCashInput) {
    return withTransaction(async (tx) => {
      const amount = toMoney(input.amount);
      if (amount.lte(0))
        throw new BusinessRuleError("INVALID_AMOUNT", "Nominal harus > 0");

      const [from, to] = await Promise.all([
        tx.cashAccount.findFirst({
          where: {
            id: input.fromAccountId,
            branchId: ctx.branchId,
            isActive: true,
          },
        }),
        tx.cashAccount.findFirst({
          where: {
            id: input.toAccountId,
            branchId: ctx.branchId,
            isActive: true,
          },
        }),
      ]);
      if (!from) throw new NotFoundError("Akun asal");
      if (!to) throw new NotFoundError("Akun tujuan");

      const groupId = crypto.randomUUID();
      await recordCashTx(tx, {
        accountId: from.id,
        branchId: ctx.branchId,
        type: "TRANSFER",
        amount: amount.neg(),
        userId: ctx.userId,
        referenceType: "CashTransfer",
        referenceId: groupId,
        note: `Transfer ke ${to.name}${input.note ? ` — ${input.note}` : ""}`,
      });
      await recordCashTx(tx, {
        accountId: to.id,
        branchId: ctx.branchId,
        type: "TRANSFER",
        amount,
        userId: ctx.userId,
        referenceType: "CashTransfer",
        referenceId: groupId,
        note: `Transfer dari ${from.name}${input.note ? ` — ${input.note}` : ""}`,
      });

      await writeAudit(tx, ctx, "CASH_TRANSFER", "CashAccount", from.id, null, {
        to: to.id,
        amount: amount.toFixed(2),
        groupId,
      });
    });
  },

  /** D58: IN→4-9000, OUT→6-9000. Note wajib. */
  async adjust(ctx: AuthorizedContext, input: AdjustCashInput) {
    return withTransaction(async (tx) => {
      const amount = toMoney(input.amount);
      if (amount.lte(0))
        throw new BusinessRuleError("INVALID_AMOUNT", "Nominal harus > 0");

      const account = await tx.cashAccount.findFirst({
        where: { id: input.accountId, branchId: ctx.branchId, isActive: true },
      });
      if (!account) throw new NotFoundError("Akun kas");

      const branch = await getBranch(tx, ctx.branchId);
      const signed = input.direction === "IN" ? amount : amount.neg();
      await recordCashTx(tx, {
        accountId: account.id,
        branchId: ctx.branchId,
        type: "ADJUSTMENT",
        amount: signed,
        userId: ctx.userId,
        note: input.note,
      });

      const accCode = account.type === "CASH" ? ACC_CASH : ACC_BANK;
      await accountingService.createPostedJournal(tx, branch, {
        memo: `Penyesuaian ${account.name}: ${input.note}`,
        sourceType: "CASH_ADJUSTMENT",
        sourceId: account.id,
        lines:
          input.direction === "IN"
            ? [
                { accountCode: accCode, debit: amount },
                { accountCode: ACC_OTHER_INCOME, credit: amount },
              ]
            : [
                { accountCode: ACC_OTHER_EXPENSE, debit: amount },
                { accountCode: accCode, credit: amount },
              ],
      });

      await writeAudit(
        tx,
        ctx,
        "CASH_ADJUSTMENT",
        "CashAccount",
        account.id,
        null,
        {
          direction: input.direction,
          amount: amount.toFixed(2),
          note: input.note,
        },
      );
    });
  },

  // Read-only
  listAccounts: (branchId: string) =>
    prisma.cashAccount.findMany({
      where: { branchId, isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
  async listTransactions(branchId: string, params: CashTransactionListParams) {
    const where = {
      branchId,
      ...(params.accountId ? { accountId: params.accountId } : {}),
      ...(params.type ? { type: params.type } : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.cashTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: {
          account: { select: { name: true, type: true } },
          user: { select: { name: true } },
        },
      }),
      prisma.cashTransaction.count({ where }),
    ]);
    return {
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
      pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
    };
  },
};
