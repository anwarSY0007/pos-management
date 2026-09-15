"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  receiveTransfer,
  cancelTransfer,
} from "@/actions/inventory/transfer-actions";

export function ReceiveTransferButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (
      !confirm(
        "Terima seluruh item transfer ini? Stok cabang aktif akan bertambah.",
      )
    )
      return;
    startTransition(async () => {
      const res = await receiveTransfer(id);
      if (res.success) {
        toast.success("Transfer diterima");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="text-xs font-medium text-green-700 hover:underline disabled:opacity-50"
    >
      Terima
    </button>
  );
}

export function CancelTransferButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Batalkan transfer? Stok dikembalikan ke cabang pengirim."))
      return;
    startTransition(async () => {
      const res = await cancelTransfer(id);
      if (res.success) {
        toast.success("Transfer dibatalkan");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="text-xs text-muted-foreground hover:underline disabled:opacity-50"
    >
      Batalkan
    </button>
  );
}
