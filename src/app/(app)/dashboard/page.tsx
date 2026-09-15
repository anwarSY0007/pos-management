import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { hasPermission } from "@/config/permissions";
import {
    getSessionContext,
    listAccessibleBranches,
} from "@/lib/permissions/authorize";
import { BranchSwitcher } from "@/components/layout/branch-switcher";

export default async function DashboardPage() {
    const ctx = await getSessionContext();
    if (!hasPermission(ctx.role, "dashboard.view")) redirect("/login");

    // Validasi branch aktif masih valid untuk user ini (read-only, sederhana)
    let activeBranch: { code: string; name: string } | null = null;

    if (ctx.activeBranchId) {
        if (ctx.isSuperAdmin) {
            const b = await prisma.branch.findUnique({
                where: { id: ctx.activeBranchId },
                select: { code: true, name: true, isActive: true },
            });
            if (b?.isActive) activeBranch = { code: b.code, name: b.name };
        } else {
            const m = await prisma.userBranch.findUnique({
                where: {
                    userId_branchId: {
                        userId: ctx.userId,
                        branchId: ctx.activeBranchId,
                    },
                },
                select: { branch: { select: { code: true, name: true } } },
            });
            if (m) activeBranch = m.branch;
        }
    }

    if (!activeBranch) {
        const branches = await listAccessibleBranches(ctx);
        return (
            <div className="mx-auto max-w-md space-y-4 rounded-lg border p-6">
                <h1 className="text-lg font-semibold">Pilih cabang aktif</h1>
                <p className="text-sm text-muted-foreground">
                    Pilih cabang untuk mulai bekerja. Semua data transaksi
                    terikat pada cabang aktif.
                </p>
                <BranchSwitcher branches={branches} activeBranchId={null} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                    Cabang aktif: <span className="font-medium">{activeBranch.code} · {activeBranch.name}</span>
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border p-4">
                    <div className="text-xs text-muted-foreground">Role</div>
                    <div className="mt-1 font-semibold">{ctx.role}</div>
                </div>
                <div className="rounded-lg border p-4">
                    <div className="text-xs text-muted-foreground">Penjualan hari ini</div>
                    <div className="mt-1 text-muted-foreground">Phase 4</div>
                </div>
                <div className="rounded-lg border p-4">
                    <div className="text-xs text-muted-foreground">Stok menipis</div>
                    <div className="mt-1 text-muted-foreground">Phase 3</div>
                </div>
                <div className="rounded-lg border p-4">
                    <div className="text-xs text-muted-foreground">Kas & Bank</div>
                    <div className="mt-1 text-muted-foreground">Phase 6</div>
                </div>
            </div>
        </div>
    );
}