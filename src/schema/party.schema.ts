import { z } from "zod";
import { moneyString, optionalText } from "@/schema/shared";

const emailText = optionalText(200).refine(
    (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    "Email tidak valid",
);

export const createCustomerSchema = z.object({
    name: z.string().trim().min(1, "Nama wajib diisi").max(200),
    phone: optionalText(30),
    email: emailText,
    address: optionalText(500),
    creditLimit: moneyString.optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export const updateCustomerSchema = createCustomerSchema;

export const createSupplierSchema = z.object({
    name: z.string().trim().min(1, "Nama wajib diisi").max(200),
    phone: optionalText(30),
    email: emailText,
    address: optionalText(500),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export const updateSupplierSchema = createSupplierSchema;

export const partyListSchema = z.object({
    q: z.string().trim().max(100).optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "ALL"]).default("ACTIVE"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(5).max(100).default(10),
});

export type PartyListParams = z.infer<typeof partyListSchema>;