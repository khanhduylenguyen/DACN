export type UserRole = "admin" | "doctor" | "receptionist" | "patient";

export type AuthUser = {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
  username?: string;
};

const AUTH_KEY = "cliniccare:auth";
const USERS_KEY = "cliniccare:users";
const REMEMBER_ME_KEY = "cliniccare:rememberMe";
export const AUTH_EVENT = "cliniccare:auth:changed";

export function getCurrentUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: AuthUser): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: user }));
  }
}

export function logout(): void {
  localStorage.removeItem(AUTH_KEY);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: null }));
  }
}

/**
 * Lưu thông tin đăng nhập để ghi nhớ (chỉ lưu email/username, không lưu mật khẩu)
 */
export function saveRememberMe(identifier: string): void {
  try {
    localStorage.setItem(REMEMBER_ME_KEY, identifier);
  } catch (error) {
    console.error("Error saving remember me:", error);
  }
}

/**
 * Lấy thông tin đăng nhập đã lưu
 */
export function getRememberMe(): string | null {
  try {
    return localStorage.getItem(REMEMBER_ME_KEY);
  } catch {
    return null;
  }
}

/**
 * Xóa thông tin đăng nhập đã lưu
 */
export function clearRememberMe(): void {
  try {
    localStorage.removeItem(REMEMBER_ME_KEY);
  } catch (error) {
    console.error("Error clearing remember me:", error);
  }
}

export function hasRole(allowed: UserRole | UserRole[]): boolean {
  const user = getCurrentUser();
  if (!user) return false;
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  return roles.includes(user.role);
}

export type DemoUser = AuthUser & { password: string; phone?: string };

export const DEMO_USERS: DemoUser[] = [
  { id: "U_ADMIN", name: "Admin User", role: "admin", email: "admin@cliniccare.vn", password: "123456" },
  { id: "U_DOCTOR", name: "BS. Lê Nguyễn Khánh Duy", role: "doctor", email: "doctor@cliniccare.vn", password: "123456" },
  { id: "U_PATIENT", name: "Nguyễn Ngọc Đầy", role: "patient", email: "patient@cliniccare.vn", password: "123456", phone: "0901234567" },
];

export function seedDemoUsers(): void {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) localStorage.setItem(USERS_KEY, JSON.stringify(DEMO_USERS));
  } catch {
    localStorage.setItem(USERS_KEY, JSON.stringify(DEMO_USERS));
  }
}

export function authenticate(identifier: string, password: string): AuthUser | null {
  try {
    const list: DemoUser[] = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    // Tìm user theo email, phone hoặc username
    const found = list.find((u) => {
      const matchesIdentifier = u.email === identifier || u.phone === identifier || (u as any).username === identifier;
      return matchesIdentifier && u.password === password;
    });
    if (!found) return null;
    const { password: _pw, ...user } = found;
    return user as AuthUser;
  } catch {
    return null;
  }
}

/**
 * Đăng ký user mới với role patient
 * @param fullName - Họ tên đầy đủ
 * @param email - Email
 * @param phone - Số điện thoại
 * @param username - Tên đăng nhập
 * @param password - Mật khẩu
 * @returns AuthUser nếu thành công, null nếu thất bại (email/phone/username đã tồn tại)
 */
