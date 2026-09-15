import { describe, expect, it } from "vitest";
import { formatDocumentNumber } from "@/lib/utils/sequence";

describe("document number format", () => {
    it("format DOC-BRANCH-YYYYMM-0001", () => {
        expect(formatDocumentNumber("INV", "PST", "202602", 1)).toBe("INV-PST-202602-0001");
    });

    it("padding 4 digit", () => {
        expect(formatDocumentNumber("INV", "PST", "202602", 7)).toBe("INV-PST-202602-0007");
    });

    it("melewati 9999 tetap benar", () => {
        expect(formatDocumentNumber("PUR", "JKT01", "202601", 12345)).toBe("PUR-JKT01-202601-12345");
    });
});