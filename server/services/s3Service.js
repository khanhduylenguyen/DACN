/**
 * AWS S3 Service
 *
 * Cung cấp 3 thao tác chính:
 *  1. uploadBuffer() — upload file từ buffer + metadata
 *  2. getSignedDownloadUrl() — tạo URL tạm thời (mặc định 1h) để trình duyệt xem file
 *  3. deleteObject() — xóa file khỏi bucket
 *
 * Lưu ý bảo mật:
 *  - Bucket ở chế độ PRIVATE; client chỉ xem qua presigned URL.
 *  - Tách key theo folder: uploads/patient/<patientId>/<yyyy>/<mm>/<uuid>-<safeName>
 *  - Server dùng IAM Access Key có quyền HẠN CHẾ (chỉ PutObject/GetObject/DeleteObject trên bucket này).
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
import crypto from "crypto";
import { config, validate } from "../config/s3.js";

let _client = null;

/**
 * Lazy-init S3 client. Tránh kết nối khi S3 không bật.
 */
function getClient() {
  if (_client) return _client;
  _client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return _client;
}

/**
 * Tạo key theo cấu trúc: uploads/<folder>/<patientId>/<yyyy>/<mm>/<uuid>-<safeName>
 * - folder: loại file (lab-results, prescriptions, chat-attachment, ...)
 * - patientId: ObjectId của user (hoặc 'unknown' nếu public/system)
 */
function buildKey({ folder, patientId, originalName }) {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const ext = path.extname(originalName || "").toLowerCase().replace(/[^a-z0-9.]/g, "");
  const uuid = crypto.randomUUID();
  const safeName = (path.basename(originalName || "file", path.extname(originalName || "")) || "file")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .slice(0, 60);
  const safePatientId = String(patientId || "unknown").replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 60);
  return `uploads/${folder}/${safePatientId}/${yyyy}/${mm}/${uuid}-${safeName}${ext}`;
}

/**
 * Upload buffer lên S3.
 *
 * @param {object} params
 * @param {Buffer} params.buffer - Nội dung file
 * @param {string} params.originalName - Tên gốc (để tạo filename)
 * @param {string} params.mimeType - MIME type để set Content-Type
 * @param {string} params.folder - "lab-results" | "prescriptions" | ...
 * @param {string} params.patientId - Để tổ chức theo user (audit trail)
 */
export async function uploadBuffer({ buffer, originalName, mimeType, folder, patientId }) {
  const err = validate();
  if (err) throw new Error(err);

  const key = buildKey({ folder, patientId, originalName });
  const client = getClient();

  const cmd = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    Metadata: {
      uploadedby: "medi-path-ease",
      patienthash: crypto
        .createHash("sha256")
        .update(String(patientId || "unknown"))
        .digest("hex")
        .slice(0, 16),
    },
  });

  const out = await client.send(cmd);
  return {
    key,
    bucket: config.bucket,
    region: config.region,
    size: buffer.length,
    contentType: mimeType,
    etag: (out.ETag || "").replace(/"/g, ""),
  };
}

/**
 * Tạo presigned URL để trình duyệt fetch file trực tiếp từ S3.
 */
export async function getSignedDownloadUrl(key, expiresIn) {
  const err = validate();
  if (err) throw new Error(err);
  if (!key) throw new Error("key is required");

  const ttl = typeof expiresIn === "number" && expiresIn > 0 ? expiresIn : config.signedUrlExpires;
  const cmd = new GetObjectCommand({ Bucket: config.bucket, Key: key });
  return await getSignedUrl(getClient(), cmd, { expiresIn: ttl });
}

/**
 * Kiểm tra object tồn tại (dùng để xác thực URL cũ trước khi tạo lại).
 */
export async function headObject(key) {
  const client = getClient();
  try {
    const out = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
    return { exists: true, size: out.ContentLength, contentType: out.ContentType, etag: (out.ETag || "").replace(/"/g, "") };
  } catch (e) {
    if (e?.$metadata?.httpStatusCode === 404) return { exists: false };
    throw e;
  }
}

/**
 * Xóa 1 object.
 */
export async function deleteObject(key) {
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
  return { deleted: true, key };
}

export default {
  uploadBuffer,
  getSignedDownloadUrl,
  headObject,
  deleteObject,
};