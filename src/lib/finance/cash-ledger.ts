import "server-only";

import { BusinessRuleError } from "@/lib/errors";
import { toMoney, type Money } from "@/lib/utils/money";
import type { Tx } from "@/lib/db";

/**
 * SATU-SATUNYA jalur mengubah saldo CashAccount (D47).
 * ATOMIK: update saldo + guard non-minus dalam 1 statement (D48),
 * mengembalikan balanceAfter untuk snapshot ledger.
 */
export async function applyCashDelta(
  tx: Tx,
  accountId: string,
  delta: Money,
): Promise<Money> {
  if (delta.eq(0))
    throw new BusinessRuleError("ZERO_DELTA", "Perubahan saldo tidak boleh 0");

  const amt = delta.toFixed(2);
  const rows = await tx.$queryRaw<Array<{ currentBalance: string }>>`
        UPDATE "cash_account"
        SET "currentBalance" = "currentBalance" + ${amt}::numeric
        WHERE "id" = ${accountId}
          AND "currentBalance" + ${amt}::numeric >= 0
        RETURNING "currentBalance" AS "currentBalance"
    `;
  if (rows.length === 0) {
    throw new BusinessRuleError(
      "INSUFFICIENT_CASH_FUND",
      "Saldo akun kas/bank tidak cukup untuk transaksi ini",
    );
  }
  return toMoney(rows[0]!.currentBalance);
}

type CashTxInput = {
  accountId: string;
  branchId: string;
  type:
    | "SALE"
    | "PURCHASE"
    | "EXPENSE"
    | "RECEIVABLE_PAYMENT"
    | "PAYABLE_PAYMENT"
    | "TRANSFER"
    | "ADJUSTMENT"
    | "OTHER";
  amount: Money; // SIGNED: masuk (+), keluar (−)
  userId: string;
  note?: string;
  referenceType?: string;
  referenceId?: string;
};

/** Update saldo atomik + tulis baris ledger dengan snapshot saldo. */
export async function recordCashTx(tx: Tx, input: CashTxInput): Promise<Money> {
  const balanceAfter = await applyCashDelta(tx, input.accountId, input.amount);
  await tx.cashTransaction.create({
    data: {
      accountId: input.accountId,
      branchId: input.branchId,
      type: input.type,
      amount: input.amount,
      balanceAfter,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      note: input.note,
      userId: input.userId,
    },
  });
  return balanceAfter;
}

/** Akun kas/bank default cabang (akun pertama aktif dari tipe tsb — D49). */
export async function getDefaultCashAccount(
  tx: Tx,
  branchId: string,
  type: "CASH" | "BANK",
) {
  const acc = await tx.cashAccount.findFirst({
    where: { branchId, type, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, type: true, name: true },
  });
  if (!acc) {
    throw new BusinessRuleError(
      "NO_CASH_ACCOUNT",
      `Akun ${type === "CASH" ? "Kas" : "Bank"} belum tersedia untuk cabang ini`,
    );
  }
  return acc;
}
