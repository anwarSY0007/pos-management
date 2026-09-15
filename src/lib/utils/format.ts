/**
 * Formatter display — CLIENT-SAFE.
 * DILARANG meng-import apa pun dari generated prisma atau modul server-only.
 * Input bebas numerik: string dari DB (tanpa aritmetika di sini), number, atau Decimal-like.
 */
export type NumericLike = string | number | { toString(): string };

export function formatIDR(value: NumericLike): string {
    const n = typeof value === "number" ? value : Number(value.toString());
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(n);
}