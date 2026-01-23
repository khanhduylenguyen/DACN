# 🚀 Quick Start Guide

## ✅ Đã cấu hình MongoDB Atlas

Connection string đã được thiết lập:
- Database: `medi-path-ease`
- Cluster: `cluster0.xnmerug.mongodb.net`

## 📝 Bước 1: Tạo file .env

File `.env` đã được tạo tự động. Nếu chưa có, chạy:

```powershell
cd server
powershell -ExecutionPolicy Bypass -File setup-env.ps1
```

Hoặc tạo thủ công file `server/.env` với nội dung:

```env
MONGODB_URI=mongodb+srv://khanhduylenguyen74:6tRUZHofzIgi3LrT@cluster0.xnmerug.mongodb.net/medi-path-ease?retryWrites=true&w=majority
PORT=3000
JWT_SECRET=medi-path-ease-secret-key-2024-change-in-production
CORS_ORIGIN=http://localhost:5173
```

## 🚀 Bước 2: Chạy Backend Server

```bash
cd server
npm run dev
```

Server sẽ chạy tại: `http://localhost:3000`

Bạn sẽ thấy:
```
✅ Connected to MongoDB
🚀 Server is running on http://localhost:3000
```

## 🧪 Bước 3: Test kết nối

Mở trình duyệt hoặc dùng curl:

```bash
curl http://localhost:3000/api/health
```

Response:
```json
{
  "status": "ok",
  "message": "Server is running",
  "timestamp": "2024-..."
}
```

## 📡 API Endpoints

### Health Check
- `GET /api/health` - Kiểm tra server

### Authentication
- `POST /api/auth/register` - Đăng ký
- `POST /api/auth/login` - Đăng nhập
- `GET /api/auth/me` - Lấy thông tin user

### Appointments
- `GET /api/appointments` - Lấy danh sách
- `POST /api/appointments` - Tạo mới
- `PUT /api/appointments/:id` - Cập nhật
- `DELETE /api/appointments/:id` - Xóa

### Prescriptions
- `GET /api/prescriptions` - Lấy danh sách
- `POST /api/prescriptions` - Tạo mới

### EHR
- `GET /api/ehr` - Lấy danh sách
- `POST /api/ehr` - Tạo mới

### Notifications
- `GET /api/notifications?userId=...` - Lấy thông báo
- `PUT /api/notifications/:id/read` - Đánh dấu đã đọc

## ⚠️ Lưu ý

1. **MongoDB Atlas IP Whitelist:**
   - Vào MongoDB Atlas → Network Access
   - Thêm IP: `0.0.0.0/0` (cho phép tất cả) hoặc IP cụ thể của bạn

2. **CORS:**
   - Frontend chạy tại `http://localhost:5173` (Vite default)
   - Nếu port khác, cập nhật `CORS_ORIGIN` trong `.env`

3. **JWT Secret:**
   - Thay đổi `JWT_SECRET` trong production

## 🔧 Troubleshooting

### Lỗi: "MongoDB connection error"
- Kiểm tra IP đã được whitelist trong Atlas
- Kiểm tra username/password trong connection string
- Kiểm tra network connection

### Lỗi: "Port 3000 already in use"
- Thay đổi `PORT=3001` trong `.env`
- Hoặc dừng process đang dùng port 3000

### Lỗi: "Cannot find module"
- Chạy lại: `npm install`

## 📚 Tài liệu

- Xem `server/README.md` để biết chi tiết
- Xem `MONGODB_SETUP.md` để biết cách setup MongoDB

