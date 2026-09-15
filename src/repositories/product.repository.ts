import type { Prisma } from "@/lib/generated/prisma/client";
import prisma from "@/lib/db";
import type { ProductListParams } from "@/schema/product.schema";

const PRODUCT_INCLUDE = {
    category: { select: { id: true, name: true } },
    brand: { select: { id: true, name: true } },
    unit: { select: { id: true, name: true, symbol: true } },
} satisfies Prisma.ProductInclude;

export const productRepository = {
    async list(params: ProductListParams) {
        const where: Prisma.ProductWhereInput = {
            status: params.status === "ALL" ? undefined : params.status,
            categoryId: params.categoryId ?? undefined,
            ...(params.q
                ? {
                      OR: [
                          { name: { contains: params.q, mode: "insensitive" } },
                          { sku: { contains: params.q, mode: "insensitive" } },
                          { barcode: params.q }, // barcode exact match
                      ],
                  }
                : {}),
        };

        const orderBy = { [params.sort]: params.dir } as Prisma.ProductOrderByWithRelationInput;

        const [items, total] = await prisma.$transaction([
            prisma.product.findMany({
                where,
                orderBy,
                skip: (params.page - 1) * params.pageSize,
                take: params.pageSize,
                include: PRODUCT_INCLUDE,
            }),
            prisma.product.count({ where }),
        ]);

        return {
            items,
            total,
            page: params.page,
            pageSize: params.pageSize,
            pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
        };
    },

    async listAllForExport(status: "ACTIVE" | "ARCHIVED" | "ALL") {
        return prisma.product.findMany({
            where: status === "ALL" ? undefined : { status },
            include: PRODUCT_INCLUDE,
            orderBy: { sku: "asc" },
            take: 10_000, // batas aman export; import/bulk menyusul
        });
    },

    findById(id: string) {
        return prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
    },

    create(tx: TxOrDb, data: Prisma.ProductCreateInput) {
        return tx.product.create({ data });
    },

    update(tx: TxOrDb, id: string, data: Prisma.ProductUpdateInput) {
        return tx.product.update({ where: { id }, data });
    },
};

// tx ATAU prisma global (untuk read-only list tidak butuh tx)
type TxOrDb = Parameters<Parameters<typeof prisma.$transaction>[0]>[0] | typeof prisma;