"use server";

import { revalidatePath } from "next/cache";
import type { ActionResponse } from "@/types/api";
import { authorize } from "@/lib/permissions/authorize";
import { toActionResponse } from "@/lib/errors";
import { parseOrThrow } from "@/lib/utils/parse-or-throw";
import { customerService } from "@/services/customer.service";
import { createCustomerSchema, updateCustomerSchema } from "@/schema/party.schema";

export async function createCustomer(input: unknown): Promise<ActionResponse<{ id: string }>> {
    try {
        const data = parseOrThrow(createCustomerSchema, input);
        const ctx = await authorize("customer.create");
        const customer = await customerService.create(ctx, data);
        revalidatePath("/customers");
        return { success: true, data: { id: customer.id } };
    } catch (error) {
        return toActionResponse(error);
    }
}

export async function updateCustomer(id: string, input: unknown): Promise<ActionResponse<{ id: string }>> {
    try {
        const data = parseOrThrow(updateCustomerSchema, input);
        const ctx = await authorize("customer.update");
        await customerService.update(ctx, id, data);
        revalidatePath("/customers");
        return { success: true, data: { id } };
    } catch (error) {
        return toActionResponse(error);
    }
}

export async function setCustomerStatus(id: string, status: "ACTIVE" | "INACTIVE"): Promise<ActionResponse<null>> {
    try {
        const ctx = await authorize("customer.delete");
        await customerService.setStatus(ctx, id, status);
        revalidatePath("/customers");
        return { success: true, data: null };
    } catch (error) {
        return toActionResponse(error);
    }
}