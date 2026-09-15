"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adjustStock, initializeStock } from "@/actions/inventory/inventory-actions";

function DialogShell({ title, children }: {
    title: string; onClose: () => void; children: React.ReactNode;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-24">
            <div className="w-full max-w-md rounded-lg border bg-background p-6">
                <h2 className="mb-4 text-lg font-semibold">{title}</h2>
                {children}
            </div>
        </div>
    );
}

export function InitializeStockButton({ productId }: { productId: string }) {
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState(false);
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setPending(true);
        const res = await initializeStock({
            productId,
            qty: String(fd.get("qty") ?? ""),
            note: String(fd.get("note") ?? ""),
        });
        setPending(false);
        if (res.success) {
            toast.success("Stok awal disimpan");
            setOpen(false);
            router.refresh();
        } else {
            toast.error(res.error);
        }
    }

    return (
        <>
            <button onClick={() => setOpen(true)} className="text-xs hover:underline">
                Set Stok Awal
            </button>
            {open && (
                <DialogShell title="Set Stok Awal" onClose={() => setOpen(false)}>
                    <form onSubmit={handleSubmit} className="grid gap-3">
                        <label className="grid gap-1 text-sm">
                            <span className="font-medium">Kuantitas *</span>
                            <input name="qty" inputMode="decimal" required className="input" placeholder="0" autoFocus />
                        </label>
                        <label className="grid gap-1 text-sm">
                            <span className="font-medium">Catatan</span>
                            <input name="note" className="input" placeholder="Stok fisik awal" />
                        </label>
                        <p className="text-xs text-muted-foreground">
                            Stok awal hanya bisa di-set sekali. Perubahan berikutnya via Penyesuaian.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setOpen(false)} className="rounded-md border px-4 py-2 text-sm hover:bg-accent">Batal</button>
                            <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
                                {pending ? "Menyimpan…" : "Simpan"}
                            </button>
                        </div>
                    </form>
                </DialogShell>
            )}
        </>
    );
}

export function AdjustStockButton({ productId }: { productId: string }) {
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState(false);
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setPending(true);
        const res = await adjustStock({
            productId,
            direction: String(fd.get("direction") ?? "IN"),
            qty: String(fd.get("qty") ?? ""),
            note: String(fd.get("note") ?? ""),
        });
        setPending(false);
        if (res.success) {
            toast.success("Penyesuaian disimpan");
            setOpen(false);
            router.refresh();
        } else {
            toast.error(res.error);
        }
    }

    return (
        <>
            <button onClick={() => setOpen(true)} className="text-xs hover:underline">
                Penyesuaian
            </button>
            {open && (
                <DialogShell title="Penyesuaian Stok" onClose={() => setOpen(false)}>
                    <form onSubmit={handleSubmit} className="grid gap-3">
                        <label className="grid gap-1 text-sm">
                            <span className="font-medium">Arah *</span>
                            <select name="direction" className="input" defaultValue="IN">
                                <option value="IN">Masuk (+)</option>
                                <option value="OUT">Keluar (−)</option>
                            </select>
                        </label>
                        <label className="grid gap-1 text-sm">
                            <span className="font-medium">Kuantitas *</span>
                            <input name="qty" inputMode="decimal" required className="input" placeholder="0" autoFocus />
                        </label>
                        <label className="grid gap-1 text-sm">
                            <span className="font-medium">Alasan * </span>
                            <input name="note" required className="input" placeholder="Rusak, hilang, hadiah, opname…" />
                        </label>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setOpen(false)} className="rounded-md border px-4 py-2 text-sm hover:bg-accent">Batal</button>
                            <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
                                {pending ? "Menyimpan…" : "Simpan"}
                            </button>
                        </div>
                    </form>
                </DialogShell>
            )}
        </>
    );
}