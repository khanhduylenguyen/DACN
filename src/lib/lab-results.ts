/**
 * Service quản lý kết quả xét nghiệm
 * Lưu trữ PDF/ảnh và metadata của kết quả xét nghiệm
 */

export interface LabResult {
  id: string;
  patientId: string;
  testName: string; // Tên xét nghiệm (ví dụ: "Xét nghiệm máu", "Xét nghiệm nước tiểu")
  testDate: string; // Ngày xét nghiệm (ISO format)
  facility?: string; // Cơ sở xét nghiệm
  doctor?: string; // Bác sĩ chỉ định
  files: LabFile[]; // Danh sách file PDF/ảnh
  notes?: string; // Ghi chú
  createdAt: string; // Ngày tạo record
  updatedAt: string; // Ngày cập nhật
}

export interface LabFile {
  id: string;
  name: string;
  type: "pdf" | "image"; // Loại file
  url: string; // Base64 data URL hoặc blob URL
  size: number; // Kích thước file (bytes)
  uploadedAt: string; // Ngày upload
}

const STORAGE_KEY = "cliniccare:lab-results";
const API_BASE = "/api/lab-results";

// Helper: persist full list
function writeAllResults(allResults: LabResult[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allResults));
  window.dispatchEvent(new CustomEvent("labResultsUpdated"));
}

// Sync: fetch server results for patient and merge into localStorage (async)
async function syncFromServer(patientId: string) {
  if (!patientId) return;
  try {
    const res = await fetch(`${API_BASE}?patientId=${encodeURIComponent(patientId)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return;
    const body = await res.json();
    const serverList = Array.isArray(body) ? body : body?.data || [];
    if (!Array.isArray(serverList)) return;

    // Map server items to LabResult shape
    const mapped: LabResult[] = serverList.map((s: any) => ({
      id: s._id || s.id || `lab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      patientId: s.patientId,
      testName: s.testName,
      testDate: new Date(s.testDate).toISOString(),
      facility: s.facility,
      doctor: s.doctor,
      files: (s.files || []).map((f: any) => ({
        id: f.id || `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: f.name,
        type: f.type,
        url: f.url,
        size: f.size,
        uploadedAt: new Date(f.uploadedAt || f.uploadedAt).toISOString(),
      })),
      notes: s.notes,
      createdAt: s.createdAt || new Date().toISOString(),
      updatedAt: s.updatedAt || new Date().toISOString(),
    }));

    // Merge: replace all entries for this patient with server list
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      const allResults: LabResult[] = data ? JSON.parse(data) : [];
      const others = allResults.filter((r) => r.patientId !== patientId);
      const merged = [...mapped, ...others].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      writeAllResults(merged);
    } catch (e) {
      console.error("Failed merging server lab results:", e);
    }
  } catch (e) {
    // ignore network errors; keep local copy
  }
}

/**
 * Lấy tất cả kết quả xét nghiệm của bệnh nhân
 */
export function getLabResults(patientId: string): LabResult[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    
    const allResults: LabResult[] = JSON.parse(data);
    // Trigger async sync in background (do not block UI)
    syncFromServer(patientId).catch(() => {});
    return allResults.filter((r) => r.patientId === patientId);
  } catch (error) {
    console.error("Error loading lab results:", error);
    return [];
  }
}

/**
 * Lấy kết quả xét nghiệm theo ID
 */
export function getLabResultById(id: string): LabResult | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    
    const allResults: LabResult[] = JSON.parse(data);
    return allResults.find((r) => r.id === id) || null;
  } catch (error) {
    console.error("Error loading lab result:", error);
    return null;
  }
}

/**
 * Lưu kết quả xét nghiệm mới
 */
export function saveLabResult(result: Omit<LabResult, "id" | "createdAt" | "updatedAt">): LabResult {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const allResults: LabResult[] = data ? JSON.parse(data) : [];
    
    const newResult: LabResult = {
      ...result,
      id: `lab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    allResults.push(newResult);
    writeAllResults(allResults);

    // Attempt to send to server asynchronously
    (async () => {
      try {
        await fetch(API_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: newResult.patientId,
            testName: newResult.testName,
            testDate: newResult.testDate,
            facility: newResult.facility,
            doctor: newResult.doctor,
            notes: newResult.notes,
            files: newResult.files.map((f) => ({ name: f.name, type: f.type, url: f.url, size: f.size, uploadedAt: f.uploadedAt })),
            uploadedBy: "patient",
          }),
        });
        // Refresh from server to get canonical ids if needed
        await syncFromServer(newResult.patientId);
      } catch (e) {
        // keep local copy if network fails
        console.error("Failed to push lab result to server:", e);
      }
    })();

    return newResult;
  } catch (error) {
    console.error("Error saving lab result:", error);
    throw error;
  }
}

/**
 * Cập nhật kết quả xét nghiệm
 */
export function updateLabResult(id: string, updates: Partial<LabResult>): LabResult | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    
    const allResults: LabResult[] = JSON.parse(data);
    const index = allResults.findIndex((r) => r.id === id);
    
    if (index === -1) return null;
    
    allResults[index] = {
      ...allResults[index],
      ...updates,
      id, // Đảm bảo không thay đổi ID
      updatedAt: new Date().toISOString(),
    };
    
    writeAllResults(allResults);

    // Attempt API update (async)
    (async () => {
      try {
        // If id looks like server id (starts with  ObjectId length) try calling
        await fetch(`${API_BASE}/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        // sync
        await syncFromServer(allResults[index].patientId);
      } catch (e) {
        console.error("Failed to update lab result on server:", e);
      }
    })();

    return allResults[index];
  } catch (error) {
    console.error("Error updating lab result:", error);
    throw error;
  }
}

/**
 * Xóa kết quả xét nghiệm
 */
export function deleteLabResult(id: string): boolean {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return false;
    
    const allResults: LabResult[] = JSON.parse(data);
    const filtered = allResults.filter((r) => r.id !== id);
    
    if (filtered.length === allResults.length) return false; // Không tìm thấy
    
    writeAllResults(filtered);

    // Attempt server delete (async)
    (async () => {
      try {
        await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
      } catch (e) {
        console.error("Failed to delete lab result on server:", e);
      }
    })();

    return true;
  } catch (error) {
    console.error("Error deleting lab result:", error);
    return false;
  }
}

/**
 * Chuyển đổi File thành base64 data URL
 */
export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Validate file upload
 */
export function validateLabFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];
  
  if (file.size > maxSize) {
    return { valid: false, error: "File quá lớn. Kích thước tối đa là 10MB." };
  }
  
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: "Chỉ chấp nhận file PDF hoặc ảnh (JPG, PNG, WEBP)." };
  }
  
  return { valid: true };
}

/**
 * Lấy danh sách tên xét nghiệm duy nhất (để autocomplete)
 */
export function getUniqueTestNames(patientId: string): string[] {
  const results = getLabResults(patientId);
  const names = new Set<string>();
  
  results.forEach((r) => {
    if (r.testName) names.add(r.testName);
  });
  
  return Array.from(names).sort();
}

/**
 * So sánh kết quả xét nghiệm theo tên xét nghiệm
 * Trả về danh sách các kết quả cùng tên xét nghiệm, sắp xếp theo thời gian
 */
export function getTestHistory(patientId: string, testName: string): LabResult[] {
  const results = getLabResults(patientId);
  return results
    .filter((r) => r.testName === testName)
    .sort((a, b) => {
      const dateA = new Date(a.testDate).getTime();
      const dateB = new Date(b.testDate).getTime();
      return dateA - dateB; // Cũ nhất trước
    });
}

