import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env";

export interface StorageObject {
  key: string;
  size: number;
  contentType: string | null;
}

export interface SignedUpload {
  key: string;
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: Date;
}

let client: S3Client | null = null;
let bucketReady: Promise<void> | null = null;

export function isStorageConfigured(): boolean {
  return Boolean(env.S3_BUCKET);
}

function getBucket(): string {
  if (!env.S3_BUCKET) {
    throw new Error("STORAGE_NOT_CONFIGURED");
  }

  return env.S3_BUCKET;
}

export function getStorageClient(): S3Client {
  if (!client) {
    const hasStaticCredentials = Boolean(env.S3_ACCESS_KEY && env.S3_SECRET_KEY);

    client = new S3Client({
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
      ...(hasStaticCredentials
        ? {
            credentials: {
              accessKeyId: env.S3_ACCESS_KEY!,
              secretAccessKey: env.S3_SECRET_KEY!,
            },
          }
        : {}),
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  return client;
}

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
    ?.httpStatusCode;
  const name = (error as { name?: string }).name;

  return status === 404 || name === "NotFound" || name === "NoSuchKey";
}

export async function ensureStorageBucket(): Promise<void> {
  const bucket = getBucket();

  if (!bucketReady) {
    bucketReady = (async (): Promise<void> => {
      const s3 = getStorageClient();

      try {
        await s3.send(new HeadBucketCommand({ Bucket: bucket }));
        return;
      } catch (error) {
        if (!isNotFound(error)) {
          throw error;
        }
      }

      try {
        await s3.send(new CreateBucketCommand({ Bucket: bucket }));
      } catch (error) {
        const name = (error as { name?: string }).name;
        if (name !== "BucketAlreadyOwnedByYou" && name !== "BucketAlreadyExists") {
          throw error;
        }
      }
    })().catch((error: unknown) => {
      bucketReady = null;
      throw error;
    });
  }

  return bucketReady;
}

export async function putStorageObject(input: {
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}): Promise<void> {
  await ensureStorageBucket();
  await getStorageClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      ...(input.metadata ? { Metadata: input.metadata } : {}),
    })
  );
}

export async function getStorageObject(key: string): Promise<{
  body: Buffer;
  contentType: string | null;
}> {
  await ensureStorageBucket();
  const response = await getStorageClient().send(
    new GetObjectCommand({ Bucket: getBucket(), Key: key })
  );

  if (!response.Body) {
    throw new Error("STORAGE_OBJECT_EMPTY");
  }

  const bytes = await response.Body.transformToByteArray();
  return {
    body: Buffer.from(bytes),
    contentType: response.ContentType ?? null,
  };
}

export async function headStorageObject(key: string): Promise<StorageObject | null> {
  await ensureStorageBucket();

  try {
    const response = await getStorageClient().send(
      new HeadObjectCommand({ Bucket: getBucket(), Key: key })
    );

    return {
      key,
      size: response.ContentLength ?? 0,
      contentType: response.ContentType ?? null,
    };
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

export async function deleteStorageObject(key: string): Promise<void> {
  await ensureStorageBucket();
  await getStorageClient().send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: key })
  );
}

export async function createSignedUploadUrl(input: {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<SignedUpload> {
  await ensureStorageBucket();
  const expiresIn = input.expiresInSeconds ?? env.S3_UPLOAD_URL_TTL_SECONDS;
  const url = await getSignedUrl(
    getStorageClient(),
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: input.key,
      ContentType: input.contentType,
    }),
    { expiresIn }
  );

  return {
    key: input.key,
    url,
    method: "PUT",
    headers: { "Content-Type": input.contentType },
    expiresAt: new Date(Date.now() + expiresIn * 1_000),
  };
}

export async function createSignedDownloadUrl(
  key: string,
  options: { filename?: string; expiresInSeconds?: number } = {}
): Promise<{ url: string; expiresAt: Date }> {
  await ensureStorageBucket();
  const expiresIn = options.expiresInSeconds ?? env.DOCUMENT_DOWNLOAD_URL_TTL_SECONDS;
  const disposition = options.filename
    ? `attachment; filename="${options.filename.replace(/["\\]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(options.filename)}`
    : "attachment";

  const url = await getSignedUrl(
    getStorageClient(),
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
      ResponseContentDisposition: disposition,
    }),
    { expiresIn }
  );

  return { url, expiresAt: new Date(Date.now() + expiresIn * 1_000) };
}

export function clearStorageCache(): void {
  client = null;
  bucketReady = null;
}
