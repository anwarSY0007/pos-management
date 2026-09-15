import Link from "next/link";
import prisma from "@/lib/db";
import {
  requirePermission,
  getSessionContext,
  listAccessibleBranches,
} from "@/lib/permissions/authorize";
import { NoBranchPrompt } from "@/components/layout/no-branch-prompt";
import { purchaseService } from "@/services/purchase.service";
import { purchaseListSchema } from "@/schema/purchase.schema";
import { CreatePurchaseButton } from "@/components/purchases/purchase-form";
import { hasPermission } from "@/config/permissions";

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ORDERED: "bg-blue-100 text-blue-800",
  PARTIAL: "bg-yellow-100 text-yellow-800",
  RECEIVED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PurchasesPage({ searchParams }: Props) {
  const ctx = await requirePermission("purchase.view");
  if (!ctx) {
    const branches = await listAccessibleBranches(await getSessionContext());
    return <NoBranchPrompt branches={branches} />;
  }

  const parsed = purchaseListSchema.safeParse(await searchParams);
  const params = parsed.success ? parsed.data : purchaseListSchema.parse({});

  const [result, suppliers, products] = await Promise.all([
    purchaseService.list(ctx.branchId, params),
    hasPermission(ctx.role, "purchase.create")
      ? prisma.supplier.findMany({
          where: { status: "ACTIVE" },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    hasPermission(ctx.role, "purchase.create")
      ? prisma.product.findMany({
          where: { status: "ACTIVE" },
          orderBy: { name: "asc" },
          select: { id: true, sku: true, name: true },
          take: 500,
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Pembelian</h1>
          <p className="text-sm text-muted-foreground">
            {result.total} dokumen
          </p>
        </div>
        {hasPermission(ctx.role, "purchase.create") && (
          <CreatePurchaseButton suppliers={suppliers} products={products} />
        )}
      </div>

      <form
        action="/purchases"
        method="get"
        className="flex flex-wrap items-end gap-2 rounded-lg border p-4"
      >
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Cari nomor / supplier…"
          className="input min-w-48 flex-1"
        />
        <select
          name="status"
          defaultValue={params.status}
          className="input w-40"
        >
          <option value="ALL">Semua status</option>
          <option value="DRAFT">Draft</option>
          <option value="ORDERED">Dipesan</option>
          <option value="PARTIAL">Sebagian</option>
          <option value="RECEIVED">Diterima</option>
          <option value="CANCELLED">Batal</option>
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
          Belum ada pembelian.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                <th className="p-3">Nomor</th>
                <th className="p-3">Supplier</th>
                <th className="p-3 text-right">Item</th>
                <th className="p-3">Dibuat</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((p) => (
                <tr
                  key={p.id}
                  className="border-b last:border-0 hover:bg-muted/30"
                >
                  <td className="p-3 font-mono text-xs">{p.purchaseNumber}</td>
                  <td className="p-3">{p.supplier.name}</td>
                  <td className="p-3 text-right">{p._count.items}</td>
                  <td className="p-3 text-xs whitespace-nowrap">
                    {p.createdAt.toLocaleString("id-ID", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[p.status] ?? ""}`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      href={`/purchases/${p.id}`}
                      className="text-xs hover:underline"
                    >
                      Detail →
                    </Link>
                  </td>
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
                href={`/purchases?page=${result.page - 1}`}
                className="rounded-md border px-3 py-1.5 hover:bg-accent"
              >
                ←
              </Link>
            )}
            {result.page < result.pageCount && (
              <Link
                href={`/purchases?page=${result.page + 1}`}
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
