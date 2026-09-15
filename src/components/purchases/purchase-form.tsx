"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createPurchase } from "@/actions/purchase/purchase-actions";

type Supplier = { id: string; name: string };
type Product = { id: string; sku: string; name: string };
type Row = { productId: string; qty: string; unitCost: string };

export function CreatePurchaseButton({
  suppliers,
  products,
}: {
  suppliers: Supplier[];
  products: Product[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [rows, setRows] = useState<Row[]>([
    { productId: "", qty: "", unitCost: "" },
  ]);
  const router = useRouter();

  function addRow() {
    setRows((r) => [...r, { productId: "", qty: "", unitCost: "" }]);
  }
  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }
  function updateRow(i: number, patch: Partial<Row>) {
    setRows((r) =>
      r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)),
    );
  }

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>,
    orderNow: boolean,
  ) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const items = rows
      .filter((r) => r.productId && r.qty && r.unitCost)
      .map((r) => ({
        productId: r.productId,
        qty: r.qty,
        unitCost: r.unitCost,
      }));
    if (items.length === 0) {
      toast.error("Lengkapi minimal 1 item");
      return;
    }
    setPending(true);
    const res = await createPurchase(
      {
        supplierId: String(fd.get("supplierId") ?? ""),
        note: String(fd.get("note") ?? ""),
        items,
      },
      orderNow,
    );
    setPending(false);
    if (res.success) {
      toast.success(
        orderNow ? "PO dibuat & dipesan" : "Draft pembelian disimpan",
      );
      setOpen(false);
      setRows([{ productId: "", qty: "", unitCost: "" }]);
      router.push(`/purchases/${res.data.id}`);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        + Pembelian Baru
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16">
          <div className="w-full max-w-2xl rounded-lg border bg-background p-6">
            <h2 className="mb-4 text-lg font-semibold">Pembelian Baru</h2>
            <form
              onSubmit={(e) => handleSubmit(e, true)}
              className="grid gap-3"
            >
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Supplier *</span>
                <select name="supplierId" required className="input">
                  <option value="">— pilih —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-2">
                <span className="text-sm font-medium">Item *</span>
                {rows.map((row, i) => (
                  <div key={i} className="flex gap-2">
                    <select
                      value={row.productId}
                      onChange={(e) =>
                        updateRow(i, { productId: e.target.value })
                      }
                      className="input flex-1 text-sm"
                    >
                      <option value="">— produk —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} · {p.name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={row.qty}
                      onChange={(e) => updateRow(i, { qty: e.target.value })}
                      inputMode="decimal"
                      placeholder="Qty"
                      className="input w-20 text-sm"
                    />
                    <input
                      value={row.unitCost}
                      onChange={(e) =>
                        updateRow(i, { unitCost: e.target.value })
                      }
                      inputMode="decimal"
                      placeholder="Harga beli"
                      className="input w-28 text-right text-sm"
                    />
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="rounded-md border px-2 text-muted-foreground hover:bg-accent"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addRow}
                  className="w-fit rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
                >
                  + Baris
                </button>
              </div>

              <label className="grid gap-1 text-sm">
                <span className="font-medium">Catatan</span>
                <input
                  name="note"
                  className="input"
                  placeholder="PO mingguan…"
                />
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={(e) => {
                    const form = e.currentTarget.closest("form");
                    form?.requestSubmit();
                  }}
                  className="hidden"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {pending ? "Menyimpan…" : "Simpan & Pesan (ORDERED)"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget.closest(
                      "form",
                    ) as HTMLFormElement | null;
                    if (form)
                      void handleSubmit(
                        {
                          preventDefault: () => {},
                          currentTarget: form,
                        } as unknown as React.FormEvent<HTMLFormElement>,
                        false,
                      );
                  }}
                  className="rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
                >
                  Simpan Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
