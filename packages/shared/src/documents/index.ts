import { prisma } from "../lib/prisma";

export interface Document {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  s3Key: string | null;
  s3Url: string | null;
  status: "uploaded" | "processing" | "processed" | "failed";
  subject: string | null;
  chunkCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export async function uploadDocument(userId: string, file: any, data: { subject?: string }) {
  const s3Key = `documents/${userId}/${Date.now()}-${file.originalname}`;
  const s3Url = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

  const document = await prisma.document.create({
    data: {
      userId,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      s3Key,
      s3Url,
      status: "uploaded",
      subject: data.subject,
      chunkCount: 0,
    },
    select: {
      id: true,
      userId: true,
      filename: true,
      originalName: true,
      size: true,
      mimeType: true,
      s3Key: true,
      s3Url: true,
      status: true,
      subject: true,
      chunkCount: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return document;
}

export async function getDocuments(userId: string) {
  return await prisma.document.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      filename: true,
      originalName: true,
      size: true,
      mimeType: true,
      s3Url: true,
      status: true,
      subject: true,
      chunkCount: true,
      createdAt: true,
    },
  });
}

export async function deleteDocument(userId: string, documentId: string) {
  return await prisma.document.delete({
    where: { id: documentId, userId },
  });
}