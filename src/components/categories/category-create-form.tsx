"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createCategory } from "@/actions/category/category-actions";

export function CategoryCreateForm() {
    const [name, setName] = useState("");
    const [pending, setPending] = useState(false);
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setPending(true);
        const res = await createCategory({ name });
        setPending(false);
        if (res.success) { toast.success("Kategori dibuat"); setName(""); router.refresh(); }
        else toast.error(res.error);
    }

    return (
        <form onSubmit={handleSubmit} className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama kategori baru" className="input flex-1" />
            <button type="submit" disabled={pending || !name.trim()} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
                Tambah
            </button>
        </form>
    );
}