"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createOpname } from "@/actions/inventory/opname-actions";

type ProductOption = { id: string; sku: string; name: string };

export function CreateOpnameButton({
  products,
}: {
  products: ProductOption[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const router = useRouter();

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (selected.size === 0) {
      toast.error("Pilih minimal 1 produk untuk diopname");
      return;
    }
    setPending(true);
    const res = await createOpname({
      note: String(fd.get("note") ?? ""),
      productIds: [...selected],
    });
    setPending(false);
    if (res.success) {
      toast.success(
        "Opname dibuat — lanjutkan dengan hitungan fisik di detail",
      );
      setOpen(false);
      setSelected(new Set());
      router.push(`/inventory/opnames/${res.data.id}`);
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
        + Opname Baru
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16">
          <div className="w-full max-w-xl rounded-lg border bg-background p-6">
            <h2 className="mb-4 text-lg font-semibold">Opname Stok Baru</h2>
            <form onSubmit={handleSubmit} className="grid gap-3">
              <div className="max-h-72 overflow-y-auto rounded-md border">
                {products.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm last:border-0 hover:bg-muted/30"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                    />
                    <span className="font-mono text-xs text-muted-foreground">
                      {p.sku}
                    </span>
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {selected.size} produk dipilih. Snapshot stok sistem dicatat
                saat opname dibuat; delta dihitung dari stok saat opname{" "}
                <b>diselesaikan</b> (aman terhadap transaksi concurrent).
              </p>
              <label className="grid gap-1 text-sm">
                <span className="font-medium">Catatan</span>
                <input
                  name="note"
                  className="input"
                  placeholder="Opname akhir bulan…"
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
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {pending ? "Membuat…" : "Buat Opname"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