export async function registerUser(
  fullName: string,
  email: string,
  phone: string,
  username: string,
  password: string
): Promise<AuthUser | null> {
  try {
    // Thử gọi API backend trước
    const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";
    
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: fullName,
          email: email,
          phone: phone,
          password: password,
          role: "patient",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.user) {
          // Lưu token nếu có
          if (data.data.token) {
            localStorage.setItem("cliniccare:token", data.data.token);
          }
          
          // Trả về user từ API
          const apiUser: AuthUser = {
            id: data.data.user.id,
            name: data.data.user.name,
            email: data.data.user.email,
            role: data.data.user.role,
            username: username,
          };
          
          // Cũng lưu vào localStorage để tương thích với code cũ
          const list: DemoUser[] = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
          const newUser: DemoUser = {
            ...apiUser,
            phone: phone,
            password: password,
            username: username,
          };
          list.push(newUser);
          localStorage.setItem(USERS_KEY, JSON.stringify(list));
          
          // Tạo patient record nếu cần
          try {
            const PATIENTS_STORAGE_KEY = "cliniccare:patients";
            const existingPatients = JSON.parse(localStorage.getItem(PATIENTS_STORAGE_KEY) || "[]");
            const existingPatient = existingPatients.find(
              (p: any) => p.phone === phone || (p.email === email)
            );
            if (!existingPatient) {
              let maxId = 0;
              existingPatients.forEach((p: any) => {
                const match = p.id?.match(/^P(\d+)$/);
                if (match) {
                  const num = parseInt(match[1], 10);
                  if (num > maxId) maxId = num;
                }
              });
              const patientId = `P${String(maxId + 1).padStart(3, "0")}`;
              const newPatient = {
                id: patientId,
                fullName: fullName,
                gender: "male" as "male" | "female",
                age: 0,
                phone: phone,
                doctor: "Chưa phân công",
                lastVisit: new Date().toISOString().slice(0, 10),
                status: "pending" as "pending" | "treating" | "completed",
                email: email,
                userId: apiUser.id,
              };
              existingPatients.push(newPatient);
              localStorage.setItem(PATIENTS_STORAGE_KEY, JSON.stringify(existingPatients));
              window.dispatchEvent(new CustomEvent("patientRegistered", { detail: newPatient }));
            }
          } catch (error) {
            console.error("Error creating patient record:", error);
          }
          
          return apiUser;
        }
      } else {
        const errorData = await response.json();
        console.warn("API register failed, falling back to localStorage:", errorData.message);
        // Nếu email đã tồn tại trong API, không fallback
        if (errorData.message?.includes("already exists") || errorData.message?.includes("Email")) {
          return null;
        }
      }
    } catch (apiError) {
      console.warn("API not available, falling back to localStorage:", apiError);
    }
    
    // Fallback: Lưu vào localStorage nếu API không khả dụng
    const list: DemoUser[] = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    
    // Kiểm tra email, phone, hoặc username đã tồn tại chưa
    const existing = list.find(
      (u) => u.email === email || u.phone === phone || (u as any).username === username
    );
    
    if (existing) {
      return null; // User đã tồn tại
    }
    
    // Tạo user mới với role patient
    const newUser: DemoUser = {
      id: `U_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Tạo ID duy nhất
      name: fullName,
      role: "patient",
      email: email,
      phone: phone,
      password: password,
      username: username, // Thêm username vào user object
    };
    
    // Lưu vào danh sách users
    list.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(list));
    
    // Tự động tạo Patient record trong admin dashboard
    // Admin có thể chỉnh sửa thông tin chi tiết sau (gender, age, doctor, etc.)
    try {
      const PATIENTS_STORAGE_KEY = "cliniccare:patients";
      const existingPatients = JSON.parse(localStorage.getItem(PATIENTS_STORAGE_KEY) || "[]");
      
      // Kiểm tra xem patient đã tồn tại chưa (theo phone hoặc email)
      const existingPatient = existingPatients.find(
        (p: any) => p.phone === phone || (p.email === email)
      );
      
      if (!existingPatient) {
        // Tạo Patient ID dựa trên ID lớn nhất hiện có để tránh trùng lặp
        let maxId = 0;
        existingPatients.forEach((p: any) => {
          const match = p.id?.match(/^P(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxId) maxId = num;
          }
        });
        const patientId = `P${String(maxId + 1).padStart(3, "0")}`;
        
        const newPatient = {
          id: patientId,
          fullName: fullName,
          gender: "male" as "male" | "female", // Mặc định, admin có thể chỉnh sửa
          age: 0, // Mặc định, admin có thể chỉnh sửa
          phone: phone,
          doctor: "Chưa phân công", // Admin sẽ phân công sau
          lastVisit: new Date().toISOString().slice(0, 10), // Ngày đăng ký
          status: "pending" as "pending" | "treating" | "completed", // Chờ admin xác nhận
          email: email, // Thêm email để dễ quản lý
          userId: newUser.id, // Link với user account
        };
        
        existingPatients.push(newPatient);
        localStorage.setItem(PATIENTS_STORAGE_KEY, JSON.stringify(existingPatients));
        
        // Dispatch event để notify Patients component nếu đang mở
        window.dispatchEvent(new CustomEvent("patientRegistered", { detail: newPatient }));
      }
    } catch (error) {
      console.error("Error creating patient record:", error);
      // Không throw error, vì user đã được tạo thành công
    }
    
    // Trả về user không có password
    const { password: _pw, ...user } = newUser;
    return user as AuthUser;
  } catch (error) {
    console.error("Error registering user:", error);
    return null;
  }
}

/**
 * Admin tạo tài khoản cho bác sĩ/nhân viên
 * @param fullName - Họ tên đầy đủ
 * @param email - Email
 * @param phone - Số điện thoại
 * @param username - Tên đăng nhập
 * @param password - Mật khẩu
 * @param role - Vai trò: "doctor" hoặc "receptionist"
 * @returns AuthUser nếu thành công, null nếu thất bại (email/phone/username đã tồn tại)
 */
export function createStaffAccount(
  fullName: string,
  email: string,
  phone: string,
  username: string,
  password: string,
  role: "doctor" | "receptionist"
): AuthUser | null {
  try {
    const list: DemoUser[] = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    
    // Kiểm tra email, phone, hoặc username đã tồn tại chưa
    const existing = list.find(
      (u) => u.email === email || u.phone === phone || (u as any).username === username
    );
    
    if (existing) {
      return null; // User đã tồn tại
    }
    
    // Tạo user mới với role doctor hoặc receptionist
    const newUser: DemoUser = {
      id: `U_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Tạo ID duy nhất
      name: fullName,
      role: role,
      email: email,
      phone: phone,
      password: password,
      username: username,
    };
    
    // Lưu vào danh sách users
    list.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(list));
    
    // Trả về user không có password
    const { password: _pw, ...user } = newUser;
    return user as AuthUser;
  } catch (error) {
    console.error("Error creating staff account:", error);
    return null;
  }
}

