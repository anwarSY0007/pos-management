import { describe, expect, it } from "vitest";
import { assertJournalBalanced } from "@/lib/accounting/journal";
import { toMoney } from "@/lib/utils/money";

const line = (d?: string, c?: string) => ({
  accountCode: "X",
  ...(d ? { debit: toMoney(d) } : {}),
  ...(c ? { credit: toMoney(c) } : {}),
});

describe("assertJournalBalanced (double-entry)", () => {
  it("seimbang → lolos", () => {
    expect(() =>
      assertJournalBalanced([line("15000"), line(undefined, "15000")]),
    ).not.toThrow();
  });

  it("tidak seimbang → JOURNAL_UNBALANCED", () => {
    expect(() =>
      assertJournalBalanced([line("15000"), line(undefined, "14000")]),
    ).toThrow(/tidak seimbang/);
  });

  it("total nol → ditolak", () => {
    expect(() =>
      assertJournalBalanced([line("0"), line(undefined, "0")]),
    ).toThrow();
  });

  it("kurang dari 2 baris → ditolak", () => {
    expect(() => assertJournalBalanced([line("1000", undefined)])).toThrow(
      /minimal 2 baris/,
    );
  });

  it("baris debit DAN kredit sekaligus → ditolak", () => {
    expect(() =>
      assertJournalBalanced([line("100", "100"), line("100")]),
    ).toThrow(/ATAU/);
  });

  it("nilai negatif → ditolak", () => {
    expect(() =>
      assertJournalBalanced([
        { accountCode: "X", debit: toMoney("-100") },
        { accountCode: "Y", credit: toMoney("-100") },
      ]),
    ).toThrow(/negatif/);
  });
});
