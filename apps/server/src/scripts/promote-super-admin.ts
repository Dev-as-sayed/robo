import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = (process.argv[2] ?? process.env.SUPER_ADMIN_EMAIL ?? "").trim().toLowerCase();

  if (!email) {
    throw new Error("Usage: pnpm admin:promote <email>");
  }

  const user = await prisma.user.update({
    where: { email },
    data: {
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      suspendedAt: null,
      suspensionReason: null,
    },
  });

  console.log(`Promoted ${user.email} to SUPER_ADMIN`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
