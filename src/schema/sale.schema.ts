import { z } from "zod";
import { moneyString, qtyString, optionalText } from "@/schema/shared";

export const PAYMENT_METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "QRIS",
  "DEBIT",
  "CREDIT",
  "E_WALLET",
] as const;

export const checkoutSchema = z.object({
  requestId: z.uuid(), // D28: idempotency key — client generate UUID per pengiriman cart
  customerId: z.uuid().optional(),
  note: optionalText(500),
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        quantity: qtyString,
        discount: moneyString.optional(), // per baris — di-clamp server (D29)
      }),
    )
    .min(1, "Keranjang kosong"),
  saleDiscount: moneyString.optional(),
  payments: z
    .array(
      z.object({
        method: z.enum(PAYMENT_METHODS),
        amount: moneyString,
        reference: optionalText(100),
      }),
    )
    .max(5)
    .default([]), // aman: bukan form RHF — POS kirim objek mentah
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
