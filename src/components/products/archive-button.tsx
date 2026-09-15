"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setProductStatus } from "@/actions/product/product-actions";

export function ArchiveButton({ id, archived }: { id: string; archived: boolean }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    function handleClick() {
        const next = archived ? "ACTIVE" : "ARCHIVED";
        const label = archived ? "pulihkan" : "arsipkan";
        if (!confirm(`Yakin ${label} produk ini?`)) return; // destructive → confirmation wajib
        startTransition(async () => {
            const res = await setProductStatus(id, next);
            if (res.success) { toast.success(`Produk ${archived ? "dipulihkan" : "diarsipkan"}`); router.refresh(); }
            else toast.error(res.error);
        });
    }

    return (
        <button onClick={handleClick} disabled={pending} className="text-xs text-muted-foreground hover:underline disabled:opacity-50">
            {archived ? "Pulihkan" : "Arsipkan"}
        </button>
    );
}