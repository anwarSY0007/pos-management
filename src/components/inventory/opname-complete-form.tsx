"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { completeOpname } from "@/actions/inventory/opname-actions";

type Item = { itemId: string; sku: string; name: string; expectedQty: string };

export function OpnameCompleteForm({
  opnameId,
  items,
}: {
  opnameId: string;
  items: Item[];
}) {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const router = useRouter();

  const allFilled = items.every(
    (i) => counts[i.itemId] !== undefined && counts[i.itemId] !== "",
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      !confirm(
        "Selesaikan opname? Delta stok = hitungan fisik − stok saat ini. " +
          "Movement & jurnal dibuat, status berubah menjadi SELESAI (tidak bisa dibatalkan).",
      )
    )
      return;

    setPending(true);
    const res = await completeOpname({
      id: opnameId,
      items: items.map((i) => ({
        itemId: i.itemId,
        countedQty: counts[i.itemId] ?? "",
      })),
    });
    setPending(false);
    if (res.success) {
      toast.success("Opname selesai — stok disesuaikan");
      router.push("/inventory/opnames");
    } else {
      toast.error(res.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="p-3">SKU</th>
              <th className="p-3">Produk</th>
              <th className="p-3 text-right">Stok Sistem (snapshot)</th>
              <th className="p-3 text-right">Hitungan Fisik *</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.itemId} className="border-b last:border-0">
                <td className="p-3 font-mono text-xs">{i.sku}</td>
                <td className="p-3">{i.name}</td>
                <td className="p-3 text-right font-mono">{i.expectedQty}</td>
                <td className="p-3 text-right">
                  <input
                    value={counts[i.itemId] ?? ""}
                    onChange={(e) =>
                      setCounts((c) => ({ ...c, [i.itemId]: e.target.value }))
                    }
                    inputMode="decimal"
                    placeholder="0"
                    required
                    className="input w-28 text-right"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={pending || !allFilled}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Memproses…" : "Selesaikan Opname"}
        </button>
      </div>
    </form>
  );
}
