import { z } from "zod";
import { qtyString, optionalText } from "@/schema/shared";

export const initializeStockSchema = z.object({
  productId: z.uuid(),
  qty: qtyString,
  note: optionalText(500),
});
export type InitializeStockInput = z.infer<typeof initializeStockSchema>;

export const adjustStockSchema = z.object({
  productId: z.uuid(),
  direction: z.enum(["IN", "OUT"]),
  qty: qtyString,
  note: z.string().trim().min(1, "Alasan penyesuaian wajib diisi").max(500),
});
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export const stockOverviewSchema = z.object({
  q: z.string().trim().max(100).optional(),
  filter: z.enum(["all", "low"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(15),
});
export type StockOverviewParams = z.infer<typeof stockOverviewSchema>;

export const movementListSchema = z.object({
  q: z.string().trim().max(100).optional(),
  type: z
    .enum([
      "PURCHASE",
      "SALE",
      "SALE_RETURN",
      "PURCHASE_RETURN",
      "ADJUSTMENT_IN",
      "ADJUSTMENT_OUT",
      "TRANSFER_IN",
      "TRANSFER_OUT",
      "INITIAL_STOCK",
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
});
export type MovementListParams = z.infer<typeof movementListSchema>;

export const createTransferSchema = z.object({
    toBranchId: z.uuid(),
    note: optionalText(500),
    items: z
        .array(z.object({ productId: z.uuid(), qty: qtyString }))
        .min(1, "Minimal 1 produk"),
});
export type CreateTransferInput = z.infer<typeof createTransferSchema>;

export const createOpnameSchema = z.object({
    note: optionalText(500),
    productIds: z.array(z.uuid()).min(1, "Pilih minimal 1 produk"),
});
export type CreateOpnameInput = z.infer<typeof createOpnameSchema>;

export const completeOpnameSchema = z.object({
    id: z.uuid(),
    items: z
        .array(z.object({ itemId: z.uuid(), countedQty: qtyString }))
        .min(1),
});
export type CompleteOpnameInput = z.infer<typeof completeOpnameSchema>;

export const transferListSchema = z.object({
    status: z.enum(["IN_TRANSIT", "RECEIVED", "CANCELLED", "ALL"]).default("ALL"),
});
export type TransferListParams = z.infer<typeof transferListSchema>;

export const opnameListSchema = z.object({
    status: z.enum(["DRAFT", "COMPLETED", "ALL"]).default("ALL"),
});
export type OpnameListParams = z.infer<typeof opnameListSchema>;