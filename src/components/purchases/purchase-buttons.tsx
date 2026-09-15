"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  orderPurchase,
  cancelPurchase,
  receivePurchase,
} from "@/actions/purchase/purchase-actions";

export function OrderPurchaseButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransitionSafe();
  return (
    <button
      onClick={() => {
        if (!confirm("Kirim PO ini ke supplier (ORDERED)?")) return;
        start(async () => {
          const res = await orderPurchase(id);
          if (res.success) {
            toast.success("PO dipesan");
            router.refresh();
          } else toast.error(res.error);
        });
      }}
      disabled={pending}
      className="text-xs font-medium hover:underline disabled:opacity-50"
    >
      Pesan
    </button>
  );
}

export function CancelPurchaseButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransitionSafe();
  return (
    <button
      onClick={() => {
        if (!confirm("Batalkan pembelian ini?")) return;
        start(async () => {
          const res = await cancelPurchase(id);
          if (res.success) {
            toast.success("Dibatalkan");
            router.refresh();
          } else toast.error(res.error);
        });
      }}
      disabled={pending}
      className="text-xs text-muted-foreground hover:underline disabled:opacity-50"
    >
      Batalkan
    </button>
  );
}

export function ReceiveForm({
  purchaseId,
  items,
}: {
  purchaseId: string;
  items: Array<{
    itemId: string;
    sku: string;
    name: string;
    ordered: string;
    received: string;
  }>;
}) {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm("Terima barang? Stok bertambah & jurnal Utang dibuat."))
      return;
    setPending(true);
    const res = await receivePurchase({
      id: purchaseId,
      items: items
        .map((i) => ({ itemId: i.itemId, qty: counts[i.itemId] ?? "0" }))
        .filter((r) => Number(r.qty) > 0),
    });
    setPending(false);
    if (res.success) {
      toast.success("Barang diterima");
      router.refresh();
    } else toast.error(res.error);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="p-3">Produk</th>
              <th className="p-3 text-right">Dipesan</th>
              <th className="p-3 text-right">Diterima</th>
              <th className="p-3 text-right">Terima Sekarang</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const remaining = Number(i.ordered) - Number(i.received);
              return (
                <tr key={i.itemId} className="border-b last:border-0">
                  <td className="p-3">
                    <div className="font-medium">{i.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {i.sku}
                    </div>
                  </td>
                  <td className="p-3 text-right">{i.ordered}</td>
                  <td className="p-3 text-right">{i.received}</td>
                  <td className="p-3 text-right">
                    {remaining > 0 ? (
                      <input
                        value={counts[i.itemId] ?? ""}
                        onChange={(e) =>
                          setCounts((c) => ({
                            ...c,
                            [i.itemId]: e.target.value,
                          }))
                        }
                        inputMode="decimal"
                        placeholder={`max ${remaining}`}
                        className="input w-24 text-right"
                      />
                    ) : (
                      <span className="text-xs text-green-700">Lunas ✓</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Memproses…" : "Terima Barang"}
        </button>
      </div>
    </form>
  );
}

// helper kecil agar tidak duplikasi
function useTransitionSafe() {
  const [pending, start] = useTransition();
  return [pending, start] as const;
}
