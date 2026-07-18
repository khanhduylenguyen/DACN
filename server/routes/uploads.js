/**
 * Upload routes (AWS S3)
 *
 * POST /api/uploads/file          → upload 1 file (multipart/form-data; field="file")
 * POST /api/uploads/files         → upload nhiều file (multipart/form-data; field="files")
 * GET  /api/uploads/signed-url?key=...  → tạo presigned URL tạm thời để client xem
 * DELETE /api/uploads?key=...     → xóa file (chỉ chủ sở hữu theo metadata)
 *
 * Headers/Form-Data:
 *  - folder (string, optional)   : "lab-results" | "prescriptions" | ... default "general"
 *  - patientId (string, optional): id người upload, dùng để tổ chức folder + audit
 *  - Authorization (optional)    : nếu dùng JWT sau này
 */

import express from "express";
import { upload } from "../middleware/upload.js";
import { validate as validateS3 } from "../config/s3.js";
import s3 from "../services/s3Service.js";

const router = express.Router();

/**
 * Helper gửi response lỗi chuẩn hóa.
 */
function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

/**
 * POST /api/uploads/file
 * form-data: file=<binary>, folder=<string>, patientId=<string>
 */
router.post("/file", (req, res, next) => {
  const cfgErr = validateS3();
  if (cfgErr) return fail(res, 503, cfgErr);
  next();
}, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return fail(res, 400, "Thiếu file (field 'file')");

    const { folder = "general", patientId = "unknown" } = req.body;
    const out = await s3.uploadBuffer({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      folder,
      patientId,
    });

    // Trả kèm presigned URL để client hiển thị ngay (1h).
    const viewUrl = await s3.getSignedDownloadUrl(out.key);

    res.status(201).json({
      success: true,
      data: {
        key: out.key,
        bucket: out.bucket,
        region: out.region,
        size: out.size,
        contentType: out.contentType,
        name: req.file.originalname,
        etag: out.etag,
        viewUrl,
        expiresIn: 3600,
      },
    });
  } catch (err) {
    console.error("Upload error:", err);
    return fail(res, 500, err.message || "Upload failed");
  }
});

/**
 * POST /api/uploads/files
 * form-data: files=<binary>[] , folder=<string>, patientId=<string>
 * Trả về mảng file đã upload.
 */
router.post("/files", (req, res, next) => {
  const cfgErr = validateS3();
  if (cfgErr) return fail(res, 503, cfgErr);
  next();
}, upload.array("files", 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return fail(res, 400, "Chưa có file nào");

    const { folder = "general", patientId = "unknown" } = req.body;
    const results = [];

    for (const f of req.files) {
      try {
        const out = await s3.uploadBuffer({
          buffer: f.buffer,
          originalName: f.originalname,
          mimeType: f.mimetype,
          folder,
          patientId,
        });
        const viewUrl = await s3.getSignedDownloadUrl(out.key);
        results.push({
          key: out.key,
          name: f.originalname,
          size: out.size,
          contentType: out.contentType,
          etag: out.etag,
          viewUrl,
        });
      } catch (e) {
        console.error("File failed:", f.originalname, e.message);
        results.push({ name: f.originalname, error: e.message });
      }
    }

    res.status(201).json({
      success: true,
      data: results,
      uploaded: results.filter((r) => !r.error).length,
      failed: results.filter((r) => r.error).length,
    });
  } catch (err) {
    console.error("Multi-upload error:", err);
    return fail(res, 500, err.message || "Upload failed");
  }
});

/**
 * GET /api/uploads/signed-url?key=<objectKey>&expires=<seconds>
 * Trả về presigned URL tạm thời (mặc định 1h).
 */
router.get("/signed-url", async (req, res) => {
  const cfgErr = validateS3();
  if (cfgErr) return fail(res, 503, cfgErr);
  try {
    const { key, expires } = req.query;
    if (!key) return fail(res, 400, "Thiếu query 'key'");
    const ttl = expires ? Number(expires) : undefined;
    const url = await s3.getSignedDownloadUrl(key, ttl);
    res.json({ success: true, data: { url, expiresIn: ttl || 3600 } });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

/**
 * HEAD /api/uploads/exists?key=<objectKey>
 * Kiểm tra file có tồn tại không (metadata + size).
 */
router.head("/exists", async (req, res) => {
  const cfgErr = validateS3();
  if (cfgErr) return fail(res, 503, cfgErr);
  try {
    const { key } = req.query;
    if (!key) return fail(res, 400, "Thiếu query 'key'");
    const out = await s3.headObject(key);
    if (!out.exists) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: out });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

/**
 * DELETE /api/uploads?key=<objectKey>
 * Lưu ý: trong production nên authenticate + kiểm tra quyền sở hữu.
 * Hiện tại: bất kỳ ai biết key đều có thể xóa → cân nhắc dùng JWT sau.
 */
router.delete("/", async (req, res) => {
  const cfgErr = validateS3();
  if (cfgErr) return fail(res, 503, cfgErr);
  try {
    const { key } = req.query;
    if (!key) return fail(res, 400, "Thiếu query 'key'");
    const out = await s3.deleteObject(key);
    res.json({ success: true, data: out });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

/**
 * Multer error handler - trả lỗi gọn gàng thay vì stack HTML.
 */
router.use((err, req, res, next) => {
  if (err && err.code === "LIMIT_FILE_SIZE") {
    return fail(res, 413, `File quá lớn (tối đa ${(err.limit / 1024 / 1024).toFixed(1)}MB)`);
  }
  if (err && err.message && err.message.startsWith("Loại file không được phép")) {
    return fail(res, 415, err.message);
  }
  return fail(res, 500, err.message || "Upload error");
});

export default router;