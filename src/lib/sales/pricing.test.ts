import { describe, expect, it } from "vitest";
import { allocatePayments, computeCart } from "@/lib/sales/pricing";
import { toMoney } from "@/lib/utils/money";

const line = (price: string, qty: string, disc = "0", tax = "0") => ({
  unitPrice: toMoney(price),
  quantity: toMoney(qty),
  discount: toMoney(disc),
  taxRate: toMoney(tax),
});

describe("computeCart (server-side pricing)", () => {
  it("satu baris tanpa pajak", () => {
    const r = computeCart([line("4000", "3")], toMoney(0));
    expect(r.subtotal.toFixed(2)).toBe("12000.00");
    expect(r.tax.toFixed(2)).toBe("0.00");
    expect(r.grandTotal.toFixed(2)).toBe("12000.00");
  });

  it("PPN 11% exclusive dihitung per baris lalu dijumlah", () => {
    const r = computeCart([line("10000", "1", "0", "11")], toMoney(0));
    expect(r.subtotal.toFixed(2)).toBe("10000.00");
    expect(r.tax.toFixed(2)).toBe("1100.00");
    expect(r.grandTotal.toFixed(2)).toBe("11100.00");
  });

  it("line discount di-clamp tidak melebihi harga×qty", () => {
    const r = computeCart([line("4000", "1", "99999")], toMoney(0));
    expect(r.lines[0]!.lineSubtotal.toFixed(2)).toBe("0.00");
  });

  it("sale discount di-clamp terhadap subtotal (tidak bikin total minus)", () => {
    const r = computeCart([line("4000", "2")], toMoney("99999"));
    expect(r.discount.toFixed(2)).toBe("8000.00");
    expect(r.grandTotal.toFixed(2)).toBe("0.00");
  });

  it("sale discount tidak memotong dasar pajak per baris (dokumentasi perilaku D31)", () => {
    const r = computeCart([line("10000", "1", "0", "11")], toMoney("2000"));
    expect(r.tax.toFixed(2)).toBe("1100.00");
    expect(r.grandTotal.toFixed(2)).toBe("9100.00");
  });

  it("multi-baris: subtotal, tax, grand akurat", () => {
    const r = computeCart(
      [
        line("4000", "2", "0", "11"),
        line("3500", "1"),
        line("9500", "3", "500"),
      ],
      toMoney("1000"),
    );
    expect(r.subtotal.toFixed(2)).toBe("39500.00");
    expect(r.tax.toFixed(2)).toBe("880.00");
    expect(r.grandTotal.toFixed(2)).toBe("39380.00");
  });

  it("cart kosong → error", () => {
    expect(() => computeCart([], toMoney(0))).toThrow();
  });

  it("qty ≤ 0 → error", () => {
    expect(() => computeCart([line("4000", "0")], toMoney(0))).toThrow();
  });
});

describe("allocatePayments", () => {
  const pay = (method: string, amount: string) => ({
    method,
    amount: toMoney(amount),
  });

  it("tunai lebih → kembalian benar, paid = total", () => {
    const r = allocatePayments([pay("CASH", "50000")], toMoney("35000"));
    expect(r.effectivePaid.toFixed(2)).toBe("35000.00");
    expect(r.change.toFixed(2)).toBe("15000.00");
    expect(r.ar.toFixed(2)).toBe("0.00");
  });

  it("campuran tunai + QRIS", () => {
    const r = allocatePayments(
      [pay("CASH", "10000"), pay("QRIS", "20000")],
      toMoney("35000"),
    );
    expect(r.bankNet.toFixed(2)).toBe("20000.00");
    expect(r.cashNet.toFixed(2)).toBe("10000.00");
    expect(r.change.toFixed(2)).toBe("0.00");
    expect(r.ar.toFixed(2)).toBe("5000.00");
  });

  it("non-tunai melebihi total → OVERPAYMENT", () => {
    expect(() =>
      allocatePayments([pay("DEBIT", "40000")], toMoney("35000")),
    ).toThrow("OVERPAYMENT");
  });

  it("bayar kurang → ar = sisa", () => {
    const r = allocatePayments([pay("CASH", "10000")], toMoney("35000"));
    expect(r.ar.toFixed(2)).toBe("25000.00");
  });
});