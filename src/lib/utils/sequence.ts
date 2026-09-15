import type { Tx } from "@/lib/db";

/**
 * Penomoran dokumen ATOMIK.
 * WAJIB dipanggil di dalam transaksi bisnis (tx) — bukan prisma global —
 * agar nomor ikut rollback jika transaksi gagal.
 */

export function formatDocumentNumber(
    docType: string,
    branchCode: string,
    period: string,
    seq: number,
): string {
    return `${docType}-${branchCode}-${period}-${String(seq).padStart(4, "0")}`;
}

export async function nextDocumentNumber(
    tx: Tx,
    branch: { id: string; code: string },
    docType: string,
    date: Date = new Date(),
): Promise<string> {
    const period = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;

    const rows = await tx.$queryRaw<Array<{ current: number }>>`
      INSERT INTO "document_sequence" ("id", "branchId", "docType", "period", "current")
      VALUES (gen_random_uuid(), ${branch.id}, ${docType}, ${period}, 1)
      ON CONFLICT ("branchId", "docType", "period")
      DO UPDATE SET "current" = "document_sequence"."current" + 1
      RETURNING "current"
    `;

    const current = rows[0]?.current;
    if (current === undefined) {
        throw new Error("Gagal membuat nomor dokumen");
    }
    return formatDocumentNumber(docType, branch.code, period, current);
}