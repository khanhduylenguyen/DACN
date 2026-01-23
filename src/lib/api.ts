export type UploadResponse = { url: string; name: string; type: string };
export type EHRRecord = {
  patientId: string;
  visitDate: string; // ISO
  doctor: string;
  diagnosis: string;
  conclusion?: string;
  vitals?: { bpSys?: number; bpDia?: number; hr?: number; weight?: number; height?: number; bmi?: number };
  labs?: Array<{ name: string; result: number | string; unit?: string; ref?: string; status?: string }>;
  images?: string[];
};

const API_BASE = "/api"; // change if needed

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  // try json
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export async function uploadAttachment(patientId: string, file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch(`${API_BASE}/patients/${patientId}/attachments`, { method: "POST", body: form });
    if (!res.ok) throw new Error("Upload failed");
    const data = (await res.json()) as UploadResponse;
    return data;
  } catch {
    // Fallback local object URL for demo
    return { url: URL.createObjectURL(file), name: file.name, type: file.type };
  }
}

export async function createEHR(record: EHRRecord): Promise<{ id: string } & EHRRecord> {
  try {
    // Use backend EHR endpoint (server exposes POST /api/ehr)
    return await apiFetch<{ id: string } & EHRRecord>(`/ehr`, {
      method: "POST",
      body: JSON.stringify(record),
    });
  } catch (e) {
    // Fallback to localStorage demo
    const key = `cliniccare:ehr:${record.patientId}`;
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    const withId = { id: crypto.randomUUID(), ...record };
    list.push(withId);
    localStorage.setItem(key, JSON.stringify(list));
    return withId;
  }
}

export async function listEHR(patientId: string): Promise<Array<{ id: string } & EHRRecord>> {
  try {
    // Prefer patient-specific endpoint exposed by backend: GET /api/ehr/patient/:patientId
    return await apiFetch<Array<{ id: string } & EHRRecord>>(`/ehr/patient/${patientId}`, { method: "GET" });
  } catch {
    const key = `cliniccare:ehr:${patientId}`;
    return JSON.parse(localStorage.getItem(key) || "[]");
  }
}

// Prescription types
export type PrescriptionDrug = {
  name: string;
  dose: string;
  quantity?: string;
  instructions?: string;
};

export type Prescription = {
  _id?: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  date: string;
  drugs: PrescriptionDrug[];
  diagnosis?: string;
  notes?: string;
  status?: "active" | "completed" | "cancelled";
  createdAt?: string;
  updatedAt?: string;
};

export async function createPrescription(prescription: Omit<Prescription, "_id" | "createdAt" | "updatedAt">): Promise<Prescription> {
  try {
    return await apiFetch<Prescription>("/prescriptions", {
      method: "POST",
      body: JSON.stringify(prescription),
    });
  } catch (e) {
    console.error("API call failed, using localStorage fallback:", e);
    // Fallback to localStorage
    const key = "cliniccare:prescriptions";
    const allPrescriptions = JSON.parse(localStorage.getItem(key) || "[]");
    const newPrescription = {
      _id: `PRESCRIPTION_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...prescription,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    allPrescriptions.push(newPrescription);
    localStorage.setItem(key, JSON.stringify(allPrescriptions));
    window.dispatchEvent(new Event("prescriptionsUpdated"));
    return newPrescription;
  }
}

export async function listPrescriptions(params?: { patientId?: string; doctorId?: string; status?: string }): Promise<Prescription[]> {
  try {
    const query = params ? new URLSearchParams(params).toString() : "";
    const url = `/prescriptions${query ? `?${query}` : ""}`;
    // API may return either the raw array or an envelope { success: true, data: [...] }.
    const resp = await apiFetch<any>(url, { method: "GET" });
    if (!resp) return [];
    if (Array.isArray(resp)) return resp as Prescription[];
    if (resp.data && Array.isArray(resp.data)) return resp.data as Prescription[];
    // Try common envelope shapes
    if (resp.success && Array.isArray(resp.data)) return resp.data as Prescription[];
    // Fallback: attempt to coerce object values to array
    return Array.isArray(resp) ? (resp as Prescription[]) : [];
  } catch (e) {
    console.error("API call failed, using localStorage fallback:", e);
    // Fallback to localStorage
    const key = "cliniccare:prescriptions";
    const allPrescriptions: Prescription[] = JSON.parse(localStorage.getItem(key) || "[]");

    let filtered = allPrescriptions;
    if (params?.patientId) {
      filtered = filtered.filter(p => p.patientId === params.patientId);
    }
    if (params?.doctorId) {
      filtered = filtered.filter(p => p.doctorId === params.doctorId);
    }
    if (params?.status) {
      filtered = filtered.filter(p => p.status === params.status);
    }

    return filtered.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
  }
}

export async function getPrescription(id: string): Promise<Prescription> {
  try {
    return await apiFetch<Prescription>(`/prescriptions/${id}`, { method: "GET" });
  } catch (e) {
    console.error("API call failed, using localStorage fallback:", e);
    // Fallback to localStorage
    const key = "cliniccare:prescriptions";
    const allPrescriptions: Prescription[] = JSON.parse(localStorage.getItem(key) || "[]");
    const prescription = allPrescriptions.find(p => p._id === id);
    if (!prescription) throw new Error("Prescription not found");
    return prescription;
  }
}

export async function updatePrescription(id: string, updates: Partial<Prescription>): Promise<Prescription> {
  try {
    return await apiFetch<Prescription>(`/prescriptions/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  } catch (e) {
    console.error("API call failed, using localStorage fallback:", e);
    // Fallback to localStorage
    const key = "cliniccare:prescriptions";
    const allPrescriptions: Prescription[] = JSON.parse(localStorage.getItem(key) || "[]");
    const index = allPrescriptions.findIndex(p => p._id === id);
    if (index === -1) throw new Error("Prescription not found");

    allPrescriptions[index] = { ...allPrescriptions[index], ...updates, updatedAt: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify(allPrescriptions));
    window.dispatchEvent(new Event("prescriptionsUpdated"));
    return allPrescriptions[index];
  }
}

export async function deletePrescription(id: string): Promise<void> {
  try {
    await apiFetch(`/prescriptions/${id}`, { method: "DELETE" });
  } catch (e) {
    console.error("API call failed, using localStorage fallback:", e);
    // Fallback to localStorage
    const key = "cliniccare:prescriptions";
    const allPrescriptions: Prescription[] = JSON.parse(localStorage.getItem(key) || "[]");
    const filtered = allPrescriptions.filter(p => p._id !== id);
    localStorage.setItem(key, JSON.stringify(filtered));
    window.dispatchEvent(new Event("prescriptionsUpdated"));
  }
}