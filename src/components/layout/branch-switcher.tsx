"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { switchBranch } from "@/actions/branch/switch-branch";

type BranchOption = { id: string; code: string; name: string };

export function BranchSwitcher({
    branches,
    activeBranchId,
}: {
    branches: BranchOption[];
    activeBranchId: string | null;
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    if (branches.length === 0) {
        return (
            <span className="text-sm text-muted-foreground">
                Belum ada cabang — hubungi admin
            </span>
        );
    }

    function handleChange(value: string) {
        if (!value) return;
        startTransition(async () => {
            const res = await switchBranch(value);
            if (res.success) {
                router.refresh();
            }
        });
    }

    return (
        <select
            value={activeBranchId ?? ""}
            onChange={(e) => handleChange(e.target.value)}
            disabled={pending}
            aria-label="Cabang aktif"
            className="rounded-md border bg-background px-3 py-1.5 text-sm disabled:opacity-50"
        >
            {!activeBranchId && <option value="">— Pilih cabang —</option>}
            {branches.map((b) => (
                <option key={b.id} value={b.id}>
                    {b.code} · {b.name}
                </option>
            ))}
        </select>
    );
}