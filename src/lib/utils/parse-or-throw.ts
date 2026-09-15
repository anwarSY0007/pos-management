import type { z } from "zod";
import { ValidationError } from "@/lib/errors";

/**
 * Pattern standar Server Action: parse → throw ValidationError.
 * Type-safe: return z.output<T> ter-infer dari schema.
 * Catatan: schema form tidak boleh punya transform pengubah tipe
 * (.default / .coerce / .preprocess) — lihat product.schema.ts.
 */
export function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
    }
    return parsed.data;
}