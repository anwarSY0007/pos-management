import Link from "next/link";
import { requirePermission, getSessionContext, listAccessibleBranches } from "@/lib/permissions/authorize";
import { NoBranchPrompt } from "@/components/layout/no-branch-prompt";
import { inventoryService } from "@/services/inventory.service";
import { stockOverviewSchema } from "@/schema/inventory.schema";
import { toMoney } from "@/lib/utils/money";
import { formatIDR } from "@/lib/utils/format";
import { hasPermission } from "@/config/permissions";
import { InitializeStockButton, AdjustStockButton } from "@/components/inventory/stock-action-dialogs";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function InventoryPage({ searchParams }: Props) {
    const ctx = await requirePermission("inventory.view");
    if (!ctx) {
        const branches = await listAccessibleBranches(await getSessionContext());
        return <NoBranchPrompt branches={branches} />;
    }

    const parsed = stockOverviewSchema.safeParse(await searchParams);
    const params = parsed.success ? parsed.data : stockOverviewSchema.parse({});
    const result = await inventoryService.getStockOverview(ctx.branchId, params);

    const qs = (page: number) => {
        const p = new URLSearchParams({ filter: params.filter, pageSize: String(params.pageSize), page: String(page) });
        if (params.q) p.set("q", params.q);
        return `/inventory?${p.toString()}`;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h1 className="text-2xl font-bold">Stok</h1>
                    <p className="text-sm text-muted-foreground">
                        {result.total} produk · cabang aktif
                    </p>
                </div>
                <Link href="/inventory/movements" className="rounded-md border px-3 py-2 text-sm hover:bg-accent">
                    Lihat Mutasi Stok →
                </Link>
            </div>

            <form action="/inventory" method="get" className="flex flex-wrap items-end gap-2 rounded-lg border p-4">
                <input name="q" defaultValue={params.q ?? ""} placeholder="Cari nama / SKU…" className="input min-w-48 flex-1" />
                <select name="filter" defaultValue={params.filter} className="input w-40">
                    <option value="all">Semua produk</option>
                    <option value="low">Stok menipis</option>
                </select>
                <button type="submit" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">Filter</button>
            </form>

            {result.items.length === 0 ? (
                <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                    Tidak ada data. {params.filter === "low" ? "Tidak ada stok menipis 👍" : "Set stok awal dari daftar di bawah."}
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                        <thead className="border-b bg-muted/50 text-left">
                            <tr>
                                <th className="p-3">SKU</th><th className="p-3">Produk</th>
                                <th className="p-3 text-right">Stok</th>
                                <th className="p-3 text-right">Min</th>
                                <th className="p-3 text-right">Nilai Stok</th>
                                <th className="p-3">Status</th>
                                <th className="p-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {result.items.map((row) => {
                                const stock = row.stock;
                                const min = toMoney(row.minimumStock);
                                const status = stock === null ? "unset" : stock.lte(0) ? "empty" : stock.lte(min) ? "low" : "ok";
                                const badge = {
                                    unset: <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Belum di-set</span>,
                                    empty: <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">Kosong</span>,
                                    low: <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">Menipis</span>,
                                    ok: <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">Aman</span>,
                                }[status];

                                return (
                                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                                        <td className="p-3 font-mono text-xs">{row.sku}</td>
                                        <td className="p-3 font-medium">{row.name}</td>
                                        <td className="p-3 text-right font-mono">
                                            {stock === null ? "—" : stock.toString()} {row.unit?.symbol}
                                        </td>
                                        <td className="p-3 text-right text-muted-foreground">{row.minimumStock.toString()}</td>
                                        <td className="p-3 text-right">
                                            {stock === null ? "—" : formatIDR(stock.mul(row.purchasePrice).toFixed(2))}
                                        </td>
                                        <td className="p-3">{badge}</td>
                                        <td className="whitespace-nowrap p-3 text-right">
                                            {hasPermission(ctx.role, "inventory.adjust") && (
                                                stock === null
                                                    ? <InitializeStockButton productId={row.id} />
                                                    : <AdjustStockButton productId={row.id} />
                                            )}
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
                    <span className="text-muted-foreground">Halaman {result.page} / {result.pageCount}</span>
                    <div className="flex gap-2">
                        {result.page > 1 && <Link href={qs(result.page - 1)} className="rounded-md border px-3 py-1.5 hover:bg-accent">← Sebelumnya</Link>}
                        {result.page < result.pageCount && <Link href={qs(result.page + 1)} className="rounded-md border px-3 py-1.5 hover:bg-accent">Berikutnya →</Link>}
                    </div>
                </div>
            )}
        </div>
    );
}