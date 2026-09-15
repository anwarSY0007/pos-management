"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import type { ActionResponse } from "@/types/api";
import { authorize } from "@/lib/permissions/authorize";
import { ValidationError, toActionResponse } from "@/lib/errors";
import { supplierService } from "@/services/supplier.service";
import { createSupplierSchema, updateSupplierSchema } from "@/schema/party.schema";

function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
        throw new ValidationError(
            parsed.error.issues[0]?.message ?? "Data tidak valid",
        );
    }
    return parsed.data;
}

export async function createSupplier(
    input: unknown,
): Promise<ActionResponse<{ id: string }>> {
    try {
        const data = parseOrThrow(createSupplierSchema, input);
        const ctx = await authorize("supplier.create");
        const supplier = await supplierService.create(ctx, data);
        revalidatePath("/suppliers");
        return { success: true, data: { id: supplier.id } };
    } catch (error) {
        return toActionResponse(error);
    }
}

export async function updateSupplier(
    id: string,
    input: unknown,
): Promise<ActionResponse<{ id: string }>> {
    try {
        const data = parseOrThrow(updateSupplierSchema, input);
        const ctx = await authorize("supplier.update");
        await supplierService.update(ctx, id, data);
        revalidatePath("/suppliers");
        return { success: true, data: { id } };
    } catch (error) {
        return toActionResponse(error);
    }
}

export async function setSupplierStatus(
    id: string,
    status: "ACTIVE" | "INACTIVE",
): Promise<ActionResponse<null>> {
    try {
        const ctx = await authorize("supplier.delete"); // soft-delete (D13)
        await supplierService.setStatus(ctx, id, status);
        revalidatePath("/suppliers");
        return { success: true, data: null };
    } catch (error) {
        return toActionResponse(error);
    }
}