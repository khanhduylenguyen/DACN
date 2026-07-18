/**
 * Client-side helper gọi API upload lên AWS S3 qua backend.
 *
 * Flow:
 *  1. POST /api/uploads/file (multipart) → server upload lên S3 → trả presigned URL
 *  2. Frontend lưu `{ key, viewUrl, name, size, contentType }` vào DB hoặc localStorage
 *
 * Fallback:
 *  - Khi server không sẵn sàng (hoặc S3 disabled), trả về URL.createObjectURL(file)
 *  - vẫn hiển thị được preview trong session, mất khi reload.
 */

export type UploadedFile = {
  key: string;
  viewUrl: string;
  name: string;
  size: number;
  contentType: string;
  bucket?: string;
  etag?: string;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api") as string;

export type UploadFolder = "lab-results" | "prescriptions" | "chat-attachment" | "general";

export interface UploadOptions {
  folder?: UploadFolder;
  patientId?: string;
  signal?: AbortSignal;
  /** timeout (ms) mặc định 30s */
  timeoutMs?: number;
}

/**
 * Upload 1 file lên S3 qua backend.
 * @throws Error với message thân thiện nếu thất bại.
 */
export async function uploadFile(file: File, opts: UploadOptions = {}): Promise<UploadedFile> {
  const { folder = "general", patientId, signal, timeoutMs = 30_000 } = opts;

  const form = new FormData();
  form.append("file", file);
  if (folder) form.append("folder", folder);
  if (patientId) form.append("patientId", patientId);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const combinedSignal = signal
    ? mergeSignals([signal, controller.signal])
    : controller.signal;

  try {
    const res = await fetch(`${API_BASE}/uploads/file`, {
      method: "POST",
      body: form,
      signal: combinedSignal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Upload thất bại (${res.status})`);
    }
    const body = await res.json();
    if (!body?.success || !body?.data) {
      throw new Error(body?.message || "Phản hồi từ server không hợp lệ");
    }
    const d = body.data as UploadedFile;
    return d;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Upload nhiều file song song (giới hạn concurrency).
 */
export async function uploadFiles(
  files: File[],
  opts: UploadOptions & { concurrency?: number } = {}
): Promise<Array<{ file: File; result?: UploadedFile; error?: string }>> {
  const { concurrency = 3, ...rest } = opts;
  const out: Array<{ file: File; result?: UploadedFile; error?: string }> = [];
  const queue = [...files];

  async function worker() {
    while (queue.length) {
      const f = queue.shift()!;
      try {
        const r = await uploadFile(f, rest);
        out.push({ file: f, result: r });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Lỗi upload";
        out.push({ file: f, error: msg });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, files.length || 1) }, () => worker()));
  return out;
}

/**
 * Lấy presigned URL mới cho file đã upload (dùng khi URL cũ hết hạn).
 */
export async function refreshSignedUrl(key: string, expires = 3600): Promise<string> {
  const res = await fetch(`${API_BASE}/uploads/signed-url?key=${encodeURIComponent(key)}&expires=${expires}`);
  if (!res.ok) throw new Error("Không tạo được signed URL");
  const body = await res.json();
  return body?.data?.url as string;
}

/**
 * Xóa file trên S3 (yêu cầu quyền nếu backend check).
 */
export async function deleteFile(key: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/uploads?key=${encodeURIComponent(key)}`, { method: "DELETE" });
  return res.ok;
}

/**
 * Kiểm tra file có tồn tại không (dùng cho cleanup).
 */
export async function fileExists(key: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/uploads/exists?key=${encodeURIComponent(key)}`, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

// --- helpers ---
function mergeSignals(signals: AbortSignal[]): AbortSignal {
  const ctrl = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      ctrl.abort();
      break;
    }
    s.addEventListener("abort", () => ctrl.abort(), { once: true });
  }
  return ctrl.signal;
}
