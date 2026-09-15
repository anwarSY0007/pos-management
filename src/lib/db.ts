import "server-only";

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "./generated/prisma/client";

const connectionString = process.env.DATABASE_URL!;

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;

// ============================================================
// POS extension — Transaction boundary helper (non-breaking)
// ============================================================

// Catatan: jika `Prisma.TransactionClient` tidak tersedia di output generator
// versi Anda, ganti dengan:
//   export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
export type Tx = Prisma.TransactionClient;

const TX_DEFAULTS = {
  timeout: 15_000,
  maxWait: 5_000,
  isolationLevel: "ReadCommitted" as const,
};

/**
 * Satu aksi bisnis = satu transaksi.
 * Semua service POS (checkout, receiving, payment, dst.) WAJIB lewat sini.
 */
export async function withTransaction<T>(
  fn: (tx: Tx) => Promise<T>,
  opts?: Partial<Pick<typeof TX_DEFAULTS, "timeout" | "maxWait">>,
): Promise<T> {
  return prisma.$transaction(fn, { ...TX_DEFAULTS, ...opts });
}
