"use server";

import { revalidatePath } from "next/cache";
import type { ActionResponse } from "@/types/api";
import { authorize } from "@/lib/permissions/authorize";
import { ValidationError, toActionResponse } from "@/lib/errors";
import { productService } from "@/services/product.service";
import { createProductSchema } from "@/schema/product.schema";
import { parseCsv } from "@/lib/utils/csv";

const MAX_FILE_SIZE = 2_000_000; // 2MB
const REQUIRED_COLUMNS = ["sku", "name", "purchaseprice", "sellingprice"];

export type ImportSummary = {
    created: number;
    updated: number;
    failed: number;
    errors: string[]; // maks 50 baris pertama
};

export async function importProducts(formData: FormData): Promise<ActionResponse<ImportSummary>> {
    try {
        const ctx = await authorize("product.import");

        const file = formData.get("file");
        if (!(file instanceof File) || file.size === 0) {
            throw new ValidationError("File CSV wajib diunggah");
        }
        if (file.size > MAX_FILE_SIZE) {
            throw new ValidationError("Ukuran file maksimal 2MB");
        }

        const rows = parseCsv(await file.text());
        if (rows.length < 2) throw new ValidationError("CSV harus berisi header dan minimal 1 baris data");

        const header = rows[0].map((h) => h.trim().toLowerCase());
        const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
        if (missing.length > 0) {
            throw new ValidationError(`Kolom wajib hilang: ${missing.join(", ")}`);
        }
        const col = (name: string) => header.indexOf(name);

        const summary: ImportSummary = { created: 0, updated: 0, failed: 0, errors: [] };

        for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            const rowInput = {
                sku: r[col("sku")]?.trim() ?? "",
                barcode: r[col("barcode")]?.trim() || undefined,
                name: r[col("name")]?.trim() ?? "",
                categoryId: r[col("category")]?.trim() || undefined, // nama kategori → mapping di bawah
                purchasePrice: r[col("purchaseprice")]?.trim() ?? "",
                sellingPrice: r[col("sellingprice")]?.trim() ?? "",
                minimumStock: r[col("minimumstock")]?.trim() || "0",
                taxRate: r[col("taxrate")]?.trim() || "0",
            };

            const parsed = createProductSchema.safeParse(rowInput);
            if (!parsed.success) {
                summary.failed++;
                if (summary.errors.length < 50) {
                    summary.errors.push(`Baris ${i + 1}: ${parsed.error.issues[0]?.message}`);
                }
                continue;
            }

            // nama kategori → id (kolom kategori di CSV berisi NAMA, bukan uuid)
            if (parsed.data.categoryId) {
                const category = await productService.findCategoryByName(parsed.data.categoryId);
                if (!category) {
                    summary.failed++;
                    summary.errors.push(`Baris ${i + 1}: kategori "${parsed.data.categoryId}" tidak ditemukan`);
                    continue;
                }
                parsed.data.categoryId = category.id;
            }

            try {
                const result = await productService.upsertBySku(ctx, parsed.data);
                summary[result]++;
            } catch {
                summary.failed++;
                if (summary.errors.length < 50) summary.errors.push(`Baris ${i + 1}: gagal disimpan`);
            }
        }

        revalidatePath("/products");
        return { success: true, data: summary };
    } catch (error) {
        return toActionResponse(error);
    }
}