# Hướng dẫn kết nối MongoDB

## 🎯 Tổng quan

Backend server đã được tạo với Express.js và MongoDB. Bạn cần:

1. Cài đặt MongoDB (Local hoặc Atlas)
2. Cấu hình connection string
3. Chạy backend server
4. Cập nhật frontend để gọi API

## 📦 Cài đặt MongoDB

### Option 1: MongoDB Local (Development)

1. **Download MongoDB Community Server:**
   - Windows: https://www.mongodb.com/try/download/community
   - Chọn version phù hợp với hệ điều hành

2. **Cài đặt và khởi động:**
   ```bash
   # Windows: MongoDB sẽ tự động chạy như một service
   # Kiểm tra service đang chạy trong Services
   ```

3. **Connection string:**
   ```
   mongodb://localhost:27017/medi-path-ease
   ```

### Option 2: MongoDB Atlas (Cloud - Khuyến nghị cho Production)

1. **Tạo tài khoản:**
   - Truy cập: https://www.mongodb.com/cloud/atlas
   - Đăng ký tài khoản miễn phí

2. **Tạo Cluster:**
   - Chọn "Build a Database"
   - Chọn "Free" tier (M0)
   - Chọn region gần nhất (Singapore cho Việt Nam)
   - Đặt tên cluster

3. **Tạo Database User:**
   - Security → Database Access
   - Add New Database User
   - Username và Password (lưu lại!)
   - Database User Privileges: "Atlas admin"

4. **Whitelist IP:**
   - Security → Network Access
   - Add IP Address
   - Development: `0.0.0.0/0` (cho phép tất cả)
   - Production: Chỉ thêm IP cụ thể

5. **Lấy Connection String:**
   - Database → Connect
   - Chọn "Connect your application"
   - Copy connection string
   - Thay `<password>` bằng password đã tạo
   - Ví dụ:
     ```
     mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/medi-path-ease?retryWrites=true&w=majority
     ```

## ⚙️ Cấu hình Backend

### 1. Cài đặt dependencies

```bash
cd server
npm install
```

### 2. Tạo file .env

Tạo file `server/.env`:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/medi-path-ease
# Hoặc MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/medi-path-ease?retryWrites=true&w=majority

# Server Port
PORT=3000

# JWT Secret (Thay đổi trong production!)
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# CORS Origin (Frontend URL)
CORS_ORIGIN=http://localhost:5173
```

### 3. Chạy server

```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm start
```

Server sẽ chạy tại: `http://localhost:3000`

## 🔄 Cập nhật Frontend

### 1. Cập nhật API Base URL

Tạo file `.env` ở root project:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

### 2. Cập nhật `src/lib/api.ts`

Thay đổi `API_BASE` từ `/api` thành:

```typescript
const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
```

## 🧪 Kiểm tra kết nối

### 1. Test Backend

```bash
# Health check
curl http://localhost:3000/api/health

# Response:
# {"status":"ok","message":"Server is running","timestamp":"..."}
```

### 2. Test MongoDB Connection

Khi chạy server, bạn sẽ thấy:
- ✅ `Connected to MongoDB` - Kết nối thành công
- ❌ `MongoDB connection error` - Kiểm tra lại connection string

## 📊 Database Structure

Sau khi kết nối, MongoDB sẽ tự động tạo các collections:

- `users` - Tài khoản người dùng
- `appointments` - Lịch hẹn
- `prescriptions` - Đơn thuốc
- `ehrs` - Hồ sơ bệnh án
- `notifications` - Thông báo
- `staff` - Nhân viên/Bác sĩ

## 🔐 Security Notes

1. **JWT Secret:** Thay đổi trong production
2. **MongoDB Password:** Không commit vào git
3. **CORS:** Chỉ cho phép domain của bạn trong production
4. **Environment Variables:** Thêm `.env` vào `.gitignore`

## 🚀 Next Steps

1. ✅ Kết nối MongoDB
2. ⏳ Chạy backend server
3. ⏳ Cập nhật frontend để gọi API
4. ⏳ Migrate dữ liệu từ localStorage (nếu có)
5. ⏳ Test các chức năng

## 📝 Troubleshooting

### Lỗi: "MongoDB connection error"

**Nguyên nhân:**
- MongoDB chưa được khởi động (local)
- Connection string sai
- IP chưa được whitelist (Atlas)
- Username/password sai

**Giải pháp:**
1. Kiểm tra MongoDB service đang chạy
2. Kiểm tra connection string trong `.env`
3. Kiểm tra Network Access trong Atlas
4. Kiểm tra Database User credentials

### Lỗi: "Port 3000 already in use"

**Giải pháp:**
```bash
# Thay đổi PORT trong .env
PORT=3001
```

### Lỗi: CORS

**Giải pháp:**
Cập nhật `CORS_ORIGIN` trong `.env` với đúng frontend URL

## 📚 Tài liệu tham khảo

- [MongoDB Installation Guide](https://docs.mongodb.com/manual/installation/)
- [MongoDB Atlas Setup](https://docs.atlas.mongodb.com/getting-started/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [Mongoose Guide](https://mongoosejs.com/docs/guide.html)

