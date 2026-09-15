import { z } from "zod";

export const createCategorySchema = z.object({
    name: z.string().trim().min(1, "Nama kategori wajib").max(100),
    description: z.string().trim().max(500).optional().or(z.literal("")),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;