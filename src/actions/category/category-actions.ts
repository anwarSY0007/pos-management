"use server";

import { revalidatePath } from "next/cache";
import type { ActionResponse } from "@/types/api";
import { authorize } from "@/lib/permissions/authorize";
import { ValidationError, toActionResponse } from "@/lib/errors";
import { categoryService } from "@/services/category.service";
import { createCategorySchema } from "@/schema/category.schema";

export async function createCategory(
    input: unknown,
): Promise<ActionResponse<{ id: string }>> {
    try {
        const parsed = createCategorySchema.safeParse(input);
        if (!parsed.success) {
            throw new ValidationError(parsed.error.issues[0]?.message ?? "Data tidak valid");
        }
        const ctx = await authorize("category.create");
        const category = await categoryService.create(ctx, parsed.data);
        revalidatePath("/categories");
        revalidatePath("/products");
        return { success: true, data: { id: category.id } };
    } catch (error) {
        return toActionResponse(error);
    }
}