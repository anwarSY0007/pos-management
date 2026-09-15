import { redirect } from "next/navigation";
import { hasPermission } from "@/config/permissions";
import { getSessionContext } from "@/lib/permissions/authorize";

export default async function SettingsPage() {
    const ctx = await getSessionContext();
    if (!hasPermission(ctx.role, "settings.view")) redirect("/dashboard");

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">Pengaturan</h1>
            <p className="text-sm text-muted-foreground">
                Manajemen setting sistem akan hadir di Phase selanjutnya.
            </p>
        </div>
    );
}