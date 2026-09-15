import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/db";
import { authorize } from "@/lib/permissions/authorize";
import { toActionResponse, toHttpStatus } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const ctx = await authorize("sale.create");

    const q = (new URL(request.url).searchParams.get("q") ?? "")
      .trim()
      .slice(0, 100);

    const products = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { sku: { contains: q, mode: "insensitive" } },
                { barcode: q }, // scan barcode = exact
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      take: 50,
      select: {
        id: true,
        sku: true,
        name: true,
        barcode: true,
        sellingPrice: true,
        taxRate: true,
        unit: { select: { symbol: true } },
        productStocks: {
          where: { branchId: ctx.branchId },
          select: { quantity: true },
        },
      },
    });

    return NextResponse.json({
      products: products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        barcode: p.barcode,
        price: p.sellingPrice.toString(), // string — D10
        taxRate: p.taxRate.toString(),
        unit: p.unit?.symbol ?? "",
        stock: p.productStocks[0]?.quantity.toString() ?? null,
      })),
    });
  } catch (error) {
    const failure = toActionResponse(error);
    return NextResponse.json(failure, { status: toHttpStatus(error) });
  }
}
