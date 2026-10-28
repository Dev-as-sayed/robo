import { prisma } from "@robo/shared/lib/prisma";
import { exportUserData } from "@robo/shared/users";
import { deleteAccountData } from "../modules/users/account-deletion";
import { isRagConfigured, searchDocumentChunks } from "../modules/ai/qdrant";
import { headStorageObject, isStorageConfigured } from "../lib/storage";

/**
 * Destructive end-to-end check for export and deletion. Use only with a dedicated
 * test account that owns at least one indexed document.
 */
async function main(): Promise<void> {
  const execute = process.argv.includes("--execute");
  const userId = process.env.VERIFY_USER_ID;

  console.log(
    "Checks data export and account deletion against PostgreSQL, Qdrant and S3."
  );

  if (!execute) {
    console.log(
      "Dry run. Set VERIFY_USER_ID and pass --execute with a disposable account."
    );
    return;
  }

  if (!userId) {
    throw new Error("VERIFY_USER_ID is required with --execute.");
  }

  const documents = await prisma.document.findMany({
    where: { userId },
    select: { id: true, s3Key: true, originalName: true, status: true },
  });

  if (documents.length === 0) {
    throw new Error("The verification user needs at least one uploaded document.");
  }

  const exported = await exportUserData(userId);
  if (!Array.isArray(exported.consents)) {
    throw new Error("Data export is missing consent records.");
  }

  const deleted = await deleteAccountData(userId);

  const [remainingUser, remainingDocuments] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    prisma.document.findMany({ where: { userId }, select: { id: true } }),
  ]);

  if (remainingUser || remainingDocuments.length > 0) {
    throw new Error("Database rows remain after account deletion.");
  }

  if (isRagConfigured()) {
    const vectors = await searchDocumentChunks(userId, "lifecycle verification", {
      limit: 1,
    });
    if (vectors.length > 0) {
      throw new Error("Qdrant points remain after account deletion.");
    }
  }

  if (isStorageConfigured()) {
    for (const document of documents) {
      if (!document.s3Key) continue;
      const object = await headStorageObject(document.s3Key);
      if (object) {
        throw new Error(`S3 object remains after deletion: ${document.originalName}`);
      }
    }
  }

  console.log(
    `Deleted ${deleted.deleted ? "account" : "nothing"}; ` +
      `${deleted.filesRemoved} files removed; vectorsRemoved=${deleted.vectorsRemoved}.`
  );
  console.log("Data lifecycle verification passed.");
}

void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
