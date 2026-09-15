import { ConflictError, isUniqueViolation, NotFoundError } from "@/lib/errors";// withTransaction dari lib/db
import { writeAudit, type AuditContext } from "@/lib/audit";
import { toMoney } from "@/lib/utils/money";
import { productRepository } from "@/repositories/product.repository";
import type { CreateProductInput } from "@/schema/product.schema";
import prisma, { withTransaction } from "@/lib/db";

export const productService = {
    async create(ctx: AuditContext, input: CreateProductInput) {
        try {
            return await withTransaction(async (tx) => {
                const product = await tx.product.create({
                    data: {
                        sku: input.sku,
                        barcode: input.barcode || null,
                        name: input.name,
                        description: input.description || null,
                        categoryId: input.categoryId ?? null,
                        brandId: input.brandId ?? null,
                        unitId: input.unitId ?? null,
                        purchasePrice: toMoney(input.purchasePrice),
                        sellingPrice: toMoney(input.sellingPrice),
                        minimumStock: toMoney(input.minimumStock),
                        taxRate: toMoney(input.taxRate ?? "0"),
                        ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
                    },
                });
                await writeAudit(tx, ctx, "PRODUCT_CREATE", "Product", product.id, null, product);
                return product;
            });
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictError("SKU atau barcode sudah digunakan");
            }
            throw error;
        }
    },

    async update(ctx: AuditContext, id: string, input: CreateProductInput) {
        try {
            return await withTransaction(async (tx) => {
                const existing = await tx.product.findUnique({ where: { id } });
                if (!existing) throw new NotFoundError("Produk");

                const product = await tx.product.update({
                    where: { id },
                    data: {
                        sku: input.sku,
                        barcode: input.barcode || null,
                        name: input.name,
                        description: input.description || null,
                        categoryId: input.categoryId ?? null,
                        brandId: input.brandId ?? null,
                        unitId: input.unitId ?? null,
                        purchasePrice: toMoney(input.purchasePrice),
                        sellingPrice: toMoney(input.sellingPrice),
                        minimumStock: toMoney(input.minimumStock),
                        taxRate: toMoney(input.taxRate ?? "0"),
                        ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
                    },
                });
                await writeAudit(tx, ctx, "PRODUCT_UPDATE", "Product", id, existing, product);
                return product;
            });
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictError("SKU atau barcode sudah digunakan");
            }
            throw error;
        }
    },

    async setStatus(ctx: AuditContext, id: string, status: "ACTIVE" | "ARCHIVED") {
        return withTransaction(async (tx) => {
            const existing = await tx.product.findUnique({ where: { id } });
            if (!existing) throw new NotFoundError("Produk");

            const product = await tx.product.update({ where: { id }, data: { status } });
            await writeAudit(
                tx,
                ctx,
                status === "ARCHIVED" ? "PRODUCT_ARCHIVE" : "PRODUCT_RESTORE",
                "Product",
                id,
                { status: existing.status },
                { status },
            );
            return product;
        });
    },

        async upsertBySku(ctx: AuditContext, input: CreateProductInput): Promise<"created" | "updated"> {
        return withTransaction(async (tx) => {
            const data = {
                sku: input.sku,
                barcode: input.barcode || null,
                name: input.name,
                description: input.description || null,
                categoryId: input.categoryId || null,
                brandId: input.brandId || null,
                unitId: input.unitId || null,
                purchasePrice: toMoney(input.purchasePrice),
                sellingPrice: toMoney(input.sellingPrice),
                minimumStock: toMoney(input.minimumStock),
                taxRate: toMoney(input.taxRate ?? "0"),
                ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
            };
            const existing = await tx.product.findUnique({ where: { sku: input.sku } });
            if (existing) {
                await tx.product.update({ where: { id: existing.id }, data });
                await writeAudit(tx, ctx, "PRODUCT_UPDATE", "Product", existing.id, existing, data);
                return "updated";
            }
            const created = await tx.product.create({ data });
            await writeAudit(tx, ctx, "PRODUCT_CREATE", "Product", created.id, null, created);
            return "created";
        });
    },

    // Read-only — langsung repository, tanpa transaksi
    list: productRepository.list,
    listAllForExport: productRepository.listAllForExport,
    findById: productRepository.findById,
    findCategoryByName: (name: string) =>
        prisma.category.findFirst({ where: { name, isActive: true }, select: { id: true } }),
};