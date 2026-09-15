import { BranchSwitcher } from "@/components/layout/branch-switcher";

export function NoBranchPrompt({ branches }: { branches: { id: string; code: string; name: string }[] }) {
    return (
        <div className="mx-auto max-w-md space-y-4 rounded-lg border p-6">
            <h1 className="text-lg font-semibold">Pilih cabang aktif</h1>
            <p className="text-sm text-muted-foreground">
                Pilih cabang untuk mulai bekerja. Semua data transaksi terikat pada cabang aktif.
            </p>
            <BranchSwitcher branches={branches} activeBranchId={null} />
        </div>
    );
}