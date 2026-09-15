"use server";

import { revalidatePath } from "next/cache";
import type { ActionResponse } from "@/types/api";
import { authorize } from "@/lib/permissions/authorize";
import { toActionResponse } from "@/lib/errors";
import { parseOrThrow } from "@/lib/utils/parse-or-throw";
import { inventoryService } from "@/services/inventory.service";
import {
  initializeStockSchema,
  adjustStockSchema,
} from "@/schema/inventory.schema";

export async function initializeStock(
  input: unknown,
): Promise<ActionResponse<null>> {
  try {
    const data = parseOrThrow(initializeStockSchema, input);
    const ctx = await authorize("inventory.adjust"); // D19: stok awal = kategori adjustment
    await inventoryService.initializeStock(ctx, data);
    revalidatePath("/inventory");
    revalidatePath("/inventory/movements");
    return { success: true, data: null };
  } catch (error) {
    return toActionResponse(error);
  }
}

export async function adjustStock(
  input: unknown,
): Promise<ActionResponse<null>> {
  try {
    const data = parseOrThrow(adjustStockSchema, input);
    const ctx = await authorize("inventory.adjust");
    await inventoryService.adjust(ctx, data);
    revalidatePath("/inventory");
    revalidatePath("/inventory/movements");
    return { success: true, data: null };
  } catch (error) {
    return toActionResponse(error);
  }
}
