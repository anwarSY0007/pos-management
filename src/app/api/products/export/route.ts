import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/permissions/authorize";
import { toActionResponse, toHttpStatus } from "@/lib/errors";
import { productService } from "@/services/product.service";
import { toCsv } from "@/lib/utils/csv";

export async function GET(request: NextRequest) {
    try {
        await authorize("product.export"); // authorization di server, selalu

        const status = new URL(request.url).searchParams.get("status");
        const valid = status === "ARCHIVED" || status === "ALL" ? status : "ACTIVE";

        const products = await productService.listAllForExport(valid);

        const csv = toCsv(
            ["sku", "barcode", "name", "category", "brand", "unit", "purchasePrice", "sellingPrice", "minimumStock", "taxRate", "status"],
            products.map((p) => [
                p.sku, p.barcode, p.name,
                p.category?.name, p.brand?.name, p.unit?.symbol,
                p.purchasePrice.toFixed(2), p.sellingPrice.toFixed(2),
                p.minimumStock.toString(), p.taxRate.toFixed(2), p.status,
            ]),
        );

        return new NextResponse(csv, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="products-${valid.toLowerCase()}.csv"`,
            },
        });
    } catch (error) {
        const failure = toActionResponse(error);
        return NextResponse.json(failure, { status: toHttpStatus(error) });
    }
}