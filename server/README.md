# Backend Server - Medi Path Ease

Backend server sử dụng Express.js và MongoDB.

## 📋 Yêu cầu

- Node.js 18+ 
- MongoDB (Local hoặc MongoDB Atlas)

## 🚀 Cài đặt

### 1. Cài đặt dependencies

```bash
cd server
npm install
```

### 2. Cấu hình MongoDB

#### Option 1: MongoDB Local
1. Cài đặt MongoDB trên máy: https://www.mongodb.com/try/download/community
2. Khởi động MongoDB service
3. Connection string mặc định: `mongodb://localhost:27017/medi-path-ease`

#### Option 2: MongoDB Atlas (Cloud - Khuyến nghị)
1. Tạo tài khoản tại: https://www.mongodb.com/cloud/atlas
2. Tạo cluster mới
3. Tạo database user
4. Lấy connection string
5. Thêm IP address vào whitelist (0.0.0.0/0 cho development)

### 3. Tạo file .env

Copy file `.env.example` thành `.env` và cập nhật:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/medi-path-ease?retryWrites=true&w=majority
PORT=3000
JWT_SECRET=your-super-secret-jwt-key
CORS_ORIGIN=http://localhost:5173
```

### 4. Chạy server

```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm start
```

Server sẽ chạy tại: `http://localhost:3000`

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Đăng ký
- `POST /api/auth/login` - Đăng nhập
- `GET /api/auth/me` - Lấy thông tin user hiện tại

### Appointments
- `GET /api/appointments` - Lấy danh sách lịch hẹn
- `GET /api/appointments/:id` - Lấy lịch hẹn theo ID
- `POST /api/appointments` - Tạo lịch hẹn mới
- `PUT /api/appointments/:id` - Cập nhật lịch hẹn
- `DELETE /api/appointments/:id` - Xóa lịch hẹn

### Prescriptions
- `GET /api/prescriptions` - Lấy danh sách đơn thuốc
- `GET /api/prescriptions/:id` - Lấy đơn thuốc theo ID
- `POST /api/prescriptions` - Tạo đơn thuốc mới
- `PUT /api/prescriptions/:id` - Cập nhật đơn thuốc
- `DELETE /api/prescriptions/:id` - Xóa đơn thuốc

### EHR (Electronic Health Records)
- `GET /api/ehr` - Lấy danh sách hồ sơ bệnh án
- `GET /api/ehr/patient/:patientId` - Lấy hồ sơ theo bệnh nhân
- `GET /api/ehr/:id` - Lấy hồ sơ theo ID
- `POST /api/ehr` - Tạo hồ sơ mới
- `PUT /api/ehr/:id` - Cập nhật hồ sơ
- `DELETE /api/ehr/:id` - Xóa hồ sơ

### Notifications
- `GET /api/notifications` - Lấy danh sách thông báo
- `GET /api/notifications/unread/:userId` - Đếm thông báo chưa đọc
- `PUT /api/notifications/:id/read` - Đánh dấu đã đọc
- `PUT /api/notifications/read-all/:userId` - Đánh dấu tất cả đã đọc
- `DELETE /api/notifications/:id` - Xóa thông báo

### Users
- `GET /api/users` - Lấy danh sách users
- `GET /api/users/:id` - Lấy user theo ID
- `PUT /api/users/:id` - Cập nhật user
- `DELETE /api/users/:id` - Xóa user

### Staff
- `GET /api/staff` - Lấy danh sách staff
- `GET /api/staff/:id` - Lấy staff theo ID
- `POST /api/staff` - Tạo staff mới
- `PUT /api/staff/:id` - Cập nhật staff
- `DELETE /api/staff/:id` - Xóa staff

### Patients
- `GET /api/patients` - Lấy danh sách bệnh nhân
- `GET /api/patients/:id` - Lấy bệnh nhân theo ID

## 🔒 Authentication

API sử dụng JWT token. Gửi token trong header:

```
Authorization: Bearer <token>
```

## 📝 Models

### User
- name, email, phone, password, role, avatar, status

### Appointment
- patientId, patientName, patientPhone, patientEmail
- doctorId, doctorName, specialty
- date, time, notes, status
- reminders (sent24h, sent2h)

### Prescription
- patientId, patientName, doctorId, doctorName
- drugs[], diagnosis, notes, status

### EHR
- patientId, patientName, doctorId, doctorName
- visitDate, diagnosis, conclusion
- vitals, labs[], images[]

### Notification
- userId, userRole, type, title, message
- link, read, priority, relatedId, metadata

### Staff
- userId, fullName, email, phone
- role, specialty, department
- experience, education[], certifications[]
- bio, avatar, status

## 🔄 Migration từ LocalStorage

Để migrate dữ liệu từ localStorage sang MongoDB:

1. Export dữ liệu từ localStorage
2. Chạy script migration (sẽ tạo sau)
3. Import vào MongoDB

## 🧪 Testing

```bash
# Test health check
curl http://localhost:3000/api/health

# Test create appointment
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "...",
    "patientName": "Test Patient",
    "doctorId": "...",
    "doctorName": "Test Doctor",
    "specialty": "Nội tổng quát",
    "date": "2024-12-01",
    "time": "09:00",
    "status": "pending"
  }'
```

## 📚 Tài liệu thêm

- [MongoDB Documentation](https://docs.mongodb.com/)
- [Express.js Documentation](https://expressjs.com/)
- [Mongoose Documentation](https://mongoosejs.com/)

