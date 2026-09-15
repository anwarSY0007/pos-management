import Link from "next/link";
import {
  requirePermission,
  getSessionContext,
  listAccessibleBranches,
} from "@/lib/permissions/authorize";
import { NoBranchPrompt } from "@/components/layout/no-branch-prompt";
import { inventoryService } from "@/services/inventory.service";
import { movementListSchema } from "@/schema/inventory.schema";
import { formatIDR } from "@/lib/utils/format";

const TYPE_LABEL: Record<string, string> = {
  PURCHASE: "Pembelian",
  SALE: "Penjualan",
  SALE_RETURN: "Retur Jual",
  PURCHASE_RETURN: "Retur Beli",
  ADJUSTMENT_IN: "Penyesuaian +",
  ADJUSTMENT_OUT: "Penyesuaian −",
  TRANSFER_IN: "Transfer Masuk",
  TRANSFER_OUT: "Transfer Keluar",
  INITIAL_STOCK: "Stok Awal",
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MovementsPage({ searchParams }: Props) {
  const ctx = await requirePermission("inventory.view");
  if (!ctx) {
    const branches = await listAccessibleBranches(await getSessionContext());
    return <NoBranchPrompt branches={branches} />;
  }

  const parsed = movementListSchema.safeParse(await searchParams);
  const params = parsed.success ? parsed.data : movementListSchema.parse({});
  const result = await inventoryService.listMovements(ctx.branchId, params);

  const qs = (page: number) => {
    const p = new URLSearchParams({
      pageSize: String(params.pageSize),
      page: String(page),
    });
    if (params.q) p.set("q", params.q);
    if (params.type) p.set("type", params.type);
    return `/inventory/movements?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mutasi Stok</h1>
          <p className="text-sm text-muted-foreground">
            Source of truth pergerakan stok · {result.total} mutasi
          </p>
        </div>
        <Link
          href="/inventory"
          className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
        >
          ← Stok
        </Link>
      </div>

      <form
        action="/inventory/movements"
        method="get"
        className="flex flex-wrap items-end gap-2 rounded-lg border p-4"
      >
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Cari produk…"
          className="input min-w-48 flex-1"
        />
        <select
          name="type"
          defaultValue={params.type ?? ""}
          className="input w-48"
        >
          <option value="">Semua tipe</option>
          {Object.entries(TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
        >
          Filter
        </button>
      </form>

      {result.items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Belum ada mutasi stok.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                <th className="p-3">Waktu</th>
                <th className="p-3">Produk</th>
                <th className="p-3">Tipe</th>
                <th className="p-3 text-right">Qty</th>
                <th className="p-3 text-right">HPP Satuan</th>
                <th className="p-3">Catatan</th>
                <th className="p-3">Oleh</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((m) => (
                <tr
                  key={m.id}
                  className="border-b last:border-0 hover:bg-muted/30"
                >
                  <td className="p-3 text-xs whitespace-nowrap">
                    {m.createdAt.toLocaleString("id-ID", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{m.product.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {m.product.sku}
                    </div>
                  </td>
                  <td className="p-3 text-xs">
                    {TYPE_LABEL[m.type] ?? m.type}
                  </td>
                  <td
                    className={`p-3 text-right font-mono font-medium ${m.quantity.gt(0) ? "text-green-700" : "text-red-700"}`}
                  >
                    {m.quantity.gt(0) ? "+" : ""}
                    {m.quantity.toString()}
                  </td>
                  <td className="p-3 text-right">
                    {m.unitCost ? formatIDR(m.unitCost) : "—"}
                  </td>
                  <td className="max-w-48 truncate p-3 text-xs text-muted-foreground">
                    {m.note ?? "—"}
                  </td>
                  <td className="p-3 text-xs">{m.user.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.pageCount > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Halaman {result.page} / {result.pageCount}
          </span>
          <div className="flex gap-2">
            {result.page > 1 && (
              <Link
                href={qs(result.page - 1)}
                className="rounded-md border px-3 py-1.5 hover:bg-accent"
              >
                ← Sebelumnya
              </Link>
            )}
            {result.page < result.pageCount && (
              <Link
                href={qs(result.page + 1)}
                className="rounded-md border px-3 py-1.5 hover:bg-accent"
              >
                Berikutnya →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
