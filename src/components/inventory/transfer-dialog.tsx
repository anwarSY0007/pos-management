"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sendTransfer } from "@/actions/inventory/transfer-actions";

type BranchOption = { id: string; code: string; name: string };
type ProductOption = { id: string; sku: string; name: string };
type Row = { productId: string; qty: string };

export function SendTransferButton({
  branches,
  products,
}: {
  branches: BranchOption[];
  products: ProductOption[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [rows, setRows] = useState<Row[]>([{ productId: "", qty: "" }]);
  const router = useRouter();

  function addRow() {
    setRows((r) => [...r, { productId: "", qty: "" }]);
  }
  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }
  function updateRow(i: number, patch: Partial<Row>) {
    setRows((r) =>
      r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)),
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const items = rows
      .filter((r) => r.productId && r.qty)
      .map((r) => ({ productId: r.productId, qty: r.qty }));
    if (items.length === 0) {
      toast.error("Tambahkan minimal 1 produk lengkap dengan qty");
      return;
    }
    setPending(true);
    const res = await sendTransfer({
      toBranchId: String(fd.get("toBranchId") ?? ""),
      note: String(fd.get("note") ?? ""),
      items,
    });
    setPending(false);
    if (res.success) {
      toast.success("Transfer dikirim — stok cabang ini sudah berkurang");
      setOpen(false);
      setRows([{ productId: "", qty: "" }]);
      router.refresh();
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
        + Kirim Transfer
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16">
          <div className="w-full max-w-xl rounded-lg border bg-background p-6">
            <h2 className="mb-4 text-lg font-semibold">Kirim Transfer Stok</h2>
            <form onSubmit={handleSubmit} className="grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Cabang Tujuan *</span>
                <select name="toBranchId" required className="input">
                  <option value="">— pilih —</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} · {b.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-2">
                <span className="text-sm font-medium">Produk *</span>
                {rows.map((row, i) => (
                  <div key={i} className="flex gap-2">
                    <select
                      value={row.productId}
                      onChange={(e) =>
                        updateRow(i, { productId: e.target.value })
                      }
                      className="input flex-1"
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
                      className="input w-24"
                    />
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="rounded-md border px-2 text-sm text-muted-foreground hover:bg-accent"
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
                  placeholder="Permintaan cabang…"
                />
              </label>

              <p className="text-xs text-muted-foreground">
                Stok cabang aktif langsung berkurang, status{" "}
                <b>Dalam Pengiriman</b>. Cabang tujuan menerima dari halaman
                ini.
              </p>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {pending ? "Mengirim…" : "Kirim"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
