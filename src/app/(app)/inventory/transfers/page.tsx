import Link from "next/link";
import prisma from "@/lib/db";
import {
  requirePermission,
  getSessionContext,
  listAccessibleBranches,
} from "@/lib/permissions/authorize";
import { NoBranchPrompt } from "@/components/layout/no-branch-prompt";
import { inventoryService } from "@/services/inventory.service";
import { SendTransferButton } from "@/components/inventory/transfer-dialog";
import {
  ReceiveTransferButton,
  CancelTransferButton,
} from "@/components/inventory/transfer-buttons";
import { hasPermission } from "@/config/permissions";

const STATUS_BADGE: Record<string, string> = {
  IN_TRANSIT: "bg-yellow-100 text-yellow-800",
  RECEIVED: "bg-green-100 text-green-800",
  CANCELLED: "bg-muted text-muted-foreground",
};
const STATUS_LABEL: Record<string, string> = {
  IN_TRANSIT: "Dalam Pengiriman",
  RECEIVED: "Diterima",
  CANCELLED: "Dibatalkan",
};

export default async function TransfersPage() {
  const ctx = await requirePermission("inventory.view");
  if (!ctx) {
    const branches = await listAccessibleBranches(await getSessionContext());
    return <NoBranchPrompt branches={branches} />;
  }

  const canTransfer = hasPermission(ctx.role, "inventory.transfer");

  const [result, branches, products] = await Promise.all([
    inventoryService.listTransfers(ctx.branchId, { status: "ALL" }),
    canTransfer ? listAccessibleBranches(ctx) : Promise.resolve([]),
    canTransfer
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
          <h1 className="text-2xl font-bold">Transfer Stok</h1>
          <p className="text-sm text-muted-foreground">
            Kirim & terima stok antar cabang · {result.total} transfer
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/inventory"
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
          >
            ← Stok
          </Link>
          {canTransfer && (
            <SendTransferButton branches={branches} products={products} />
          )}
        </div>
      </div>

      {result.items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Belum ada transfer.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                <th className="p-3">Nomor</th>
                <th className="p-3">Rute</th>
                <th className="p-3 text-right">Item</th>
                <th className="p-3">Dikirim</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((t) => {
                const isDestination = t.toBranch.id === ctx.branchId;
                const isOrigin = t.fromBranch.id === ctx.branchId;
                return (
                  <tr
                    key={t.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="p-3 font-mono text-xs">
                      {t.transferNumber}
                    </td>
                    <td className="p-3">
                      {t.fromBranch.code} → {t.toBranch.code}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {isDestination
                          ? "(tujuan saya)"
                          : isOrigin
                            ? "(pengirim)"
                            : ""}
                      </span>
                    </td>
                    <td className="p-3 text-right">{t._count.items}</td>
                    <td className="p-3 text-xs whitespace-nowrap">
                      {t.sentAt.toLocaleString("id-ID", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[t.status] ?? ""}`}
                      >
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {t.status === "IN_TRANSIT" && canTransfer && (
                        <>
                          {isDestination && <ReceiveTransferButton id={t.id} />}
                          {isOrigin && <CancelTransferButton id={t.id} />}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
