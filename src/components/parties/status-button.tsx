"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setCustomerStatus } from "@/actions/customer/customer-actions";
import { setSupplierStatus } from "@/actions/supplier/supplier-actions";

export function CustomerStatusButton({ id, active }: { id: string; active: boolean }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    function handleClick() {
        const next = active ? "INACTIVE" : "ACTIVE";
        if (!confirm(active ? "Nonaktifkan pelanggan ini?" : "Aktifkan kembali pelanggan ini?")) return;
        startTransition(async () => {
            const res = await setCustomerStatus(id, next);
            if (res.success) { toast.success("Status diperbarui"); router.refresh(); }
            else toast.error(res.error);
        });
    }

    return (
        <button onClick={handleClick} disabled={pending}
            className="text-xs text-muted-foreground hover:underline disabled:opacity-50">
            {active ? "Nonaktifkan" : "Aktifkan"}
        </button>
    );
}

export function SupplierStatusButton({ id, active }: { id: string; active: boolean }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    function handleClick() {
        const next = active ? "INACTIVE" : "ACTIVE";
        if (!confirm(active ? "Nonaktifkan pemasok ini?" : "Aktifkan kembali pemasok ini?")) return;
        startTransition(async () => {
            const res = await setSupplierStatus(id, next);
            if (res.success) { toast.success("Status diperbarui"); router.refresh(); }
            else toast.error(res.error);
        });
    }

    return (
        <button onClick={handleClick} disabled={pending}
            className="text-xs text-muted-foreground hover:underline disabled:opacity-50">
            {active ? "Nonaktifkan" : "Aktifkan"}
        </button>
    );
}