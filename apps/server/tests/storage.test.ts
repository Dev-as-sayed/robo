import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.S3_BUCKET = "test-bucket";
process.env.S3_ACCESS_KEY = "test-key";
process.env.S3_SECRET_KEY = "test-secret";
process.env.S3_ENDPOINT = "http://localhost:9000";

const send = vi.hoisted(() => vi.fn());
const getSignedUrl = vi.hoisted(() => vi.fn());

vi.mock("@aws-sdk/client-s3", () => {
  class HeadBucketCommand {
    constructor(readonly input: unknown) {}
  }
  class CreateBucketCommand {
    constructor(readonly input: unknown) {}
  }
  class PutObjectCommand {
    constructor(readonly input: unknown) {}
  }
  class GetObjectCommand {
    constructor(readonly input: unknown) {}
  }
  class HeadObjectCommand {
    constructor(readonly input: unknown) {}
  }
  class DeleteObjectCommand {
    constructor(readonly input: unknown) {}
  }
  class S3Client {
    constructor(readonly config: unknown) {}

    send = send;
  }

  return {
    S3Client,
    HeadBucketCommand,
    CreateBucketCommand,
    PutObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    DeleteObjectCommand,
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl }));

const {
  clearStorageCache,
  createSignedDownloadUrl,
  createSignedUploadUrl,
  deleteStorageObject,
  headStorageObject,
  putStorageObject,
} = await import("../src/lib/storage");

function commandNames(): string[] {
  return send.mock.calls.map(([command]) => (command as object).constructor.name);
}

function commandInput(name: string): Record<string, unknown> {
  const call = send.mock.calls.find(
    ([command]) => (command as object).constructor.name === name
  );

  return (call?.[0] as { input: Record<string, unknown> }).input;
}

describe("object storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearStorageCache();
    send.mockResolvedValue({});
    getSignedUrl.mockResolvedValue("https://storage.test/signed");
  });

  it("creates the bucket when it does not exist", async () => {
    send.mockRejectedValueOnce({
      name: "NotFound",
      $metadata: { httpStatusCode: 404 },
    });

    await putStorageObject({
      key: "documents/user-1/notes.pdf",
      body: Buffer.from("hello"),
      contentType: "application/pdf",
    });

    expect(commandNames()).toEqual([
      "HeadBucketCommand",
      "CreateBucketCommand",
      "PutObjectCommand",
    ]);
    expect(commandInput("CreateBucketCommand")).toMatchObject({
      Bucket: "test-bucket",
    });
    expect(commandInput("PutObjectCommand")).toMatchObject({
      Bucket: "test-bucket",
      Key: "documents/user-1/notes.pdf",
      ContentType: "application/pdf",
    });
  });

  it("uses force path style for MinIO", async () => {
    await putStorageObject({
      key: "documents/user-1/notes.txt",
      body: Buffer.from("hello"),
      contentType: "text/plain",
    });

    const client = send.mock.instances[0] as {
      config: Record<string, unknown>;
    };
    expect(client.config).toMatchObject({
      forcePathStyle: true,
      endpoint: "http://localhost:9000",
      region: "us-east-1",
    });
    expect(commandNames()).toContain("HeadBucketCommand");
  });

  it("signs uploads with the declared content type", async () => {
    const upload = await createSignedUploadUrl({
      key: "documents/user-1/notes.pdf",
      contentType: "application/pdf",
    });

    expect(upload).toMatchObject({
      key: "documents/user-1/notes.pdf",
      url: "https://storage.test/signed",
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
    });
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: expect.objectContaining({ ContentType: "application/pdf" }),
      }),
      { expiresIn: 900 }
    );
  });

  it("returns null for missing objects", async () => {
    send
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ name: "NoSuchKey", $metadata: { httpStatusCode: 404 } });

    await expect(headStorageObject("documents/missing.pdf")).resolves.toBeNull();
  });

  it("deletes objects and signs downloads", async () => {
    await deleteStorageObject("documents/user-1/notes.pdf");
    const download = await createSignedDownloadUrl("documents/user-1/notes.pdf", {
      filename: "notes.pdf",
    });

    expect(commandNames()).toContain("DeleteObjectCommand");
    expect(download.url).toBe("https://storage.test/signed");
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: expect.objectContaining({
          ResponseContentDisposition: expect.stringContaining("notes.pdf"),
        }),
      }),
      { expiresIn: 900 }
    );
  });
});
