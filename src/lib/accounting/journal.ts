import { BusinessRuleError } from "@/lib/errors";
import { moneySum, toMoney, type Money } from "@/lib/utils/money";

export type JournalLine = {
  accountCode: string;
  debit?: Money;
  credit?: Money;
};

/**
 * Aturan double-entry: TOTAL DEBIT = TOTAL KREDIT.
 * Murni (tanpa DB) agar bisa di-unit test.
 */
export function assertJournalBalanced(lines: JournalLine[]): void {
  if (lines.length < 2) {
    throw new BusinessRuleError(
      "JOURNAL_UNBALANCED",
      "Jurnal butuh minimal 2 baris",
    );
  }
  for (const l of lines) {
    const d = l.debit ?? toMoney(0);
    const c = l.credit ?? toMoney(0);
    if (d.lt(0) || c.lt(0)) {
      throw new BusinessRuleError(
        "JOURNAL_NEGATIVE",
        "Nilai debit/kredit tidak boleh negatif",
      );
    }
    if (d.gt(0) && c.gt(0)) {
      throw new BusinessRuleError(
        "JOURNAL_LINE_INVALID",
        "Satu baris hanya boleh debit ATAU kredit",
      );
    }
  }

  const debits = moneySum(lines.map((l) => l.debit ?? toMoney(0)));
  const credits = moneySum(lines.map((l) => l.credit ?? toMoney(0)));
  if (!debits.eq(credits) || debits.eq(0)) {
    throw new BusinessRuleError(
      "JOURNAL_UNBALANCED",
      `Jurnal tidak seimbang: Debit ${debits.toFixed(2)} ≠ Kredit ${credits.toFixed(2)}`,
    );
  }
}
