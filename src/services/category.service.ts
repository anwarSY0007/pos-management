import { ConflictError, isUniqueViolation } from "@/lib/errors";
import { writeAudit, type AuditContext } from "@/lib/audit";
import prisma, { withTransaction } from "@/lib/db";
import type { CreateCategoryInput } from "@/schema/category.schema";

export const categoryService = {
    async create(ctx: AuditContext, input: CreateCategoryInput) {
        try {
            return await withTransaction(async (tx) => {
                const category = await tx.category.create({
                    data: { name: input.name, description: input.description || null },
                });
                await writeAudit(tx, ctx, "CATEGORY_CREATE", "Category", category.id, null, category);
                return category;
            });
        } catch (error) {
            if (isUniqueViolation(error)) throw new ConflictError("Nama kategori sudah ada");
            throw error;
        }
    },

    list() {
        return prisma.category.findMany({
            orderBy: { name: "asc" },
            where: { isActive: true },
            select: { id: true, name: true },
        });
    },
};