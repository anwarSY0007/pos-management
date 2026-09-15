import { z } from "zod";

/** Uang: string, max 2 desimal. Server parse ke Decimal (D10). */
export const moneyString = z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Format angka tidak valid (contoh: 15000 atau 15000.50)");

/** Kuantitas: max 3 desimal. */
export const qtyString = z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,3})?$/, "Format kuantitas tidak valid");

/** "" (select kosong) ATAU uuid — konversi "" → null di SERVICE. */
export const optionalId = z.union([z.literal(""), z.uuid()]).optional();

export const optionalText = (max: number) => z.string().trim().max(max).optional();