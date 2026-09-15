"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { checkoutSale } from "@/actions/sale/sale-actions";
import { formatIDR } from "@/lib/utils/format";

type PosProduct = {
  id: string;
  sku: string;
  name: string;
  barcode: string | null;
  price: string;
  taxRate: string;
  unit: string;
  stock: string | null;
};
type PosCustomer = { id: string; name: string; creditLimit: string };
type CartLine = {
  productId: string;
  name: string;
  sku: string;
  unitPrice: string;
  taxRate: string;
  quantity: string;
  discount: string;
};

const PAYMENT_METHODS = [
  { value: "CASH", label: "Tunai" },
  { value: "QRIS", label: "QRIS" },
  { value: "DEBIT", label: "Kartu Debit" },
  { value: "BANK_TRANSFER", label: "Transfer" },
  { value: "E_WALLET", label: "E-Wallet" },
  { value: "CREDIT", label: "Kredit" },
] as const;

// Decimal via string aritmetika ringan di client HANYA untuk display preview;
// angka final tetap dihitung server (D29). Client preview pakai Number biasa.
const num = (s: string) => Number(s || 0);
const fmt = (n: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);

const HOLD_KEY = "pos_held_carts";

export function PosTerminal({
  cashierName,
  products,
  customers,
}: {
  cashierName: string;
  products: PosProduct[];
  customers: PosCustomer[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [saleDiscount, setSaleDiscount] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [note, setNote] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const searchSeq = useRef(0); // cegah race response search
  const [remoteHits, setRemoteHits] = useState<PosProduct[]>([]);

  // ===== Katalog + pencarian client-side (dataset awal ≤100 dari server) =====
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? "").includes(q),
    );
  }, [products, query]);

  // Search server jika query tidak ketemu di dataset awal (barcode produk di luar 100 pertama)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) return;
    if (filtered.length > 0) return;
    const seq = ++searchSeq.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pos/products?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { products: PosProduct[] };
        if (seq === searchSeq.current && data.products.length > 0) {
          toast.info(`${data.products.length} produk dari pencarian server`);
          // tampilkan via state lokal tambahan
          setRemoteHits(data.products);
        } else if (seq === searchSeq.current) {
          setRemoteHits([]);
        }
      } catch {
        /* ignore */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, filtered.length]);

  const visible = filtered.length > 0 ? filtered : remoteHits;

  // ===== Totals preview (display only) =====
  const totals = useMemo(() => {
    let subtotal = 0,
      tax = 0;
    for (const l of cart) {
      const gross = num(l.unitPrice) * num(l.quantity);
      const disc = Math.min(num(l.discount), gross);
      const sub = gross - disc;
      subtotal += sub;
      tax += sub * (num(l.taxRate) / 100);
    }
    const sd = Math.min(num(saleDiscount), subtotal);
    const grand = subtotal - sd + tax;
    return { subtotal, tax, discount: sd, grand };
  }, [cart, saleDiscount]);

  // ===== Cart ops =====
  function addToCart(p: PosProduct) {
    if (p.stock !== null && num(p.stock) <= 0) {
      toast.error(`Stok ${p.sku} habis`);
      return;
    }
    setCart((c) => {
      const i = c.findIndex((l) => l.productId === p.id);
      if (i >= 0) {
        const next = [...c];
        const q = num(next[i]!.quantity) + 1;
        if (p.stock !== null && q > num(p.stock)) {
          toast.error(`Stok ${p.sku} hanya ${p.stock}`);
          return c;
        }
        next[i] = { ...next[i]!, quantity: String(q) };
        return next;
      }
      return [
        ...c,
        {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          unitPrice: p.price,
          taxRate: p.taxRate,
          quantity: "1",
          discount: "0",
        },
      ];
    });
  }

  function updateLine(idx: number, patch: Partial<CartLine>) {
    setCart((c) => c.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function removeLine(idx: number) {
    setCart((c) => c.filter((_, i) => i !== idx));
  }
  function clearCart() {
    setCart([]);
    setSaleDiscount("");
    setCustomerId("");
    setNote("");
  }

  // ===== HOLD / RESUME (D34 — localStorage) =====
  function holdCart() {
    if (cart.length === 0) {
      toast.error("Keranjang kosong");
      return;
    }
    const held = JSON.parse(localStorage.getItem(HOLD_KEY) ?? "[]") as Array<{
      id: string;
      at: number;
      cart: CartLine[];
      saleDiscount: string;
      customerId: string;
      note: string;
    }>;
    held.push({
      id: `H${Date.now()}`,
      at: Date.now(),
      cart,
      saleDiscount,
      customerId,
      note,
    });
    localStorage.setItem(HOLD_KEY, JSON.stringify(held));
    clearCart();
    toast.success("Transaksi ditahan — lihat daftar Tertahan");
  }

  const [held, setHeld] = useState<
    Array<{
      id: string;
      at: number;
      cart: CartLine[];
      saleDiscount: string;
      customerId: string;
      note: string;
    }>
  >([]);

  function resumeCart(id: string) {
    const item = held.find((h) => h.id === id);
    if (!item) return;
    // Stok mungkin berubah — tampilkan saja; server yang memvalidasi final
    setCart(item.cart);
    setSaleDiscount(item.saleDiscount);
    setCustomerId(item.customerId);
    setNote(item.note);
    setHeld((h) => {
      const next = h.filter((x) => x.id !== id);
      localStorage.setItem(HOLD_KEY, JSON.stringify(next));
      return next;
    });
    toast.info("Transaksi dilanjutkan");
  }

  function discardHeld(id: string) {
    setHeld((h) => {
      const next = h.filter((x) => x.id !== id);
      localStorage.setItem(HOLD_KEY, JSON.stringify(next));
      return next;
    });
  }

  // ===== Keyboard shortcuts (§38) =====
  const openPayment = useCallback(() => {
    if (cart.length > 0) setPayOpen(true);
  }, [cart.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "F8") {
        e.preventDefault();
        openPayment();
      } else if (e.key === "Escape") {
        setPayOpen(false);
      } else if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        openPayment();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPayment]);

  // Enter di search → jika barcode exact match 1 produk, langsung masuk cart
  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const q = query.trim();
    if (!q) return;
    const exact = products.find(
      (p) => p.barcode === q || p.sku.toLowerCase() === q.toLowerCase(),
    );
    if (exact) {
      addToCart(exact);
      setQuery("");
      setRemoteHits([]);
    } else if (visible.length === 1) {
      addToCart(visible[0]!);
      setQuery("");
      setRemoteHits([]);
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      {/* Search / barcode */}
      <div className="flex items-center gap-3">
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="Cari nama / SKU / scan barcode…  (F2)"
          autoFocus
          className="input flex-1 text-base"
        />
        <span className="text-xs text-muted-foreground">
          {cashierName} · F2 cari · F8 bayar · Ctrl+Enter
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
        {/* Product grid */}
        <div className="min-h-0 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {visible.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="rounded-lg border p-3 text-left hover:border-primary hover:bg-accent/40"
              >
                <div className="truncate text-sm font-medium">{p.name}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {p.sku}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    {formatIDR(p.price)}
                  </span>
                  <span
                    className={`text-xs ${p.stock !== null && num(p.stock) <= 0 ? "text-red-600" : "text-muted-foreground"}`}
                  >
                    {p.stock ?? "—"} {p.unit}
                  </span>
                </div>
              </button>
            ))}
            {visible.length === 0 && (
              <div className="col-span-full rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Tidak ada produk cocok.
              </div>
            )}
          </div>
        </div>

        {/* Cart */}
        <div className="flex min-h-0 flex-col rounded-lg border">
          <div className="border-b px-4 py-2 text-sm font-semibold">
            Keranjang ({cart.length})
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Pilih produk / scan barcode
              </p>
            ) : (
              <ul className="divide-y">
                {cart.map((l, idx) => {
                  const gross = num(l.unitPrice) * num(l.quantity);
                  const sub = gross - Math.min(num(l.discount), gross);
                  return (
                    <li key={l.productId} className="px-3 py-2 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{l.name}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {l.sku}
                          </div>
                        </div>
                        <button
                          onClick={() => removeLine(idx)}
                          className="text-xs text-muted-foreground hover:text-destructive"
                        >
                          ×
                        </button>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <button
                          onClick={() =>
                            updateLine(idx, {
                              quantity: String(
                                Math.max(1, num(l.quantity) - 1),
                              ),
                            })
                          }
                          className="h-6 w-6 rounded border hover:bg-accent"
                        >
                          −
                        </button>
                        <input
                          value={l.quantity}
                          onChange={(e) =>
                            updateLine(idx, { quantity: e.target.value })
                          }
                          inputMode="decimal"
                          className="h-6 w-14 rounded border text-center text-xs"
                        />
                        <button
                          onClick={() =>
                            updateLine(idx, {
                              quantity: String(num(l.quantity) + 1),
                            })
                          }
                          className="h-6 w-6 rounded border hover:bg-accent"
                        >
                          +
                        </button>
                        <input
                          value={l.discount}
                          onChange={(e) =>
                            updateLine(idx, { discount: e.target.value })
                          }
                          inputMode="decimal"
                          placeholder="disc"
                          className="h-6 w-20 rounded border text-right text-xs"
                        />
                        <span className="ml-auto font-medium">{fmt(sub)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Totals + actions */}
          <div className="space-y-2 border-t p-4 text-sm">
            <div className="flex justify-between">
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="input h-8 flex-1 text-xs"
              >
                <option value="">Pelanggan umum</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                onClick={holdCart}
                disabled={cart.length === 0}
                className="ml-2 rounded-md border px-2 text-xs hover:bg-accent disabled:opacity-40"
              >
                Tahan
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Diskon nota</span>
              <input
                value={saleDiscount}
                onChange={(e) => setSaleDiscount(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                className="h-8 w-24 rounded border text-right text-xs"
              />
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{fmt(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>PPN</span>
              <span>{fmt(totals.tax)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>TOTAL</span>
              <span>{fmt(totals.grand)}</span>
            </div>
            <button
              onClick={openPayment}
              disabled={cart.length === 0}
              className="w-full rounded-md bg-primary py-3 text-base font-bold text-primary-foreground disabled:opacity-40"
            >
              BAYAR (F8)
            </button>
          </div>
        </div>
      </div>

      {/* Held carts */}
      {held.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3 text-xs">
          <span className="font-medium">Tertahan:</span>
          {held.map((h) => (
            <span
              key={h.id}
              className="flex items-center gap-1 rounded-full border bg-background px-2 py-1"
            >
              {h.cart.length} item ·{" "}
              {new Date(h.at).toLocaleTimeString("id-ID")}
              <button
                onClick={() => resumeCart(h.id)}
                className="font-medium text-green-700 hover:underline"
              >
                Lanjutkan
              </button>
              <button
                onClick={() => discardHeld(h.id)}
                className="text-muted-foreground hover:underline"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {payOpen && (
        <PaymentDialog
          grandTotal={totals.grand}
          customers={customers}
          customerId={customerId}
          note={note}
          onClose={() => setPayOpen(false)}
          setCustomerId={setCustomerId}
          setNote={setNote}
          submitting={submitting}
          onComplete={async (payments) => {
            setSubmitting(true);
            const res = await checkoutSale({
              requestId: crypto.randomUUID(), // D28 idempotency
              customerId: customerId || undefined,
              note: note || undefined,
              saleDiscount: saleDiscount || undefined,
              items: cart.map((l) => ({
                productId: l.productId,
                quantity: l.quantity,
                discount: l.discount || undefined,
              })),
              payments: payments.length > 0 ? payments : undefined,
            });
            setSubmitting(false);
            if (res.success) {
              setPayOpen(false);
              toast.success(`Transaksi ${res.data.invoiceNumber} berhasil`);
              clearCart();
              router.refresh();
              return res.data;
            }
            toast.error(res.error);
            return null;
          }}
        />
      )}
    </div>
  );
}

// ================= Payment Dialog =================
function PaymentDialog({
  grandTotal,
  customers,
  customerId,
  note,
  setCustomerId,
  setNote,
  onClose,
  onComplete,
  submitting,
}: {
  grandTotal: number;
  customers: PosCustomer[];
  customerId: string;
  note: string;
  setCustomerId: (v: string) => void;
  setNote: (v: string) => void;
  onClose: () => void;
  onComplete: (
    payments: Array<{ method: string; amount: string; reference?: string }>,
  ) => Promise<{ id: string; invoiceNumber: string } | null>;
  submitting: boolean;
}) {
  const [rows, setRows] = useState<
    Array<{ method: string; amount: string; reference: string }>
  >([{ method: "CASH", amount: "", reference: "" }]);
  const [receipt, setReceipt] = useState<{
    id: string;
    invoiceNumber: string;
  } | null>(null);

  const paidPreview = rows.reduce((a, r) => a + num(r.amount), 0);
  const change = Math.max(0, paidPreview - grandTotal);
  const due = Math.max(0, grandTotal - paidPreview);

  function addRow() {
    setRows((r) => [...r, { method: "CASH", amount: "", reference: "" }]);
  }
  function updateRow(i: number, patch: Partial<(typeof rows)[number]>) {
    setRows((r) =>
      r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)),
    );
  }

  const canSubmit =
    (rows.every((r) => num(r.amount) >= 0) && due === 0) || due > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payments = rows
      .filter((r) => num(r.amount) > 0)
      .map((r) => ({
        method: r.method,
        amount: r.amount,
        reference: r.reference || undefined,
      }));
    const result = await onComplete(payments);
    if (result) setReceipt(result);
  }

  if (receipt) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-sm rounded-lg border bg-background p-6 text-center">
          <div className="text-4xl">✅</div>
          <h2 className="mt-2 text-lg font-bold">Transaksi Berhasil</h2>
          <p className="mt-1 font-mono text-sm">{receipt.invoiceNumber}</p>
          <div className="mt-4 rounded-md border bg-muted/30 p-3 text-left text-sm">
            <div className="flex justify-between">
              <span>Total</span>
              <b>{fmt(grandTotal)}</b>
            </div>
            <div className="flex justify-between">
              <span>Dibayar</span>
              <span>{fmt(paidPreview)}</span>
            </div>
            <div className="flex justify-between">
              <span>Kembalian</span>
              <b>{fmt(change)}</b>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="mt-4 w-full rounded-md border py-2 text-sm hover:bg-accent"
          >
            🖨 Cetak Struk
          </button>
          <button
            onClick={onClose}
            className="mt-2 w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground"
          >
            Transaksi Baru
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16">
      <div className="w-full max-w-md rounded-lg border bg-background p-6">
        <h2 className="mb-1 text-lg font-bold">Pembayaran</h2>
        <p className="mb-4 text-2xl font-bold">
          {formatIDR(String(grandTotal))}
        </p>
        <form onSubmit={handleSubmit} className="grid gap-3">
          {rows.map((r, i) => (
            <div key={i} className="grid gap-2 rounded-md border p-3">
              <div className="flex gap-2">
                <select
                  value={r.method}
                  onChange={(e) => updateRow(i, { method: e.target.value })}
                  className="input flex-1 text-sm"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <input
                  value={r.amount}
                  onChange={(e) => updateRow(i, { amount: e.target.value })}
                  inputMode="decimal"
                  placeholder="Nominal"
                  autoFocus={i === 0}
                  className="input w-32 text-right text-sm"
                />
              </div>
              {r.method !== "CASH" && (
                <input
                  value={r.reference}
                  onChange={(e) => updateRow(i, { reference: e.target.value })}
                  placeholder="Referensi (opsional)"
                  className="input text-xs"
                />
              )}
              {r.method === "CASH" && (
                <div className="flex gap-1">
                  {[10000, 20000, 50000, 100000].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() =>
                        updateRow(i, { amount: String(num(r.amount) + v) })
                      }
                      className="flex-1 rounded border py-1 text-xs hover:bg-accent"
                    >
                      +{v / 1000}rb
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addRow}
            className="w-fit text-xs hover:underline"
          >
            + Metode pembayaran
          </button>

          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between">
              <span>Dibayar</span>
              <span>{fmt(paidPreview)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>{due > 0 ? "Kurang (kredit)" : "Kembalian"}</span>
              <span>{fmt(due > 0 ? due : change)}</span>
            </div>
          </div>

          {due > 0 && (
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Pelanggan (kredit — wajib) *</span>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
                className="input text-sm"
              >
                <option value="">— pilih —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Catatan</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input text-sm"
            />
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || rows.every((r) => num(r.amount) <= 0)}
              className="rounded-md bg-primary px-6 py-2 text-sm font-bold text-primary-foreground disabled:opacity-40"
            >
              {submitting ? "Memproses…" : "SELESAIKAN"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
