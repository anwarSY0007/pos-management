"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelSale } from "@/actions/sale/sale-actions";

export function CancelSaleButton({
  id,
  invoiceNumber,
}: {
  id: string;
  invoiceNumber: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (
      !confirm(
        `Batalkan ${invoiceNumber}? Stok dikembalikan & jurnal dibalik. Tindakan ini tercatat di audit log.`,
      )
    )
      return;
    startTransition(async () => {
      const res = await cancelSale(id);
      if (res.success) {
        toast.success("Transaksi dibatalkan");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="rounded-md border border-destructive/50 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
    >
      Batalkan Transaksi
    </button>
  );
}
