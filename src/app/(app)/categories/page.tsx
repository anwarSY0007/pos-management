import { requirePermission } from "@/lib/permissions/authorize";
import { CategoryCreateForm } from "@/components/categories/category-create-form";
import prisma from "@/lib/db";
import { hasPermission } from "@/config/permissions";

export default async function CategoriesPage() {
    const ctx = await requirePermission("category.view");

    const categories = await prisma.category.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { products: true } } },
    });

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <h1 className="text-2xl font-bold">Kategori</h1>
            {ctx && hasPermission(ctx.role, "category.create") && <CategoryCreateForm />}
            <div className="rounded-lg border">
                {categories.length === 0 ? (
                    <p className="p-8 text-center text-sm text-muted-foreground">Belum ada kategori.</p>
                ) : (
                    <ul className="divide-y">
                        {categories.map((c) => (
                            <li key={c.id} className="flex items-center justify-between p-3 text-sm">
                                <span className="font-medium">{c.name}</span>
                                <span className="text-muted-foreground">{c._count.products} produk</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}