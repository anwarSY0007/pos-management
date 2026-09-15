"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import type { ActionResponse } from "@/types/api";
import { authorize } from "@/lib/permissions/authorize";
import { ValidationError, toActionResponse } from "@/lib/errors";
import { productService } from "@/services/product.service";
import {
    createProductSchema,
    updateProductSchema,
} from "@/schema/product.schema";

function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
        throw new ValidationError(
            parsed.error.issues[0]?.message ?? "Data tidak valid",
        );
    }
    return parsed.data;
}

export async function createProduct(
    input: unknown,
): Promise<ActionResponse<{ id: string }>> {
    try {
        const data = parseOrThrow(createProductSchema, input);
        const ctx = await authorize("product.create");
        const product = await productService.create(ctx, data);
        revalidatePath("/products");
        return { success: true, data: { id: product.id } };
    } catch (error) {
        return toActionResponse(error);
    }
}

export async function updateProduct(
    id: string,
    input: unknown,
): Promise<ActionResponse<{ id: string }>> {
    try {
        const data = parseOrThrow(updateProductSchema, input);
        const ctx = await authorize("product.update");
        const product = await productService.update(ctx, id, data);
        revalidatePath("/products");
        revalidatePath(`/products/${id}/edit`);
        return { success: true, data: { id: product.id } };
    } catch (error) {
        return toActionResponse(error);
    }
}

export async function setProductStatus(
    id: string,
    status: "ACTIVE" | "ARCHIVED",
): Promise<ActionResponse<null>> {
    try {
        const ctx = await authorize("product.archive");
        await productService.setStatus(ctx, id, status);
        revalidatePath("/products");
        return { success: true, data: null };
    } catch (error) {
        return toActionResponse(error);
    }
}