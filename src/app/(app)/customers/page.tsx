import { requirePermission, getSessionContext, listAccessibleBranches } from "@/lib/permissions/authorize";
import { NoBranchPrompt } from "@/components/layout/no-branch-prompt";
import { PartyDialogButton } from "@/components/parties/party-dialog";
import { CustomerStatusButton } from "@/components/parties/status-button";
import { partyRepository } from "@/repositories/party.repository";
import { partyListSchema } from "@/schema/party.schema";
import { hasPermission } from "@/config/permissions";
import { formatIDR } from "@/lib/utils/format";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function CustomersPage({ searchParams }: Props) {
    const ctx = await requirePermission("customer.view");
    if (!ctx) {
        const branches = await listAccessibleBranches(await getSessionContext());
        return <NoBranchPrompt branches={branches} />;
    }

    const parsed = partyListSchema.safeParse(await searchParams);
    const params = parsed.success ? parsed.data : partyListSchema.parse({});
    const result = await partyRepository.listCustomers(params);

    const qs = (page: number) => {
        const p = new URLSearchParams({ status: params.status, pageSize: String(params.pageSize), page: String(page) });
        if (params.q) p.set("q", params.q);
        return `/customers?${p.toString()}`;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Pelanggan</h1>
                    <p className="text-sm text-muted-foreground">{result.total} pelanggan</p>
                </div>
                {hasPermission(ctx.role, "customer.create") && <PartyDialogButton variant="customer" />}
            </div>

            <form action="/customers" method="get" className="flex flex-wrap items-end gap-2 rounded-lg border p-4">
                <input name="q" defaultValue={params.q ?? ""} placeholder="Cari nama / kode / telepon…" className="input min-w-48 flex-1" />
                <select name="status" defaultValue={params.status} className="input w-32">
                    <option value="ACTIVE">Aktif</option>
                    <option value="INACTIVE">Nonaktif</option>
                    <option value="ALL">Semua</option>
                </select>
                <button type="submit" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">Filter</button>
            </form>

            {result.items.length === 0 ? (
                <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                    Tidak ada pelanggan.
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                        <thead className="border-b bg-muted/50 text-left">
                            <tr>
                                <th className="p-3">Kode</th><th className="p-3">Nama</th>
                                <th className="p-3">Telepon</th><th className="p-3">Email</th>
                                <th className="p-3 text-right">Limit Kredit</th>
                                <th className="p-3">Status</th><th className="p-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {result.items.map((c) => (
                                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                                    <td className="p-3 font-mono text-xs">{c.customerCode}</td>
                                    <td className="p-3 font-medium">{c.name}</td>
                                    <td className="p-3">{c.phone ?? "—"}</td>
                                    <td className="p-3">{c.email ?? "—"}</td>
                                    <td className="p-3 text-right">{formatIDR(c.creditLimit)}</td>
                                    <td className="p-3">
                                        <span className={c.status === "ACTIVE"
                                            ? "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800"
                                            : "rounded-full bg-muted px-2 py-0.5 text-xs"}>
                                            {c.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
                                        </span>
                                    </td>
                                    <td className="whitespace-nowrap p-3 text-right">
                                        {hasPermission(ctx.role, "customer.update") && (
                                            <span className="mr-2">
                                                <PartyDialogButton variant="customer" initial={{
                                                    id: c.id, name: c.name, phone: c.phone ?? "",
                                                    email: c.email ?? "", address: c.address ?? "",
                                                    creditLimit: c.creditLimit.toString(),
                                                }} />
                                            </span>
                                        )}
                                        {hasPermission(ctx.role, "customer.delete") && (
                                            <CustomerStatusButton id={c.id} active={c.status === "ACTIVE"} />
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
                        {result.page > 1 && <a href={qs(result.page - 1)} className="rounded-md border px-3 py-1.5 hover:bg-accent">← Sebelumnya</a>}
                        {result.page < result.pageCount && <a href={qs(result.page + 1)} className="rounded-md border px-3 py-1.5 hover:bg-accent">Berikutnya →</a>}
                    </div>
                </div>
            )}
        </div>
    );
}