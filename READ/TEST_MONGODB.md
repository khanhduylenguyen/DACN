# 🧪 Test MongoDB Connection

## ✅ Kết quả Test

### 1. Test Register (Tạo tài khoản)

**Command:**
```bash
node test-register.js
```

**Kết quả:**
- ✅ Tài khoản đã được tạo thành công
- ✅ Dữ liệu đã được lưu vào MongoDB
- ✅ JWT token đã được tạo

**User được tạo:**
- Email: `test1765744011945@example.com`
- Name: `Test User`
- Role: `patient`
- ID: `693f1d8c8248db7b2712543a`

### 2. Test Get Users (Lấy danh sách users)

**Command:**
```bash
node test-get-users.js
```

**Kết quả:**
- ✅ API trả về danh sách users từ MongoDB
- ✅ Dữ liệu được lưu đúng format

### 3. Test Login (Đăng nhập)

**Command:**
```bash
node test-login.js
```

**Kết quả:**
- ✅ Login thành công với email/password
- ✅ JWT token được trả về

## 📊 Kiểm tra trong MongoDB Atlas

### Cách kiểm tra:

1. **Truy cập MongoDB Atlas:**
   - Vào: https://cloud.mongodb.com/
   - Chọn cluster `Cluster0`

2. **Xem Database:**
   - Click **Browse Collections**
   - Chọn database: `medi-path-ease`
   - Chọn collection: `users`

3. **Xem dữ liệu:**
   - Bạn sẽ thấy user vừa tạo:
     ```json
     {
       "_id": "693f1d8c8248db7b2712543a",
       "name": "Test User",
       "email": "test1765744011945@example.com",
       "phone": "0123456789",
       "role": "patient",
       "status": "active",
       "createdAt": "2024-12-14T...",
       "updatedAt": "2024-12-14T..."
     }
     ```

## 🔍 Test Scripts

### test-register.js
Tạo một tài khoản mới và kiểm tra response.

### test-login.js
Đăng nhập với email/password đã tạo.

### test-get-users.js
Lấy danh sách tất cả users từ database.

## 📝 Test thủ công với curl

### Register:
```bash
curl -X POST http://localhost:3000/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"Test User\",\"email\":\"test@example.com\",\"password\":\"password123\",\"role\":\"patient\"}"
```

### Login:
```bash
curl -X POST http://localhost:3000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@example.com\",\"password\":\"password123\"}"
```

### Get Users:
```bash
curl http://localhost:3000/api/users
```

## ✅ Kết luận

**MongoDB đã được kết nối thành công!**

- ✅ Backend server đang chạy
- ✅ MongoDB Atlas đã được kết nối
- ✅ API register/login hoạt động
- ✅ Dữ liệu được lưu vào database
- ✅ Có thể query dữ liệu từ database

## 🚀 Next Steps

1. ✅ Test tạo tài khoản - **Hoàn thành**
2. ⏳ Test tạo appointment
3. ⏳ Test tạo prescription
4. ⏳ Test tạo EHR
5. ⏳ Cập nhật frontend để sử dụng API

