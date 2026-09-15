import { toMoney, roundMoney, moneySum, type Money } from "@/lib/utils/money";

export type CartLineInput = {
  unitPrice: Money; // dari DB (server)
  taxRate: Money; // dari DB, persen
  quantity: Money; // dari client (tervalidasi > 0)
  discount: Money; // dari client (di-clamp)
};

export type PricedLine = CartLineInput & {
  lineSubtotal: Money; // qty×price − disc
  lineTax: Money; // PPN exclusive
};

export type CartTotals = {
  lines: PricedLine[];
  subtotal: Money;
  discount: Money; // sale-level setelah clamp
  tax: Money;
  grandTotal: Money;
};

const minMoney = (a: Money, b: Money) => (a.lte(b) ? a : b);



/** D29/D31 — SEMUA angka final ditentukan di sini, di server. */
export function computeCart(
  items: CartLineInput[],
  saleDiscountInput: Money,
): CartTotals {
  if (items.length === 0) {
    throw new Error("Cart kosong");
  }

  const lines: PricedLine[] = items.map((it) => {
    if (it.quantity.lte(0)) throw new Error("Kuantitas harus > 0");
    if (it.discount.lt(0)) throw new Error("Diskon tidak boleh negatif");

    const gross = it.unitPrice.mul(it.quantity);
    const disc = minMoney(it.discount, gross); // clamp: disc ≤ harga×qty
    const lineSubtotal = roundMoney(gross.minus(disc));
    const lineTax = roundMoney(lineSubtotal.mul(it.taxRate).div(100));

    return { ...it, discount: disc, lineSubtotal, lineTax };
  });

  const subtotal = moneySum(lines.map((l) => l.lineSubtotal));
  const discount = minMoney(
    saleDiscountInput.lt(0) ? toMoney(0) : saleDiscountInput,
    subtotal,
  );
  const tax = moneySum(lines.map((l) => l.lineTax));
  const grandTotal = subtotal.minus(discount).plus(tax);

  return { lines, subtotal, discount, tax, grandTotal };
}
