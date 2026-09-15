import { describe, expect, it } from "vitest";
import { csvEscape, toCsv } from "@/lib/utils/csv";

describe("csv", () => {
    it("escape koma, quote, newline", () => {
        expect(csvEscape("a,b")).toBe('"a,b"');
        expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
        expect(csvEscape("baris\nbaru")).toBe('"baris\nbaru"');
        expect(csvEscape("normal")).toBe("normal");
        expect(csvEscape(null)).toBe("");
    });

    it("toCsv menghasilkan header + baris CRLF", () => {
        const csv = toCsv(["a", "b"], [["1", "x,y"]]);
        expect(csv).toBe('a,b\r\n1,"x,y"\r\n');
    });
});