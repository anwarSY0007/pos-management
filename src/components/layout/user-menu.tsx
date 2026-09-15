"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function UserMenu({
    name,
    email,
    role,
}: {
    name: string;
    email: string;
    role: string;
}) {
    const router = useRouter();

    async function handleSignOut() {
        await authClient.signOut();
        router.push("/login");
        router.refresh();
    }

    return (
        <div className="flex items-center gap-3 text-sm">
            <div className="text-right">
                <div className="font-medium">{name}</div>
                <div className="text-xs text-muted-foreground">
                    {email} · {role}
                </div>
            </div>
            <button
                onClick={handleSignOut}
                className="rounded-md border px-3 py-1.5 hover:bg-accent"
            >
                Keluar
            </button>
        </div>
    );
}