/**
 * Xác thực hoặc tạo user mới từ Google OAuth
 * @param googleUser - Thông tin user từ Google (có email, name, picture)
 * @returns AuthUser nếu thành công, null nếu thất bại
 */
export function authenticateWithGoogle(googleUser: {
  email: string;
  name: string;
  picture?: string;
}): AuthUser | null {
  try {
    const list: DemoUser[] = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    
    // Tìm user theo email
    const existing = list.find((u) => u.email === googleUser.email);
    
    if (existing) {
      // User đã tồn tại, đăng nhập
      const { password: _pw, ...user } = existing;
      return user as AuthUser;
    }
    
    // User chưa tồn tại, tạo tài khoản mới với role patient
    const newUser: DemoUser = {
      id: `U_GOOGLE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: googleUser.name,
      role: "patient",
      email: googleUser.email,
      // Không có password vì đăng nhập bằng Google
      password: "", // Để trống hoặc random string
      // Không có phone và username, user có thể cập nhật sau
    };
    
    // Lưu vào danh sách users
    list.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(list));
    
    // Tự động tạo Patient record (tương tự như registerUser)
    try {
      const PATIENTS_STORAGE_KEY = "cliniccare:patients";
      const existingPatients = JSON.parse(localStorage.getItem(PATIENTS_STORAGE_KEY) || "[]");
      
      const existingPatient = existingPatients.find(
        (p: any) => p.email === googleUser.email
      );
      
      if (!existingPatient) {
        let maxId = 0;
        existingPatients.forEach((p: any) => {
          const match = p.id?.match(/^P(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxId) maxId = num;
          }
        });
        const patientId = `P${String(maxId + 1).padStart(3, "0")}`;
        
        const newPatient = {
          id: patientId,
          fullName: googleUser.name,
          gender: "male" as "male" | "female",
          age: 0,
          phone: "", // User có thể cập nhật sau
          doctor: "Chưa phân công",
          lastVisit: new Date().toISOString().slice(0, 10),
          status: "pending" as "pending" | "treating" | "completed",
          email: googleUser.email,
          userId: newUser.id,
        };
        
        existingPatients.push(newPatient);
        localStorage.setItem(PATIENTS_STORAGE_KEY, JSON.stringify(existingPatients));
        
        window.dispatchEvent(new CustomEvent("patientRegistered", { detail: newPatient }));
      }
    } catch (error) {
      console.error("Error creating patient record:", error);
    }
    
    // Trả về user không có password
    const { password: _pw, ...user } = newUser;
    return user as AuthUser;
  } catch (error) {
    console.error("Error authenticating with Google:", error);
    return null;
  }
}


