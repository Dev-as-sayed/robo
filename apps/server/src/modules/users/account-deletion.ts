import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@robo/shared/lib/prisma";
import { deleteMe } from "@robo/shared/users";
import logger from "../../lib/logger";
import { deleteUserChunks, isRagConfigured } from "../ai/qdrant";
import { deleteStorageObject, isStorageConfigured } from "../../lib/storage";

const UPLOAD_DIR = "/tmp/uploads";

export interface AccountDeletionResult {
  deleted: boolean;
  filesRemoved: number;
  vectorsRemoved: boolean;
}

/**
 * Removes vectors first, then local uploads, then the user row. PostgreSQL relations
 * cascade, so conversations, tasks, notes and other owned rows disappear with the user.
 */
export async function deleteAccountData(
  userId: string
): Promise<AccountDeletionResult> {
  const documents = await prisma.document.findMany({
    where: { userId },
    select: { filename: true, s3Key: true },
  });

  let vectorsRemoved = false;
  if (isRagConfigured()) {
    try {
      await deleteUserChunks(userId);
      vectorsRemoved = true;
    } catch (error) {
      logger.warn({ err: error, userId }, "failed to delete user vectors");
    }
  }

  let filesRemoved = 0;
  const storageConfigured = isStorageConfigured();

  for (const document of documents) {
    const target = path.join(UPLOAD_DIR, path.basename(document.filename));
    try {
      await fs.unlink(target);
      filesRemoved += 1;
    } catch {
      // The temp file was already cleaned up or never written.
    }

    if (document.s3Key && storageConfigured) {
      try {
        await deleteStorageObject(document.s3Key);
        filesRemoved += 1;
      } catch (error) {
        logger.warn(
          { err: error, userId, s3Key: document.s3Key },
          "failed to delete stored document"
        );
      }
    }
  }

  const result = await deleteMe(userId);

  return {
    deleted: result.deleted,
    filesRemoved,
    vectorsRemoved,
  };
}
