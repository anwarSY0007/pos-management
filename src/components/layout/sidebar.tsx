import Link from "next/link";
import { filterNavByPermission, NAV_ITEMS } from "@/config/navigation";
import type { Role } from "@/types/auth";

export function Sidebar({ role }: { role: Role }) {
    const items = filterNavByPermission(NAV_ITEMS, role);

    return (
        <aside className="hidden w-60 shrink-0 border-r md:block">
            <div className="px-4 py-4 text-lg font-bold tracking-tight">POS</div>
            <nav className="flex flex-col gap-1 px-2">
                {items.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                    >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                    </Link>
                ))}
            </nav>
        </aside>
    );
}