import { notFound } from "next/navigation";
import { productService } from "@/services/product.service";
import { ProductForm } from "@/components/products/product-form";
import prisma from "@/lib/db";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
    // const ctx = await requirePermission("product.update");
    const { id } = await params;
    const product = await productService.findById(id);
    if (!product) notFound();

    const [categories, brands, units] = await Promise.all([
        prisma.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
        prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
        prisma.unit.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <h1 className="text-2xl font-bold">Edit Produk</h1>
            <ProductForm
                categories={categories} brands={brands} units={units}
                initial={{
                    id: product.id,
                    sku: product.sku, barcode: product.barcode ?? "", name: product.name,
                    description: product.description ?? "",
                    categoryId: product.categoryId ?? "",
                    brandId: product.brandId ?? "",
                    unitId: product.unitId ?? "",
                    purchasePrice: product.purchasePrice.toString(),
                    sellingPrice: product.sellingPrice.toString(),
                    minimumStock: product.minimumStock.toString(),
                    taxRate: product.taxRate.toString(),
                    imageUrl: product.imageUrl ?? "",
                }}
            />
        </div>
    );
}