"use server";

import { revalidatePath } from "next/cache";
import type { ActionResponse } from "@/types/api";
import { authorize } from "@/lib/permissions/authorize";
import { toActionResponse } from "@/lib/errors";
import { parseOrThrow } from "@/lib/utils/parse-or-throw";
import { inventoryService } from "@/services/inventory.service";
import {
  createOpnameSchema,
  completeOpnameSchema,
} from "@/schema/inventory.schema";

export async function createOpname(
  input: unknown,
): Promise<ActionResponse<{ id: string }>> {
  try {
    const data = parseOrThrow(createOpnameSchema, input);
    const ctx = await authorize("inventory.opname");
    const opname = await inventoryService.createOpname(ctx, data);
    revalidatePath("/inventory/opnames");
    return { success: true, data: { id: opname.id } };
  } catch (error) {
    return toActionResponse(error);
  }
}

export async function completeOpname(
  input: unknown,
): Promise<ActionResponse<null>> {
  try {
    const data = parseOrThrow(completeOpnameSchema, input);
    const ctx = await authorize("inventory.opname");
    await inventoryService.completeOpname(ctx, data);
    revalidatePath("/inventory/opnames");
    revalidatePath("/inventory");
    revalidatePath("/inventory/movements");
    return { success: true, data: null };
  } catch (error) {
    return toActionResponse(error);
  }
}
