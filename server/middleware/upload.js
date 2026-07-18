/**
 * Multer middleware: in-memory upload, validate dung lượng + MIME.
 *
 * Tại sao memory (không phải disk):
 *  - File đi thẳng lên S3, không cần ghi ra đĩa → tốn ổ cứng + nguy cơ bảo mật.
 *  - Free Tier EC2 chỉ có 8-30GB SSD.
 */

import multer from "multer";
import { config, validate as validateS3 } from "../config/s3.js";

const memoryStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!config.enabled) {
    return cb(new Error("Upload service chưa được bật (AWS_S3_ENABLED=false)"));
  }
  if (!config.allowedMime.includes(file.mimetype)) {
    return cb(
      new Error(
        `Loại file không được phép: ${file.mimetype}. Cho phép: ${config.allowedMime.join(", ")}`
      )
    );
  }
  cb(null, true);
};

const upload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: config.maxFileSize,
    files: 10, // tối đa 10 file / 1 request
  },
  fileFilter,
});

/**
 * Middleware dùng cho route: `upload.single("file")` hoặc `upload.array("files", 10)`.
 * Sau khi mount, req.file / req.files sẽ chứa buffer.
 */
export { upload, validateS3, maxFileSize, allowedMime };

const maxFileSize = config.maxFileSize;
const allowedMime = config.allowedMime;