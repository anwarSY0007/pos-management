import type { Role } from "@/types/auth"

/**
 * Single source of truth untuk permission granular.
 * Enforcement SELALU di server via authorize() / requirePermission().
 * Permission UI (menu, tombol) hanyalah UX — bukan security.
 */

export const PERMISSIONS = [
  "dashboard.view",

  "product.view",
  "product.create",
  "product.update",
  "product.delete",
  "product.archive",
  "product.import",
  "product.export",

  "category.view",
  "category.create",
  "category.update",
  "category.delete",

  "inventory.view",
  "inventory.adjust",
  "inventory.opname",
  "inventory.transfer",

  "sale.view",
  "sale.create",
  "sale.cancel",
  "sale.return",

  "purchase.view",
  "purchase.create",
  "purchase.update",
  "purchase.receive",
  "purchase.cancel",
  "purchase.return",

  "customer.view",
  "customer.create",
  "customer.update",
  "customer.delete",
  "supplier.view",
  "supplier.create",
  "supplier.update",
  "supplier.delete",

  "payment.create",
  "payment.refund",
  "cash.view",
  "cash.manage",

  "expense.view",
  "expense.create",
  "expense.update",
  "expense.delete",

  "receivable.view",
  "receivable.payment",
  "payable.view",
  "payable.payment",

  "accounting.view",
  "accounting.journal",
  "accounting.ledger",

  "report.view",

  "user.view",
  "user.create",
  "user.update",
  "user.delete",

  "branch.view",
  "branch.create",
  "branch.update",
  "branch.delete",

  "settings.view",
  "settings.update",
] as const;

export type Permission = (typeof PERMISSIONS)[number]

const PRODUCT_MANAGE: Permission[] = [
    "product.view", "product.create", "product.update",
    "product.delete", "product.archive", "product.import", "product.export",
]

const PARTY_MANAGE: Permission[] = [
    "customer.view", "customer.create", "customer.update", "customer.delete",
    "supplier.view", "supplier.create", "supplier.update", "supplier.delete",
]

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: PERMISSIONS,

  OWNER: [
    "dashboard.view",
    ...PRODUCT_MANAGE,
    "category.view",
    "category.create",
    "category.update",
    "category.delete",
    "inventory.view",
    "inventory.adjust",
    "sale.view",
    "sale.create",
    "sale.cancel",
    "sale.return",
    "purchase.view",
    "purchase.create",
    "purchase.update",
    "purchase.receive",
    "purchase.cancel",
    "purchase.return",
    ...PARTY_MANAGE,
    "payment.create",
    "payment.refund",
    "expense.view",
    "expense.create",
    "expense.update",
    "expense.delete",
    "receivable.view",
    "receivable.payment",
    "payable.view",
    "payable.payment",
    "accounting.view",
    "accounting.journal",
    "accounting.ledger",
    "report.view",
    "user.view",
    "user.create",
    "user.update",
    "user.delete",
    "branch.view",
    "branch.update",
    "settings.view",
    "settings.update",
    "cash.view",
    "cash.manage",
  ],

  ADMIN: [
    "dashboard.view",
    ...PRODUCT_MANAGE,
    "category.view",
    "category.create",
    "category.update",
    "category.delete",
    "inventory.view",
    "sale.view",
    "sale.create",
    "sale.cancel",
    "sale.return",
    "purchase.view",
    "purchase.create",
    "purchase.update",
    "purchase.receive",
    "purchase.cancel",
    "purchase.return",
    ...PARTY_MANAGE,
    "payment.create",
    "receivable.view",
    "payable.view",
    "cash.view",
    "cash.manage",
    "report.view",
  ],

  CASHIER: [
    "dashboard.view",
    "product.view",
    "sale.view",
    "sale.create",
    "payment.create",
    "customer.view",
    "customer.create",
    "customer.update",
    "report.view",
  ],

  WAREHOUSE: [
    "dashboard.view",
    "product.view",
    "inventory.view",
    "inventory.adjust",
    "inventory.opname",
    "inventory.transfer",
    "purchase.view",
    "purchase.receive",
    "report.view",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
    return ROLE_PERMISSIONS[role].includes(permission)
}