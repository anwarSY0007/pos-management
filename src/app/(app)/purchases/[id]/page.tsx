import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/permissions/authorize";
import { purchaseService } from "@/services/purchase.service";
import { formatIDR } from "@/lib/utils/format";
import { hasPermission } from "@/config/permissions";
import {
  OrderPurchaseButton,
  CancelPurchaseButton,
  ReceiveForm,
} from "@/components/purchases/purchase-buttons";

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requirePermission("purchase.view");
  if (!ctx) notFound();

  const { id } = await params;
  const p = await purchaseService.findById(id);
  if (!p || (p.branchId !== ctx.branchId && !ctx.isSuperAdmin)) notFound();

  const canManage = hasPermission(ctx.role, "purchase.update");
  const canReceive =
    hasPermission(ctx.role, "purchase.receive") &&
    (p.status === "ORDERED" || p.status === "PARTIAL");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-mono text-2xl font-bold">{p.purchaseNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {p.supplier.name} · dibuat {p.createdAt.toLocaleDateString("id-ID")}{" "}
            oleh {p.createdBy.name}
            {p.note ? ` · ${p.note}` : ""}
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs">
          {p.status}
        </span>
      </div>

      {p.status === "DRAFT" && canManage && (
        <div className="flex justify-end rounded-lg border bg-muted/30 p-3">
          <OrderPurchaseButton id={p.id} />
        </div>
      )}

      {canReceive && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Penerimaan Barang</h2>
          <ReceiveForm
            purchaseId={p.id}
            items={p.items.map((i) => ({
              itemId: i.id,
              sku: i.product.sku,
              name: i.product.name,
              ordered: i.quantity.toString(),
              received: i.quantityReceived.toString(),
            }))}
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="p-3">Produk</th>
              <th className="p-3 text-right">Qty</th>
              <th className="p-3 text-right">Diterima</th>
              <th className="p-3 text-right">Harga</th>
              <th className="p-3 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {p.items.map((i) => (
              <tr key={i.id} className="border-b last:border-0">
                <td className="p-3">{i.product.name}</td>
                <td className="p-3 text-right">{i.quantity.toString()}</td>
                <td className="p-3 text-right">
                  {i.quantityReceived.toString()}
                </td>
                <td className="p-3 text-right">{formatIDR(i.unitCost)}</td>
                <td className="p-3 text-right font-medium">
                  {formatIDR(i.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {p.payable && (
        <div className="rounded-lg border p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Utang (payable)</span>
            <span>{formatIDR(p.payable.amount)}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Dibayar</span>
            <span>{formatIDR(p.payable.paidAmount)}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Pelunasan via menu Keuangan (Phase 6)
          </div>
        </div>
      )}

      {(p.status === "DRAFT" || p.status === "ORDERED") &&
        hasPermission(ctx.role, "purchase.cancel") && (
          <div className="flex justify-end">
            <CancelPurchaseButton id={p.id} />
          </div>
        )}
    </div>
  );
}
