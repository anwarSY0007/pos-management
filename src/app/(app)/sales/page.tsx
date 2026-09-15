import Link from "next/link";
import {
  requirePermission,
  getSessionContext,
  listAccessibleBranches,
} from "@/lib/permissions/authorize";
import { NoBranchPrompt } from "@/components/layout/no-branch-prompt";
import { saleService } from "@/services/sale.service";
import { formatIDR } from "@/lib/utils/format";

const BADGE: Record<string, { cls: string; label: string }> = {
  COMPLETED: { cls: "bg-green-100 text-green-800", label: "Selesai" },
  CANCELLED: { cls: "bg-red-100 text-red-800", label: "Batal" },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SalesPage({ searchParams }: Props) {
  const ctx = await requirePermission("sale.view");
  if (!ctx) {
    const branches = await listAccessibleBranches(await getSessionContext());
    return <NoBranchPrompt branches={branches} />;
  }

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const page = typeof sp.page === "string" ? parseInt(sp.page) || 1 : 1;
  const result = await saleService.list(ctx.branchId, {
    q,
    page,
    pageSize: 15,
  });

  const qs = (p: number) => {
    const u = new URLSearchParams({ page: String(p) });
    if (q) u.set("q", q);
    return `/sales?${u.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Penjualan</h1>
          <p className="text-sm text-muted-foreground">
            {result.total} transaksi
          </p>
        </div>
        <Link
          href="/pos"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          + Buka POS
        </Link>
      </div>

      <form
        action="/sales"
        method="get"
        className="flex gap-2 rounded-lg border p-4"
      >
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Cari invoice / pelanggan…"
          className="input flex-1"
        />
        <button
          type="submit"
          className="rounded-md border px-4 text-sm hover:bg-accent"
        >
          Cari
        </button>
      </form>

      {result.items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Belum ada transaksi.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                <th className="p-3">Invoice</th>
                <th className="p-3">Waktu</th>
                <th className="p-3">Pelanggan</th>
                <th className="p-3">Kasir</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((s) => {
                const b = BADGE[s.status] ?? {
                  cls: "bg-muted",
                  label: s.status,
                };
                return (
                  <tr
                    key={s.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="p-3 font-mono text-xs">{s.invoiceNumber}</td>
                    <td className="p-3 text-xs whitespace-nowrap">
                      {s.createdAt.toLocaleString("id-ID", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="p-3 text-xs">
                      {s.customer?.name ?? "Umum"}
                    </td>
                    <td className="p-3 text-xs">{s.cashier.name}</td>
                    <td className="p-3 text-right font-medium">
                      {formatIDR(s.grandTotal)}
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${b.cls}`}
                      >
                        {b.label}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/sales/${s.id}`}
                        className="text-xs hover:underline"
                      >
                        Detail →
                      </Link>
                    </td>
                  </tr>
                );
              })}
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
                ←
              </Link>
            )}
            {result.page < result.pageCount && (
              <Link
                href={qs(result.page + 1)}
                className="rounded-md border px-3 py-1.5 hover:bg-accent"
              >
                →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
