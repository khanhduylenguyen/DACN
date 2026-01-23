# 🔄 Frontend API Integration

## ✅ Đã cập nhật

### Register (Đăng ký)

Function `registerUser` trong `src/lib/auth.ts` đã được cập nhật để:

1. **Gọi API backend trước:**
   - Endpoint: `POST /api/auth/register`
   - Gửi: `{ name, email, phone, password, role: "patient" }`
   - Nhận: `{ success, data: { user, token } }`

2. **Fallback về localStorage:**
   - Nếu API không khả dụng hoặc lỗi
   - Vẫn lưu vào localStorage để tương thích

3. **Lưu token:**
   - JWT token được lưu vào `localStorage` với key `cliniccare:token`

## 📝 Cấu hình

### Tạo file `.env` ở root project:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

Nếu không có file `.env`, hệ thống sẽ:
- Thử gọi `http://localhost:3000/api` (mặc định)
- Nếu fail, fallback về localStorage

## 🧪 Test

### 1. Đảm bảo backend đang chạy:

```bash
cd server
npm run dev
```

### 2. Tạo file `.env` (nếu chưa có):

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

### 3. Restart frontend:

```bash
npm run dev
```

### 4. Test đăng ký:

1. Vào: http://localhost:8080/register
2. Điền form đăng ký
3. Kiểm tra MongoDB Atlas:
   - Database: `medi-path-ease`
   - Collection: `users`
   - Sẽ thấy user mới được tạo

## 🔍 Kiểm tra

### Console Logs:

Khi đăng ký, bạn sẽ thấy:
- `✅ User created successfully!` - Nếu API thành công
- `⚠️ API not available, falling back to localStorage` - Nếu API không khả dụng

### MongoDB Atlas:

1. Truy cập: https://cloud.mongodb.com/
2. Browse Collections → `medi-path-ease` → `users`
3. Sẽ thấy user mới với:
   - `_id`: MongoDB ObjectId
   - `name`, `email`, `phone`, `role`
   - `createdAt`, `updatedAt`

## ⚠️ Lưu ý

1. **Backend phải đang chạy:**
   - Server chạy tại `http://localhost:3000`
   - Nếu không, sẽ fallback về localStorage

2. **CORS:**
   - Backend đã cấu hình CORS cho `http://localhost:5173` (Vite default)
   - Nếu frontend chạy port khác, cập nhật `CORS_ORIGIN` trong `server/.env`

3. **Environment Variables:**
   - File `.env` phải ở root project (cùng cấp với `package.json`)
   - Restart frontend sau khi thêm/sửa `.env`

## 🚀 Next Steps

Các chức năng khác cần cập nhật tương tự:
- [ ] Login - Gọi API `/api/auth/login`
- [ ] Appointments - Gọi API `/api/appointments`
- [ ] Prescriptions - Gọi API `/api/prescriptions`
- [ ] EHR - Gọi API `/api/ehr`
- [ ] Notifications - Gọi API `/api/notifications`

