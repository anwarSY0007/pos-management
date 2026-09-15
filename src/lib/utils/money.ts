// import "server-only";

import { Prisma } from "../generated/prisma/client";

/**
 * SATU-SATUNYA tempat aturan uang.
 * DILARANG menghitung uang dengan number biasa (floating point).
 */

export type Money = Prisma.Decimal;

export function toMoney(value: string | number | Money): Money {
  // number → string dulu, hindari artifact float (0.1 + 0.2 problem)
  return new Prisma.Decimal(
    typeof value === "number" ? value.toString() : value,
  );
}

export function roundMoney(value: Money): Money {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function moneySum(values: Money[]): Money {
  return values.reduce((acc, v) => acc.plus(v), toMoney(0));
}

/** Display-only (Intl butuh number). Simpan/Hitung SELALU pakai Money. */
// describe("formatIDR (client-safe display)", () => {
//   it("string dari DB dan number menghasilkan format sama", () => {
//     expect(formatIDR("15000")).toBe(formatIDR(15000));
//     expect(formatIDR("15000")).toContain("15.000");
//   });
// });
