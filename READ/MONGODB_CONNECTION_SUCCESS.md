# ✅ MongoDB Atlas - Kết nối thành công!

## 📋 Thông tin kết nối

- **Username:** khanhduylenguyen74
- **Cluster:** cluster0.xnmerug.mongodb.net
- **Database:** medi-path-ease
- **Connection String:** Đã được cấu hình trong `server/.env`

## ✅ Đã hoàn thành

1. ✅ File `.env` đã được tạo trong `server/`
2. ✅ Dependencies đã được cài đặt
3. ✅ Backend server đã được khởi động

## 🚀 Server đang chạy

Backend server đang chạy tại: **http://localhost:3000**

### Kiểm tra server:

```bash
curl http://localhost:3000/api/health
```

Hoặc mở trình duyệt: http://localhost:3000/api/health

Response mong đợi:
```json
{
  "status": "ok",
  "message": "Server is running",
  "timestamp": "2024-..."
}
```

## 📡 API Endpoints sẵn sàng

### Authentication
- `POST /api/auth/register` - Đăng ký tài khoản
- `POST /api/auth/login` - Đăng nhập
- `GET /api/auth/me` - Lấy thông tin user hiện tại

### Appointments (Lịch hẹn)
- `GET /api/appointments` - Lấy danh sách
- `POST /api/appointments` - Tạo lịch hẹn mới
- `PUT /api/appointments/:id` - Cập nhật
- `DELETE /api/appointments/:id` - Xóa

### Prescriptions (Đơn thuốc)
- `GET /api/prescriptions` - Lấy danh sách
- `POST /api/prescriptions` - Tạo đơn thuốc mới
- `PUT /api/prescriptions/:id` - Cập nhật
- `DELETE /api/prescriptions/:id` - Xóa

### EHR (Hồ sơ bệnh án)
- `GET /api/ehr` - Lấy danh sách
- `GET /api/ehr/patient/:patientId` - Lấy theo bệnh nhân
- `POST /api/ehr` - Tạo hồ sơ mới
- `PUT /api/ehr/:id` - Cập nhật
- `DELETE /api/ehr/:id` - Xóa

### Notifications (Thông báo)
- `GET /api/notifications?userId=...` - Lấy thông báo
- `GET /api/notifications/unread/:userId` - Đếm chưa đọc
- `PUT /api/notifications/:id/read` - Đánh dấu đã đọc
- `PUT /api/notifications/read-all/:userId` - Đánh dấu tất cả đã đọc
- `DELETE /api/notifications/:id` - Xóa

### Users
- `GET /api/users` - Lấy danh sách users
- `GET /api/users/:id` - Lấy user theo ID
- `PUT /api/users/:id` - Cập nhật user
- `DELETE /api/users/:id` - Xóa user

### Staff (Bác sĩ/Nhân viên)
- `GET /api/staff` - Lấy danh sách
- `GET /api/staff/:id` - Lấy theo ID
- `POST /api/staff` - Tạo mới
- `PUT /api/staff/:id` - Cập nhật
- `DELETE /api/staff/:id` - Xóa

### Patients
- `GET /api/patients` - Lấy danh sách bệnh nhân
- `GET /api/patients/:id` - Lấy bệnh nhân theo ID

## 🔄 Tự động tạo thông báo

Hệ thống tự động tạo thông báo khi:

1. **Bệnh nhân đặt lịch** → Bác sĩ nhận thông báo
2. **Bác sĩ xác nhận lịch** → Bệnh nhân nhận thông báo
3. **Bác sĩ hủy lịch** → Bệnh nhân nhận thông báo
4. **Bác sĩ tạo đơn thuốc** → Bệnh nhân nhận thông báo
5. **Bác sĩ tạo hồ sơ bệnh án** → Bệnh nhân nhận thông báo

## 📊 Database Collections

MongoDB sẽ tự động tạo các collections:

- `users` - Tài khoản người dùng
- `appointments` - Lịch hẹn
- `prescriptions` - Đơn thuốc
- `ehrs` - Hồ sơ bệnh án
- `notifications` - Thông báo
- `staff` - Nhân viên/Bác sĩ

## ⚠️ Lưu ý quan trọng

### 1. MongoDB Atlas IP Whitelist

**BẮT BUỘC:** Vào MongoDB Atlas và thêm IP của bạn:

1. Truy cập: https://cloud.mongodb.com/
2. Chọn cluster của bạn
3. Vào **Security** → **Network Access**
4. Click **Add IP Address**
5. Chọn:
   - **Add Current IP Address** (nếu đang ở máy hiện tại)
   - Hoặc **Allow Access from Anywhere** (`0.0.0.0/0`) cho development

**Nếu không whitelist IP, server sẽ không kết nối được MongoDB!**

### 2. CORS Configuration

Frontend cần chạy tại `http://localhost:5173` (Vite default port).

Nếu frontend chạy port khác, cập nhật `CORS_ORIGIN` trong `server/.env`.

### 3. JWT Secret

Trong production, **BẮT BUỘC** thay đổi `JWT_SECRET` trong `server/.env`!

## 🧪 Test API

### 1. Test Health Check
```bash
curl http://localhost:3000/api/health
```

### 2. Test Register
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "role": "patient"
  }'
```

### 3. Test Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

## 🔄 Next Steps

1. ✅ MongoDB Atlas - Đã kết nối
2. ✅ Backend Server - Đang chạy
3. ⏳ Whitelist IP trong MongoDB Atlas (QUAN TRỌNG!)
4. ⏳ Test các API endpoints
5. ⏳ Cập nhật frontend để sử dụng API (tùy chọn)

## 📚 Tài liệu

- `server/README.md` - Hướng dẫn chi tiết backend
- `server/QUICK_START.md` - Hướng dẫn nhanh
- `MONGODB_SETUP.md` - Hướng dẫn setup MongoDB

## 🆘 Troubleshooting

### Server không kết nối được MongoDB

**Lỗi:** `MongoServerError: IP not whitelisted`

**Giải pháp:**
1. Vào MongoDB Atlas
2. Security → Network Access
3. Add IP Address → `0.0.0.0/0` (cho phép tất cả) hoặc IP cụ thể

### Port 3000 đã được sử dụng

**Giải pháp:**
1. Đổi port trong `server/.env`: `PORT=3001`
2. Hoặc dừng process đang dùng port 3000

### Module not found

**Giải pháp:**
```bash
cd server
npm install
```

---

**🎉 Chúc mừng! Backend server đã sẵn sàng!**

