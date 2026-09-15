import Link from "next/link";
import prisma from "@/lib/db";
import {
  requirePermission,
  getSessionContext,
  listAccessibleBranches,
} from "@/lib/permissions/authorize";
import { NoBranchPrompt } from "@/components/layout/no-branch-prompt";
import { inventoryService } from "@/services/inventory.service";
import { CreateOpnameButton } from "@/components/inventory/opname-dialog";
import { hasPermission } from "@/config/permissions";

export default async function OpnamesPage() {
  const ctx = await requirePermission("inventory.view");
  if (!ctx) {
    const branches = await listAccessibleBranches(await getSessionContext());
    return <NoBranchPrompt branches={branches} />;
  }

  const canOpname = hasPermission(ctx.role, "inventory.opname");

  const [result, products] = await Promise.all([
    inventoryService.listOpnames(ctx.branchId, { status: "ALL" }),
    canOpname
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
          <h1 className="text-2xl font-bold">Stock Opname</h1>
          <p className="text-sm text-muted-foreground">
            Rekonsiliasi stok fisik vs sistem · {result.total} opname
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/inventory"
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            ← Stok
          </Link>
          {canOpname && <CreateOpnameButton products={products} />}
        </div>
      </div>

      {result.items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Belum ada opname.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                <th className="p-3">Nomor</th>
                <th className="p-3 text-right">Item</th>
                <th className="p-3">Dibuat</th>
                <th className="p-3">Oleh</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((o) => (
                <tr
                  key={o.id}
                  className="border-b last:border-0 hover:bg-muted/30"
                >
                  <td className="p-3 font-mono text-xs">{o.opnameNumber}</td>
                  <td className="p-3 text-right">{o._count.items}</td>
                  <td className="p-3 text-xs whitespace-nowrap">
                    {o.createdAt.toLocaleString("id-ID", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="p-3 text-xs">{o.createdBy.name}</td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        o.status === "DRAFT"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {o.status === "DRAFT" ? "Draft" : "Selesai"}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      href={`/inventory/opnames/${o.id}`}
                      className="text-xs hover:underline"
                    >
                      {o.status === "DRAFT" ? "Lanjutkan →" : "Detail →"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
