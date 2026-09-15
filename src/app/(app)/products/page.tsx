import Link from "next/link";
import prisma from "@/lib/db";
import {
    requirePermission,
    getSessionContext,
    listAccessibleBranches,
} from "@/lib/permissions/authorize";
import { NoBranchPrompt } from "@/components/layout/no-branch-prompt";
import { CreateProductButton } from "@/components/products/product-dialog";
import { ArchiveButton } from "@/components/products/archive-button";
import { productListSchema } from "@/schema/product.schema";
import { productRepository } from "@/repositories/product.repository";
import { hasPermission } from "@/config/permissions";
import { formatIDR } from "@/lib/utils/format";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };


export default async function ProductsPage({ searchParams }: Props) {
   const ctx = await requirePermission("product.view");
   if (!ctx) {
    const branches = await listAccessibleBranches(await getSessionContext());
    return <NoBranchPrompt branches={branches} />;
}
    const sp = await searchParams;
    const parsed = productListSchema.safeParse(sp);
    const params = parsed.success ? parsed.data : productListSchema.parse({});

    const [result, categories, brands, units] = await Promise.all([
        productRepository.list(params),
        prisma.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
        prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
        prisma.unit.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);

    const qs = (page: number) => {
        const p = new URLSearchParams();
        if (params.q) p.set("q", params.q);
        if (params.categoryId) p.set("categoryId", params.categoryId);
        p.set("status", params.status); p.set("sort", params.sort);
        p.set("dir", params.dir); p.set("pageSize", String(params.pageSize));
        p.set("page", String(page));
        return `/products?${p.toString()}`;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Produk</h1>
                    <p className="text-sm text-muted-foreground">{result.total} produk</p>
                </div>
                <div className="flex gap-2">
                    <Link href={`/api/products/export?status=${params.status}`} className="rounded-md border px-3 py-2 text-sm hover:bg-accent">
                        Export CSV
                    </Link>
                    {hasPermission(ctx.role, "product.create") && (
                        <CreateProductButton categories={categories} brands={brands} units={units} />
                    )}
                </div>
            </div>

            {/* Filter — GET form, tanpa client JS */}
            <form className="flex flex-wrap items-end gap-2 rounded-lg border p-4" action="/products" method="get">
                <input name="q" defaultValue={params.q ?? ""} placeholder="Cari nama / SKU / barcode…" className="input flex-1 min-w-48" />
                <select name="categoryId" defaultValue={params.categoryId ?? ""} className="input w-44">
                    <option value="">Semua kategori</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select name="status" defaultValue={params.status} className="input w-32">
                    <option value="ACTIVE">Aktif</option>
                    <option value="ARCHIVED">Arsip</option>
                    <option value="ALL">Semua</option>
                </select>
                <select name="sort" defaultValue={params.sort} className="input w-36">
                    <option value="name">Nama</option>
                    <option value="sku">SKU</option>
                    <option value="sellingPrice">Harga jual</option>
                    <option value="createdAt">Terbaru</option>
                </select>
                <select name="dir" defaultValue={params.dir} className="input w-28">
                    <option value="asc">Naik</option>
                    <option value="desc">Turun</option>
                </select>
                <input type="hidden" name="pageSize" value={params.pageSize} />
                <button type="submit" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">Filter</button>
            </form>

            {result.items.length === 0 ? (
                <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                    Tidak ada produk. {params.status === "ACTIVE" && "Tambahkan produk pertama atau cek filter."}
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                        <thead className="border-b bg-muted/50 text-left">
                            <tr>
                                <th className="p-3">SKU</th><th className="p-3">Nama</th>
                                <th className="p-3">Kategori</th><th className="p-3">Satuan</th>
                                <th className="p-3 text-right">Harga Beli</th>
                                <th className="p-3 text-right">Harga Jual</th>
                                <th className="p-3">Status</th><th className="p-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {result.items.map((p) => (
                                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                                    <td className="p-3 font-mono text-xs">{p.sku}</td>
                                    <td className="p-3 font-medium">{p.name}</td>
                                    <td className="p-3">{p.category?.name ?? "—"}</td>
                                    <td className="p-3">{p.unit?.symbol ?? "—"}</td>
                                    <td className="p-3 text-right">{formatIDR(p.purchasePrice)}</td>
                                    <td className="p-3 text-right">{formatIDR(p.sellingPrice)}</td>
                                    <td className="p-3">
                                        <span className={p.status === "ACTIVE" ? "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800" : "rounded-full bg-muted px-2 py-0.5 text-xs"}>
                                            {p.status === "ACTIVE" ? "Aktif" : "Arsip"}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right whitespace-nowrap">
                                        {hasPermission(ctx.role, "product.update") && (
                                            <Link href={`/products/${p.id}/edit`} className="mr-3 text-xs hover:underline">Edit</Link>
                                        )}
                                        {hasPermission(ctx.role, "product.archive") && (
                                            <ArchiveButton id={p.id} archived={p.status === "ARCHIVED"} />
                                        )}
                                    </td>
                                </tr>
                            ))}
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