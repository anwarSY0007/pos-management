import { describe, expect, it } from "vitest";
import { moneySum, roundMoney, toMoney } from "@/lib/utils/money";
import { formatIDR } from "./format";

describe("money (Decimal)", () => {
  it("0.1 + 0.2 = 0.3 tanpa floating point artifact", () => {
    expect(0.1 + 0.2).not.toBe(0.3); // bukti masalah float
    expect(toMoney("0.1").plus(toMoney("0.2")).toString()).toBe("0.3");
  });

  it("rounding HALF_UP: 2.675 → 2.68 (toFixed float akan salah → 2.67)", () => {
    expect(roundMoney(toMoney("2.675")).toString()).toBe("2.68");
  });

  it("perkalian harga × qty presisi", () => {
    expect(toMoney("15000").mul(toMoney("3")).toString()).toBe("45000");
    expect(toMoney("10500.55").mul(toMoney("2")).toFixed(2)).toBe("21001.10");
  });

  it("moneySum menjumlahkan tanpa kehilangan presisi", () => {
    const total = moneySum([toMoney("0.1"), toMoney("0.2"), toMoney("0.7")]);
    expect(total.toString()).toBe("1");
  });

  it("number input dikonversi via string (tanpa artifact)", () => {
    expect(toMoney(0.1).plus(toMoney(0.2)).toString()).toBe("0.3");
  });

  it("formatIDR menampilkan tanpa desimal", () => {
    expect(formatIDR(toMoney("15000"))).toContain("15.000");
  });
});
