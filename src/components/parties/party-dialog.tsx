"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createCustomer,
  updateCustomer,
} from "@/actions/customer/customer-actions";
import {
  createSupplier,
  updateSupplier,
} from "@/actions/supplier/supplier-actions";
import { formatIDR } from "@/lib/utils/format";

export type PartyInitial = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  creditLimit?: string; // customer only
};

export function PartyDialogButton({
  variant,
  initial,
}: {
  variant: "customer" | "supplier";
  initial?: PartyInitial;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const isCustomer = variant === "customer";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const values = {
      name: String(fd.get("name") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      email: String(fd.get("email") ?? ""),
      address: String(fd.get("address") ?? ""),
      creditLimit: String(fd.get("creditLimit") ?? "0"),
    };
    setPending(true);
    setError(null);
    const res = initial
      ? isCustomer
        ? await updateCustomer(initial.id, values)
        : await updateSupplier(initial.id, values)
      : isCustomer
        ? await createCustomer(values)
        : await createSupplier(values);
    setPending(false);
    if (res.success) {
      toast.success(
        initial
          ? "Data diperbarui"
          : isCustomer
            ? "Pelanggan ditambahkan"
            : "Supplier ditambahkan",
      );
      setOpen(false);
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
      >
        {initial ? "Edit" : isCustomer ? "+ Pelanggan" : "+ Supplier"}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16">
          <div className="w-full max-w-lg rounded-lg border bg-background p-6">
            <h2 className="mb-4 text-lg font-semibold">
              {initial ? "Edit" : "Tambah"}{" "}
              {isCustomer ? "Pelanggan" : "Supplier"}
            </h2>
            {initial && (
              <p className="mb-3 text-xs text-muted-foreground">
                <span className="font-mono">{initial.id}</span>
              </p>
            )}
            <form onSubmit={handleSubmit} className="grid gap-3">
              {error && (
                <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <LabeledInput
                name="name"
                label="Nama *"
                defaultValue={initial?.name}
                required
              />
              <LabeledInput
                name="phone"
                label="Telepon"
                defaultValue={initial?.phone}
              />
              <LabeledInput
                name="email"
                label="Email"
                type="email"
                defaultValue={initial?.email}
              />
              <LabeledInput
                name="address"
                label="Alamat"
                defaultValue={initial?.address}
              />
              {isCustomer && (
                <LabeledInput
                  name="creditLimit"
                  label="Limit Kredit (IDR)"
                  inputMode="decimal"
                  defaultValue={initial?.creditLimit ?? "0"}
                  hint={
                    initial?.creditLimit
                      ? `Saat ini: ${formatIDR(initial.creditLimit)}`
                      : undefined
                  }
                />
              )}
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {pending ? "Menyimpan…" : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function LabeledInput({
  label,
  hint,
  ...props
}: {
  label: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input {...props} className="input" />
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
