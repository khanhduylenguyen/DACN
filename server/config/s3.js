/**
 * Cấu hình AWS S3
 *
 * Tại sao tách riêng?
 * - File `services/s3Service.js` để thao tác (upload/getSignedUrl/delete).
 * - File này chỉ chứa cấu hình + validate để fail-fast lúc startup.
 *
 * Free Tier (12 tháng đầu cho tài khoản AWS mới):
 * - 5GB lưu trữ S3 Standard
 * - 15GB transfer-out / tháng
 * - 20.000 GET + 2.000 PUT requests
 * → Phù hợp cho đồ án/lab với vài chục bệnh nhân.
 */

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env từ thư mục server/ (không phụ thuộc cwd lúc chạy)
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const isEnabled = (process.env.AWS_S3_ENABLED || "false").toLowerCase() === "true";

export const config = {
  enabled: isEnabled,
  region: process.env.AWS_REGION || "ap-southeast-1",
  bucket: process.env.AWS_S3_BUCKET || "",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  signedUrlExpires: Number(process.env.AWS_S3_SIGNED_URL_EXPIRES || 3600),
  maxFileSize: Number(process.env.UPLOAD_MAX_FILE_SIZE || 10 * 1024 * 1024),
  allowedMime: (process.env.UPLOAD_ALLOWED_MIME ||
    "application/pdf,image/jpeg,image/png,image/webp"
  ).split(",").map((s) => s.trim()).filter(Boolean),
};

/**
 * Kiểm tra cấu hình có hợp lệ không. Trả về null nếu OK, ngược lại trả message.
 * Backend vẫn chạy bình thường khi S3 disabled - chỉ route upload trả 503.
 */
export function validate() {
  if (!config.enabled) {
    return "Upload service chưa được bật (AWS_S3_ENABLED=false trong .env)";
  }
  const missing = [];
  if (!config.region) missing.push("AWS_REGION");
  if (!config.bucket) missing.push("AWS_S3_BUCKET");
  if (!config.accessKeyId) missing.push("AWS_ACCESS_KEY_ID");
  if (!config.secretAccessKey) missing.push("AWS_SECRET_ACCESS_KEY");
  if (missing.length) {
    return `AWS S3 chưa cấu hình đầy đủ: thiếu ${missing.join(", ")} (xem server/.env.example)`;
  }
  return null;
}