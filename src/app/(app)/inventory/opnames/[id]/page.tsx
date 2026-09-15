import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/permissions/authorize";
import { inventoryService } from "@/services/inventory.service";
import { OpnameCompleteForm } from "@/components/inventory/opname-complete-form";
import { toMoney } from "@/lib/utils/money";

export default async function OpnameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requirePermission("inventory.opname");
  if (!ctx) notFound();

  const { id } = await params;
  const opname = await inventoryService.findOpnameById(id);
  if (!opname || opname.branchId !== ctx.branchId) notFound();

  if (opname.status === "COMPLETED") {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold">{opname.opnameNumber}</h1>
        <p className="text-sm text-muted-foreground">
          Selesai · {opname.completedAt?.toLocaleString("id-ID")} · oleh{" "}
          {opname.completedBy?.name}
        </p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                <th className="p-3">Produk</th>
                <th className="p-3 text-right">Snapshot</th>
                <th className="p-3 text-right">Hitung Fisik</th>
                <th className="p-3 text-right">Selisih vs Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {opname.items.map((i) => (
                <tr key={i.id} className="border-b last:border-0">
                  <td className="p-3">{i.product.name}</td>
                  <td className="p-3 text-right font-mono">
                    {i.expectedQty.toString()}
                  </td>
                  <td className="p-3 text-right font-mono">
                    {i.countedQty?.toString() ?? "—"}
                  </td>
                  <td
                    className={`p-3 text-right font-mono ${
                      (i.diffQty ?? toMoney(0)).gt(0)
                        ? "text-green-700"
                        : (i.diffQty ?? toMoney(0)).lt(0)
                          ? "text-red-700"
                          : "text-muted-foreground"
                    }`}
                  >
                    {i.diffQty === null
                      ? "—"
                      : `${i.diffQty.gt(0) ? "+" : ""}${i.diffQty.toString()}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Nilai jurnal opname ini berbasis stok SAAT diselesaikan (bukan
          snapshot) — lihat Mutasi Stok & jurnal untuk detail.
        </p>
      </div>
    );
  }

  // DRAFT → form hitungan fisik
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{opname.opnameNumber}</h1>
        <p className="text-sm text-muted-foreground">
          Hitung fisik untuk {opname.items.length} produk. Delta = fisik − stok
          saat ini.
        </p>
      </div>
      <OpnameCompleteForm
        opnameId={opname.id}
        items={opname.items.map((i) => ({
          itemId: i.id,
          sku: i.product.sku,
          name: i.product.name,
          expectedQty: i.expectedQty.toString(),
        }))}
      />
    </div>
  );
}
