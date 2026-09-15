import { z } from "zod";
import { moneyString, qtyString, optionalId, optionalText } from "@/schema/shared";


export const createProductSchema = z
    .object({
        sku: z.string().trim().min(1, "SKU wajib diisi").max(50),
        barcode: optionalText(100),
        name: z.string().trim().min(1, "Nama wajib diisi").max(200),
        description: optionalText(2000),
        categoryId: optionalId,
        brandId: optionalId,
        unitId: optionalId,
        purchasePrice: moneyString,
        sellingPrice: moneyString,
        minimumStock: qtyString,
        taxRate: moneyString.optional(), // ← TANPA .default()
        imageUrl: optionalText(500),
    })
    .refine((v) => Number(v.sellingPrice) > 0, {
        message: "Harga jual harus lebih dari 0",
        path: ["sellingPrice"],
    });

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema;

export const productListSchema = z.object({
    q: z.string().trim().max(100).optional(),
    categoryId: optionalId,
    status: z.enum(["ACTIVE", "ARCHIVED", "ALL"]).default("ACTIVE"),
    sort: z.enum(["name", "sku", "sellingPrice", "createdAt"]).default("name"),
    dir: z.enum(["asc", "desc"]).default("asc"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(5).max(100).default(10),
});

export type ProductListParams = z.infer<typeof productListSchema>;