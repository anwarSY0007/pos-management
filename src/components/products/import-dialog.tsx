"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { importProducts } from "@/actions/product/import-products";

export function ImportProductsButton() {
    const formRef = useRef<HTMLFormElement>(null);
    const [pending, setPending] = useState(false);
    const [errors, setErrors] = useState<string[] | null>(null);
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setPending(true);
        setErrors(null);
        const res = await importProducts(fd);
        setPending(false);
        if (res.success) {
            const { created, updated, failed, errors: rowErrors } = res.data;
            toast.success(`Import selesai: ${created} baru, ${updated} diperbarui, ${failed} gagal`);
            if (rowErrors.length > 0) setErrors(rowErrors);
            if (rowErrors.length === 0) e.currentTarget.reset();
            router.refresh();
        } else {
            toast.error(res.error);
        }
    }

    return (
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
                <input type="file" name="file" accept=".csv,text/csv" required
                    className="max-w-56 text-xs" />
                <button type="submit" disabled={pending}
                    className="rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50">
                    {pending ? "Mengimpor…" : "Import CSV"}
                </button>
            </div>
            {errors && (
                <div className="w-full max-w-xl rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs">
                    <p className="mb-1 font-medium text-destructive">Baris gagal (perbaiki lalu import ulang):</p>
                    <ul className="list-inside list-disc text-muted-foreground">
                        {errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                </div>
            )}
        </form>
    );
}