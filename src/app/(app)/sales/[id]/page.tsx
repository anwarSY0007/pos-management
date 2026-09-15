import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/permissions/authorize";
import { saleService } from "@/services/sale.service";
import { formatIDR } from "@/lib/utils/format";
import { hasPermission } from "@/config/permissions";
import { CancelSaleButton } from "@/components/sales/cancel-sale-button";

const METHOD_LABEL: Record<string, string> = {
  CASH: "Tunai",
  BANK_TRANSFER: "Transfer",
  QRIS: "QRIS",
  DEBIT: "Kartu Debit",
  CREDIT: "Kredit",
  E_WALLET: "E-Wallet",
};

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requirePermission("sale.view");
  if (!ctx) notFound();

  const { id } = await params;
  const sale = await saleService.findById(id);
  if (!sale || (sale.branchId !== ctx.branchId && !ctx.isSuperAdmin))
    notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-mono text-2xl font-bold">{sale.invoiceNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {sale.createdAt.toLocaleString("id-ID")} · {sale.branch.name} ·
            kasir {sale.cashier.name}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs ${
            sale.status === "COMPLETED"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {sale.status === "COMPLETED" ? "Selesai" : "Dibatalkan"}
        </span>
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="p-3">Produk</th>
              <th className="p-3 text-right">Qty</th>
              <th className="p-3 text-right">Harga</th>
              <th className="p-3 text-right">Disc</th>
              <th className="p-3 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((i) => (
              <tr key={i.id} className="border-b last:border-0">
                <td className="p-3">
                  <div className="font-medium">{i.productName}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {i.sku}
                  </div>
                </td>
                <td className="p-3 text-right">{i.quantity.toString()}</td>
                <td className="p-3 text-right">{formatIDR(i.unitPrice)}</td>
                <td className="p-3 text-right">
                  {i.discount.gt(0) ? formatIDR(i.discount) : "—"}
                </td>
                <td className="p-3 text-right font-medium">
                  {formatIDR(i.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 rounded-lg border p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatIDR(sale.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Diskon nota</span>
            <span>−{formatIDR(sale.discount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">PPN</span>
            <span>{formatIDR(sale.tax)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 text-base font-bold">
            <span>Total</span>
            <span>{formatIDR(sale.grandTotal)}</span>
          </div>
        </div>
        <div className="space-y-1 rounded-lg border p-4 text-sm">
          {sale.payments.map((p) => (
            <div key={p.id} className="flex justify-between">
              <span className="text-muted-foreground">
                {METHOD_LABEL[p.method] ?? p.method}
                {p.reference ? ` · ${p.reference}` : ""}
              </span>
              <span>{formatIDR(p.amount)}</span>
            </div>
          ))}
          {sale.payments.length === 0 && (
            <div className="text-muted-foreground">
              Tanpa pembayaran tercatat
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Kembalian</span>
            <span>{formatIDR(sale.changeAmount)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 font-semibold">
            <span>Status bayar</span>
            <span>
              {sale.paymentStatus === "PAID"
                ? "Lunas"
                : sale.paymentStatus === "PARTIAL"
                  ? "Sebagian"
                  : "Belum bayar"}
            </span>
          </div>
          {sale.customer && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pelanggan</span>
              <span>{sale.customer.name}</span>
            </div>
          )}
          {sale.note && (
            <div className="pt-1 text-xs text-muted-foreground">
              Catatan: {sale.note}
            </div>
          )}
        </div>
      </div>

      {sale.status === "COMPLETED" &&
        hasPermission(ctx.role, "sale.cancel") && (
          <div className="flex justify-end">
            <CancelSaleButton id={sale.id} invoiceNumber={sale.invoiceNumber} />
          </div>
        )}
    </div>
  );
}
