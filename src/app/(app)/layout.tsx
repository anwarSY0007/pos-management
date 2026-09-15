import type { ReactNode } from "react";
import { requireAuth } from "@/lib/auth-server";
import {
    getSessionContext,
    listAccessibleBranches,
} from "@/lib/permissions/authorize";
import { Sidebar } from "@/components/layout/sidebar";
import { BranchSwitcher } from "@/components/layout/branch-switcher";
import { UserMenu } from "@/components/layout/user-menu";

export default async function AppLayout({ children }: { children: ReactNode }) {
    const session = await requireAuth();
    const ctx = await getSessionContext();
    const branches = await listAccessibleBranches(ctx);

    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar role={ctx.role} />
            <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex items-center justify-between gap-4 border-b px-6 py-3">
                    <BranchSwitcher
                        branches={branches}
                        activeBranchId={ctx.activeBranchId}
                    />
                    <UserMenu
                        name={session.user.name}
                        email={session.user.email}
                        role={ctx.role}
                    />
                </header>
                <main className="flex-1 p-6">{children}</main>
            </div>
        </div>
    );
}