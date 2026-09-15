import { describe, expect, it } from "vitest";
import { hasPermission, PERMISSIONS, ROLE_PERMISSIONS } from "@/config/permissions";

describe("RBAC matrix", () => {
    it("SUPER_ADMIN memiliki semua permission", () => {
        for (const p of PERMISSIONS) {
            expect(hasPermission("SUPER_ADMIN", p)).toBe(true);
        }
    });

    it("CASHIER: bisa jual & bayar; TIDAK bisa ubah stok, user, purchase, akuntansi", () => {
        expect(hasPermission("CASHIER", "sale.create")).toBe(true);
        expect(hasPermission("CASHIER", "payment.create")).toBe(true);
        expect(hasPermission("CASHIER", "customer.create")).toBe(true);
        expect(hasPermission("CASHIER", "inventory.adjust")).toBe(false);
        expect(hasPermission("CASHIER", "cash.manage")).toBe(false);
        expect(hasPermission("CASHIER", "sale.cancel")).toBe(false);
        expect(hasPermission("CASHIER", "purchase.receive")).toBe(false);
        expect(hasPermission("CASHIER", "user.update")).toBe(false);
        expect(hasPermission("CASHIER", "accounting.view")).toBe(false);
        expect(hasPermission("CASHIER", "expense.create")).toBe(false);
    });

    it("WAREHOUSE: bisa inventory & receiving; TIDAK bisa sale.create / payment / user", () => {
        expect(hasPermission("WAREHOUSE", "inventory.opname")).toBe(true);
        expect(hasPermission("WAREHOUSE", "inventory.transfer")).toBe(true);
        expect(hasPermission("WAREHOUSE", "purchase.receive")).toBe(true);
        expect(hasPermission("WAREHOUSE", "sale.create")).toBe(false);
        expect(hasPermission("WAREHOUSE", "payment.create")).toBe(false);
        expect(hasPermission("WAREHOUSE", "product.create")).toBe(false);
        expect(hasPermission("WAREHOUSE", "user.view")).toBe(false);
    });

    it("ADMIN: kelola produk & penjualan cabang; TIDAK ada akuntansi & expense", () => {
        expect(hasPermission("ADMIN", "product.create")).toBe(true);
        expect(hasPermission("ADMIN", "sale.cancel")).toBe(true);
        expect(hasPermission("ADMIN", "purchase.receive")).toBe(true);
        expect(hasPermission("ADMIN", "accounting.view")).toBe(false);
        expect(hasPermission("ADMIN", "expense.create")).toBe(false);
        expect(hasPermission("ADMIN", "user.create")).toBe(false);
        expect(hasPermission("ADMIN", "settings.update")).toBe(false);
    });

    it("OWNER: full finance + accounting + user, TAPI tidak create/delete branch", () => {
        expect(hasPermission("OWNER", "expense.create")).toBe(true);
        expect(hasPermission("OWNER", "receivable.payment")).toBe(true);
        expect(hasPermission("OWNER", "accounting.ledger")).toBe(true);
        expect(hasPermission("OWNER", "user.update")).toBe(true);
        expect(hasPermission("OWNER", "branch.create")).toBe(false);
        expect(hasPermission("OWNER", "branch.delete")).toBe(false);
    });

    it("semua role hanya memuat permission yang valid (tidak ada typo)", () => {
        const roles = Object.keys(ROLE_PERMISSIONS) as Array<keyof typeof ROLE_PERMISSIONS>;
        for (const role of roles) {
            for (const p of ROLE_PERMISSIONS[role]) {
                expect(PERMISSIONS).toContain(p);
            }
        }
    });
});