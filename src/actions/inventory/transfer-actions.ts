"use server";

import { revalidatePath } from "next/cache";
import type { ActionResponse } from "@/types/api";
import { authorize } from "@/lib/permissions/authorize";
import { toActionResponse } from "@/lib/errors";
import { parseOrThrow } from "@/lib/utils/parse-or-throw";
import { inventoryService } from "@/services/inventory.service";
import { createTransferSchema } from "@/schema/inventory.schema";

export async function sendTransfer(
  input: unknown,
): Promise<ActionResponse<{ id: string }>> {
  try {
    const data = parseOrThrow(createTransferSchema, input);
    const ctx = await authorize("inventory.transfer");
    const transfer = await inventoryService.sendTransfer(ctx, data);
    revalidatePath("/inventory/transfers");
    revalidatePath("/inventory");
    return { success: true, data: { id: transfer.id } };
  } catch (error) {
    return toActionResponse(error);
  }
}

export async function receiveTransfer(
  id: string,
): Promise<ActionResponse<null>> {
  try {
    const ctx = await authorize("inventory.transfer");
    await inventoryService.receiveTransfer(ctx, id);
    revalidatePath("/inventory/transfers");
    revalidatePath("/inventory");
    return { success: true, data: null };
  } catch (error) {
    return toActionResponse(error);
  }
}

export async function cancelTransfer(
  id: string,
): Promise<ActionResponse<null>> {
  try {
    const ctx = await authorize("inventory.transfer");
    await inventoryService.cancelTransfer(ctx, id);
    revalidatePath("/inventory/transfers");
    revalidatePath("/inventory");
    return { success: true, data: null };
  } catch (error) {
    return toActionResponse(error);
  }
}
