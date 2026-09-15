import { z } from "zod";
import { moneyString, qtyString, optionalText } from "@/schema/shared";

export const createPurchaseSchema = z.object({
  supplierId: z.uuid(),
  note: optionalText(500),
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        qty: qtyString,
        unitCost: moneyString, // D40: harga per-PO
      }),
    )
    .min(1, "Minimal 1 item"),
});
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;

export const receivePurchaseSchema = z.object({
  id: z.uuid(),
  items: z
    .array(z.object({ itemId: z.uuid(), qty: qtyString }))
    .min(1, "Minimal 1 item diterima"),
});
export type ReceivePurchaseInput = z.infer<typeof receivePurchaseSchema>;

export const purchaseListSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z
    .enum(["DRAFT", "ORDERED", "PARTIAL", "RECEIVED", "CANCELLED", "ALL"])
    .default("ALL"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(15),
});
export type PurchaseListParams = z.infer<typeof purchaseListSchema>;
