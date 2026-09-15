import "server-only";

import { BusinessRuleError } from "@/lib/errors";
import type { Tx } from "@/lib/db";
import { toMoney } from "@/lib/utils/money";
import { nextDocumentNumber } from "@/lib/utils/sequence";
import {
  assertJournalBalanced,
  type JournalLine,
} from "@/lib/accounting/journal";

export const accountingService = {
  /**
   * Buat jurnal system-generated, langsung POSTED (immutable).
   * WAJIB dipanggil dalam tx bisnis pemanggil — ikut rollback.
   * Akun di-resolve by CODE (kode COA stabil, seeded).
   */
  async createPostedJournal(
    tx: Tx,
    branch: { id: string; code: string },
    input: {
      memo: string;
      sourceType: string;
      sourceId?: string;
      lines: JournalLine[];
      entryDate?: Date;
    },
  ): Promise<string> {
    assertJournalBalanced(input.lines);

    const codes = [...new Set(input.lines.map((l) => l.accountCode))];
    const accounts = await tx.chartOfAccount.findMany({
      where: { code: { in: codes }, isActive: true },
      select: { id: true, code: true },
    });
    const idByCode = new Map(accounts.map((a) => [a.code, a.id]));

    for (const code of codes) {
      if (!idByCode.has(code)) {
        throw new BusinessRuleError(
          "ACCOUNT_NOT_FOUND",
          `Akun ${code} tidak ditemukan. Jalankan seed COA.`,
        );
      }
    }

    const entryNumber = await nextDocumentNumber(
      tx,
      branch,
      "JRNL",
      input.entryDate,
    );
    const entryDate = input.entryDate ?? new Date();

    const entry = await tx.journalEntry.create({
      data: {
        entryNumber,
        branchId: branch.id,
        entryDate,
        memo: input.memo,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        status: "POSTED",
        postedAt: entryDate,
        lines: {
          create: input.lines.map((l) => ({
            accountId: idByCode.get(l.accountCode)!,
            debit: l.debit ?? toMoney(0),
            credit: l.credit ?? toMoney(0),
          })),
        },
      },
      select: { id: true },
    });

    return entry.id;
  },
};
