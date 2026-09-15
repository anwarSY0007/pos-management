"use server";

import { revalidatePath } from "next/cache";
import type { ActionResponse } from "@/types/api";
import { authorize } from "@/lib/permissions/authorize";
import { toActionResponse } from "@/lib/errors";
import { parseOrThrow } from "@/lib/utils/parse-or-throw";
import { purchaseService } from "@/services/purchase.service";
import {
  createPurchaseSchema,
  receivePurchaseSchema,
} from "@/schema/purchase.schema";

export async function createPurchase(
  input: unknown,
  orderNow = false,
): Promise<ActionResponse<{ id: string }>> {
  try {
    const data = parseOrThrow(createPurchaseSchema, input);
    const ctx = await authorize("purchase.create");
    const purchase = await purchaseService.create(ctx, data, orderNow);
    revalidatePath("/purchases");
    return { success: true, data: { id: purchase.id } };
  } catch (error) {
    return toActionResponse(error);
  }
}

export async function orderPurchase(id: string): Promise<ActionResponse<null>> {
  try {
    const ctx = await authorize("purchase.update");
    await purchaseService.order(ctx, id);
    revalidatePath("/purchases");
    revalidatePath(`/purchases/${id}`);
    return { success: true, data: null };
  } catch (error) {
    return toActionResponse(error);
  }
}

export async function receivePurchase(
  input: unknown,
): Promise<ActionResponse<null>> {
  try {
    const data = parseOrThrow(receivePurchaseSchema, input);
    const ctx = await authorize("purchase.receive");
    await purchaseService.receive(ctx, data);
    revalidatePath("/purchases");
    revalidatePath("/inventory");
    revalidatePath("/inventory/movements");
    return { success: true, data: null };
  } catch (error) {
    return toActionResponse(error);
  }
}

export async function cancelPurchase(
  id: string,
): Promise<ActionResponse<null>> {
  try {
    const ctx = await authorize("purchase.cancel");
    await purchaseService.cancel(ctx, id);
    revalidatePath("/purchases");
    return { success: true, data: null };
  } catch (error) {
    return toActionResponse(error);
  }
}
