import { describe, expect, it } from "vitest";
import { createProductSchema, productListSchema } from "@/schema/product.schema";

const valid = {
    sku: "SKU-0001", name: "Test", purchasePrice: "2500",
    sellingPrice: "4000", minimumStock: "10", taxRate: "11",
};

describe("createProductSchema", () => {
    it("menerima input valid", () => {
        expect(createProductSchema.safeParse(valid).success).toBe(true);
    });

    it("menolak money string dengan >2 desimal atau non-angka", () => {
        expect(createProductSchema.safeParse({ ...valid, purchasePrice: "2500.999" }).success).toBe(false);
        expect(createProductSchema.safeParse({ ...valid, purchasePrice: "abc" }).success).toBe(false);
        expect(createProductSchema.safeParse({ ...valid, purchasePrice: "-5" }).success).toBe(false);
    });

    it("menolak sellingPrice = 0", () => {
        expect(createProductSchema.safeParse({ ...valid, sellingPrice: "0" }).success).toBe(false);
    });

    it("taxRate opsional — boleh tidak dikirim", () => {
      const withoutTax: Record<string, string> = { ...valid };
      delete withoutTax.taxRate;
      const parsed = createProductSchema.parse(withoutTax);
      expect(parsed.taxRate).toBeUndefined();
    });
});

describe("productListSchema (searchParams mentah dari URL)", () => {
    it("koersi string → number dan default", () => {
        const parsed = productListSchema.parse({ page: "2", pageSize: "25" });
        expect(parsed.page).toBe(2);
        expect(parsed.pageSize).toBe(25);
        expect(parsed.status).toBe("ACTIVE");
    });

    it("menolak pageSize > 100", () => {
        expect(productListSchema.safeParse({ pageSize: "500" }).success).toBe(false);
    });
});