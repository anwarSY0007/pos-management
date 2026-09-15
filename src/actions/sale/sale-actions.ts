"use server";

import { revalidatePath } from "next/cache";
import type { ActionResponse } from "@/types/api";
import { authorize } from "@/lib/permissions/authorize";
import { toActionResponse } from "@/lib/errors";
import { parseOrThrow } from "@/lib/utils/parse-or-throw";
import { saleService } from "@/services/sale.service";
import { checkoutSchema } from "@/schema/sale.schema";

export async function checkoutSale(
  input: unknown,
): Promise<ActionResponse<{ id: string; invoiceNumber: string }>> {
  try {
    const data = parseOrThrow(checkoutSchema, input);
    const ctx = await authorize("sale.create");
    const sale = await saleService.checkout(ctx, data);
    revalidatePath("/pos");
    revalidatePath("/sales");
    revalidatePath("/inventory");
    return {
      success: true,
      data: { id: sale.id, invoiceNumber: sale.invoiceNumber },
    };
  } catch (error) {
    return toActionResponse(error);
  }
}

export async function cancelSale(id: string): Promise<ActionResponse<null>> {
  try {
    const ctx = await authorize("sale.cancel");
    await saleService.cancel(ctx, id);
    revalidatePath("/sales");
    revalidatePath("/inventory");
    return { success: true, data: null };
  } catch (error) {
    return toActionResponse(error);
  }
}
