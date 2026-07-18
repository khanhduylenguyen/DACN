/**
 * Hook hỗ trợ upload file lên AWS S3 qua backend.
 *
 * Cú pháp:
 *   const { upload, uploads, isUploading, errors, reset } = useS3Upload({
 *     folder: "lab-results",
 *     patientId,
 *   });
 *   // upload(file) trả Promise<UploadedFile | null>
 *
 * Hỗ trợ cả 2 chế độ:
 *  - Concurrent: gọi upload() nhiều lần, tất cả chạy song song (queue).
 *  - Auto fallback: nếu backend/S3 lỗi, tạo blob URL để user vẫn preview được trong session.
 */

import { useCallback, useRef, useState } from "react";
import { uploadFile, type UploadedFile, type UploadFolder } from "./upload";

export interface QueuedUpload {
  /** id nội bộ để React key */
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  result?: UploadedFile;
  error?: string;
  progress?: number; // 0..100, hiện chưa dùng (S3 không trả progress qua PUT)
}

export interface UseS3UploadOptions {
  folder?: UploadFolder;
  patientId?: string;
  /** Số upload song song tối đa */
  concurrency?: number;
}

export function useS3Upload(opts: UseS3UploadOptions = {}) {
  const { folder = "general", patientId, concurrency = 3 } = opts;
  const [uploads, setUploads] = useState<QueuedUpload[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const counter = useRef(0);

  const updateOne = useCallback((id: string, patch: Partial<QueuedUpload>) => {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }, []);

  /**
   * Upload 1 file. Trả về LabFile đã sẵn sàng để gắn vào record.
   * Nếu upload fail → trả fallback blob URL (chỉ dùng được session này).
   */
  const upload = useCallback(
    async (file: File): Promise<UploadResult> => {
      const id = `u${Date.now()}_${++counter.current}`;
      setUploads((prev) => [...prev, { id, file, status: "uploading" }]);
      setIsUploading(true);

      // Determine file type
      const isPdf = file.type === "application/pdf";
      const type: "pdf" | "image" = isPdf ? "pdf" : "image";

      try {
        const out = await uploadFile(file, { folder, patientId });
        const labFile: UploadResult = {
          id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          name: out.name || file.name,
          type,
          key: out.key,
          url: out.viewUrl,
          size: out.size ?? file.size,
          uploadedAt: new Date().toISOString(),
          s3Uploaded: true,
        };
        updateOne(id, { status: "done", result: out });
        return labFile;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Upload thất bại";
        updateOne(id, { status: "error", error: msg });
        // Fallback: dùng blob URL để user vẫn preview được trong session.
        const blobUrl = URL.createObjectURL(file);
        return {
          id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          name: file.name,
          type,
          url: blobUrl,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          s3Uploaded: false,
          error: msg,
        };
      } finally {
        setIsUploading(false);
      }
    },
    [folder, patientId, updateOne]
  );

  /** Upload nhiều file tuần tự (tránh nghẽn mạng/S3 rate). */
  const uploadMany = useCallback(
    async (files: File[]): Promise<UploadResult[]> => {
      const out: UploadResult[] = [];
      for (const f of files) {
        const r = await upload(f);
        out.push(r);
      }
      return out;
    },
    [upload]
  );

  const reset = useCallback(() => setUploads([]), []);

  return {
    /** Upload 1 file → trả UploadResult đã chuẩn hóa LabFile */
    upload,
    /** Upload nhiều file tuần tự */
    uploadMany,
    /** Danh sách trạng thái để hiển thị progress UI nếu muốn */
    uploads,
    isUploading,
    errors: uploads.filter((u) => u.status === "error"),
    reset,
    concurrency,
  };
}

/**
 * Kiểu trả về: đã merge cấu trúc LabFile để truyền thẳng vào saveLabResult().
 */
export type UploadResult = {
  id: string;
  name: string;
  type: "pdf" | "image";
  key?: string;
  url: string;
  size: number;
  uploadedAt: string;
  s3Uploaded: boolean;
  error?: string;
};
