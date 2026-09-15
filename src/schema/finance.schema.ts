import { z } from "zod";
import { moneyString, optionalText } from "@/schema/shared";
import { PAYMENT_METHODS } from "@/schema/sale.schema";

export const createCashAccountSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib").max(100),
  type: z.enum(["CASH", "BANK"]),
  accountNumber: optionalText(50),
  openingBalance: moneyString.optional(),
});
export type CreateCashAccountInput = z.infer<typeof createCashAccountSchema>;

export const transferCashSchema = z
  .object({
    fromAccountId: z.uuid(),
    toAccountId: z.uuid(),
    amount: moneyString,
    note: optionalText(200),
  })
  .refine((v) => v.fromAccountId !== v.toAccountId, {
    message: "Akun asal dan tujuan harus berbeda",
    path: ["toAccountId"],
  });
export type TransferCashInput = z.infer<typeof transferCashSchema>;

export const adjustCashSchema = z.object({
  accountId: z.uuid(),
  direction: z.enum(["IN", "OUT"]),
  amount: moneyString,
  note: z.string().trim().min(1, "Alasan penyesuaian wajib").max(200),
});
export type AdjustCashInput = z.infer<typeof adjustCashSchema>;

export const createExpenseSchema = z.object({
  accountId: z.uuid(),
  expenseAccount: z.string().regex(/^6-\d{4}$/, "Pilih akun beban (6-xxxx)"),
  category: z.string().trim().min(1, "Kategori wajib").max(100),
  description: optionalText(500),
  amount: moneyString,
  expenseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal format YYYY-MM-DD"),
  note: optionalText(500),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const payReceivableSchema = z.object({
  receivableId: z.uuid(),
  accountId: z.uuid(),
  method: z.enum(PAYMENT_METHODS),
  amount: moneyString,
  reference: optionalText(100),
});
export type PayReceivableInput = z.infer<typeof payReceivableSchema>;

export const payPayableSchema = z.object({
  payableId: z.uuid(),
  accountId: z.uuid(),
  method: z.enum(PAYMENT_METHODS),
  amount: moneyString,
  reference: optionalText(100),
});
export type PayPayableInput = z.infer<typeof payPayableSchema>;

export const cashTransactionListSchema = z.object({
  accountId: z.uuid().optional(),
  type: z
    .enum([
      "SALE",
      "PURCHASE",
      "EXPENSE",
      "RECEIVABLE_PAYMENT",
      "PAYABLE_PAYMENT",
      "TRANSFER",
      "ADJUSTMENT",
      "OTHER",
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
});
export type CashTransactionListParams = z.infer<
  typeof cashTransactionListSchema
>;
