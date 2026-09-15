"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createProductSchema, type CreateProductInput } from "@/schema/product.schema";
import { createProduct, updateProduct } from "@/actions/product/product-actions";

type Option = { id: string; name: string };

const EMPTY: CreateProductInput = {
    sku: "", barcode: "", name: "", description: "",
    categoryId: "", brandId: "", unitId: "",
    purchasePrice: "", sellingPrice: "", minimumStock: "0", taxRate: "0", imageUrl: "",
};

export function ProductForm({
    categories,
    brands,
    units,
    initial,
}: {
    categories: Option[];
    brands: Option[];
    units: Option[];
    initial?: CreateProductInput & { id: string };
}) {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    const form = useForm<CreateProductInput>({
        resolver: zodResolver(createProductSchema),
        defaultValues: initial ?? EMPTY,
    });

    const onSubmit = form.handleSubmit(async (values) => {
        setError(null);
        const res = initial
            ? await updateProduct(initial.id, values)
            : await createProduct(values);
        if (res.success) {
            toast.success(initial ? "Produk diperbarui" : "Produk dibuat");
            if (initial) {
                router.push("/products");
            } else {
                form.reset(EMPTY);
                router.refresh();
            }
        } else {
            setError(res.error);
            toast.error(res.error);
        }
    });

    const pending = form.formState.isSubmitting;

    return (
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            {error && (
                <p className="sm:col-span-2 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
                    {error}
                </p>
            )}

            <Field label="SKU *" error={form.formState.errors.sku?.message}>
                <input {...form.register("sku")} className="input" placeholder="SKU-0001" />
            </Field>
            <Field label="Barcode" error={form.formState.errors.barcode?.message}>
                <input {...form.register("barcode")} className="input" placeholder="8998866200011" />
            </Field>
            <Field label="Nama *" error={form.formState.errors.name?.message}>
                <input {...form.register("name")} className="input" />
            </Field>
            <Field label="Kategori">
                <select {...form.register("categoryId")} className="input">
                    <option value="">—</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </Field>
            <Field label="Merek">
                <select {...form.register("brandId")} className="input">
                    <option value="">—</option>
                    {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
            </Field>
            <Field label="Satuan">
                <select {...form.register("unitId")} className="input">
                    <option value="">—</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
            </Field>
            <Field label="Harga Beli *" error={form.formState.errors.purchasePrice?.message}>
                <input {...form.register("purchasePrice")} className="input" inputMode="decimal" placeholder="0" />
            </Field>
            <Field label="Harga Jual *" error={form.formState.errors.sellingPrice?.message}>
                <input {...form.register("sellingPrice")} className="input" inputMode="decimal" placeholder="0" />
            </Field>
            <Field label="Stok Minimum" error={form.formState.errors.minimumStock?.message}>
                <input {...form.register("minimumStock")} className="input" inputMode="decimal" placeholder="0" />
            </Field>
            <Field label="PPN (%)" error={form.formState.errors.taxRate?.message}>
                <input {...form.register("taxRate")} className="input" inputMode="decimal" placeholder="0" />
            </Field>
            <Field label="Deskripsi" className="sm:col-span-2">
                <textarea {...form.register("description")} className="input min-h-20" />
            </Field>

            <div className="sm:col-span-2 flex justify-end gap-2">
                <button
                    type="submit"
                    disabled={pending}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                    {pending ? "Menyimpan…" : initial ? "Simpan" : "Tambah Produk"}
                </button>
            </div>
        </form>
    );
}

function Field({
    label, error, className, children,
}: {
    label: string; error?: string; className?: string; children: React.ReactNode;
}) {
    return (
        <label className={`grid gap-1 text-sm ${className ?? ""}`}>
            <span className="font-medium">{label}</span>
            {children}
            {error && <span className="text-xs text-destructive">{error}</span>}
        </label>
    );
}