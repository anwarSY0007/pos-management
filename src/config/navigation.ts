import {
  ArrowLeftRight,
  Boxes,
  ClipboardCheck,
  Folder,
  LayoutDashboard,
  Package,
  PackagePlus,
  Receipt,
  Settings,
  ShoppingCart,
  TrafficCone,
  Truck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { hasPermission, type Permission } from "@/config/permissions";
import type { Role } from "@/types/auth";

export type NavItem = {
  label: string;
  href: string;
  permission: Permission;
  icon: LucideIcon;
};

/**
 * Navigation terpusat — difilter berdasarkan permission role.
 * Item baru ditambahkan per-phase (Phase 2: Products, dst.).
 * Filter menu = UX saja; server tetap authorize.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    permission: "dashboard.view",
    icon: LayoutDashboard,
  },
  { label: "POS", href: "/pos", permission: "sale.create", icon: ShoppingCart },
  {
    label: "Penjualan",
    href: "/sales",
    permission: "sale.view",
    icon: Receipt,
  },
  {
    label: "Pengaturan",
    href: "/settings",
    permission: "settings.view",
    icon: Settings,
  },
  {
    label: "Produk",
    href: "/products",
    permission: "product.view",
    icon: Package,
  },
  {
    label: "Kategori",
    href: "/categories",
    permission: "category.view",
    icon: Folder,
  },
  {
    label: "Pelanggan",
    href: "/customers",
    permission: "customer.view",
    icon: Users,
  },
  {
    label: "Supplier",
    href: "/suppliers",
    permission: "supplier.view",
    icon: Truck,
  },
  {
    label: "Stok",
    href: "/inventory",
    permission: "inventory.view",
    icon: Boxes,
  },
  {
    label: "Mutasi Stok",
    href: "/inventory/movements",
    permission: "inventory.view",
    icon: ArrowLeftRight,
  },
  {
    label: "Transfer Stok",
    href: "/inventory/transfers",
    permission: "inventory.view",
    icon: TrafficCone,
  },
  {
    label: "Stock Opname",
    href: "/inventory/opnames",
    permission: "inventory.view",
    icon: ClipboardCheck,
  },
  {
    label: "Pembelian",
    href: "/purchases",
    permission: "purchase.view",
    icon: PackagePlus,
  },
];

export function filterNavByPermission(items: NavItem[], role: Role): NavItem[] {
  return items.filter((item) => hasPermission(role, item.permission));
}
