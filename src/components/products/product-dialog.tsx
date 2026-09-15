"use client";

import { useState } from "react";
import { ProductForm } from "@/components/products/product-form";
import { Option } from "./types";

export function CreateProductButton({ categories, brands, units }: {
    categories: Option[]; brands: Option[]; units: Option[];
}) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
                + Produk Baru
            </button>
            {open && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16">
                    <div className="w-full max-w-2xl rounded-lg border bg-background p-6">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Produk Baru</h2>
                            <button onClick={() => setOpen(false)} className="text-sm text-muted-foreground hover:underline">Tutup</button>
                        </div>
                        <ProductForm categories={categories} brands={brands} units={units} />
                    </div>
                </div>
            )}
        </>
    );
}