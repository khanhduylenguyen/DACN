# Báo cáo Liên kết giữa các Tài khoản

## ✅ Đã có liên kết

### 1. Bệnh nhân → Bác sĩ

#### ✅ Bệnh nhân đặt lịch → Bác sĩ nhận thông báo
- **File:** `src/pages/patient/Book.tsx`
- **Hành động:** Bệnh nhân đặt lịch hẹn
- **Thông báo cho bác sĩ:**
  - Type: `appointment_reminder`
  - Title: "Lịch hẹn mới - [Tên bệnh nhân]"
  - Message: Thông tin lịch hẹn (ngày, giờ, chuyên khoa)
  - Priority: Medium
  - Link: `/doctor/appointments`
- **Thông báo cho bệnh nhân:**
  - Type: `appointment`
  - Title: "Đặt lịch hẹn thành công"
  - Message: Thông tin lịch hẹn đã được tạo, chờ xác nhận

### 2. Bác sĩ → Bệnh nhân

#### ✅ Bác sĩ xác nhận lịch → Bệnh nhân nhận thông báo
- **File:** `src/pages/doctor/Appointments.tsx` (hàm `updateStatus`)
- **Hành động:** Bác sĩ xác nhận lịch hẹn (status: "confirmed")
- **Thông báo cho bệnh nhân:**
  - Type: `appointment_confirmed`
  - Title: "Lịch hẹn đã được xác nhận"
  - Message: Thông tin lịch hẹn đã được xác nhận
  - Link: `/patient/appointments`

#### ✅ Bác sĩ hủy lịch → Bệnh nhân nhận thông báo
- **File:** `src/pages/doctor/Appointments.tsx` (hàm `updateStatus`)
- **Hành động:** Bác sĩ hủy lịch hẹn (status: "cancelled")
- **Thông báo cho bệnh nhân:**
  - Type: `appointment_cancelled`
  - Title: "Lịch hẹn đã bị hủy"
  - Message: Thông tin lịch hẹn đã bị hủy
  - Link: `/patient/appointments`

#### ✅ Bác sĩ tạo đơn thuốc → Bệnh nhân nhận thông báo
- **File:** `src/pages/doctor/Prescriptions.tsx` (hàm `onSubmit`)
- **Hành động:** Bác sĩ tạo đơn thuốc mới
- **Thông báo cho bệnh nhân:**
  - Type: `prescription`
  - Title: "Đơn thuốc mới"
  - Message: Bác sĩ đã kê đơn thuốc - Chẩn đoán
  - Link: `/patient/prescriptions`
- **Tự động tạo:** Lịch uống thuốc từ đơn thuốc

#### ✅ Bác sĩ tạo hồ sơ bệnh án (EHR) → Bệnh nhân nhận thông báo
- **File:** `src/pages/doctor/Appointments.tsx` (hàm `onSubmitEHR`)
- **Hành động:** Bác sĩ tạo hồ sơ bệnh án sau khi khám
- **Thông báo cho bệnh nhân:**
  - Type: `ehr`
  - Title: "Hồ sơ bệnh án mới"
  - Message: Bác sĩ đã tạo hồ sơ bệnh án - Chẩn đoán
  - Link: `/patient/records`
- **Tự động:** Cập nhật trạng thái lịch hẹn thành "completed"

### 3. Tự động (Background Services)

#### ✅ Nhắc lịch khám cho bệnh nhân
- **File:** `src/lib/reminders.ts`
- **Service:** Tự động chạy mỗi 30 phút
- **Thông báo:**
  - 24 giờ trước lịch hẹn (Email/SMS)
  - 2 giờ trước lịch hẹn (Email/SMS)
- **Chỉ gửi cho:** Lịch hẹn đã xác nhận (status: "confirmed")

#### ✅ Nhắc lịch khám cho bác sĩ
- **File:** `src/lib/doctor-notifications.ts`
- **Service:** Tự động chạy mỗi 15 phút
- **Thông báo:**
  - 24 giờ trước lịch khám
  - 2 giờ trước lịch khám
  - 30 phút trước lịch khám (ưu tiên cao)
- **Chỉ gửi cho:** Lịch hẹn đã xác nhận (status: "confirmed")

#### ✅ Nhắc tái khám cho bác sĩ
- **File:** `src/lib/doctor-notifications.ts`
- **Service:** Tự động chạy mỗi 15 phút
- **Thông báo:** Từ follow-up reminders
- **Thời gian:** Trong vòng 7 ngày trước ngày tái khám

### 4. Tương tác (Interactions)

#### ✅ Tạo Interaction khi có hành động
- **File:** `src/lib/patient-followup.ts`
- **Hành động:**
  - Bác sĩ tạo EHR → Tạo interaction
  - Bác sĩ tạo đơn thuốc → Tạo interaction
  - Bác sĩ hoàn thành lịch khám → Tạo interaction
- **Mục đích:** Lưu lịch sử tương tác giữa bác sĩ và bệnh nhân

## ⚠️ Chưa có liên kết (Cần bổ sung)

### 1. Admin → Bác sĩ/Bệnh nhân

#### ❌ Admin tạo/chỉnh sửa bác sĩ → Chưa có thông báo
- **Cần:** Thông báo cho bác sĩ khi admin tạo/chỉnh sửa thông tin

#### ❌ Admin quản lý lịch hẹn → Chưa có thông báo
- **Cần:** Thông báo cho bác sĩ/bệnh nhân khi admin thay đổi lịch hẹn

### 2. Bác sĩ → Bác sĩ

#### ❌ Bác sĩ chuyển bệnh nhân → Chưa có thông báo
- **Cần:** Thông báo cho bác sĩ mới khi có bệnh nhân được chuyển

### 3. Hệ thống → Tất cả

#### ❌ Thông báo hệ thống → Chưa có
- **Cần:** Thông báo chung cho tất cả người dùng (bảo trì, cập nhật, v.v.)

## 📊 Tổng kết

### Đã có liên kết:
- ✅ Bệnh nhân đặt lịch → Bác sĩ nhận thông báo
- ✅ Bác sĩ xác nhận/hủy lịch → Bệnh nhân nhận thông báo
- ✅ Bác sĩ tạo đơn thuốc → Bệnh nhân nhận thông báo
- ✅ Bác sĩ tạo hồ sơ bệnh án → Bệnh nhân nhận thông báo
- ✅ Nhắc lịch khám tự động (bệnh nhân & bác sĩ)
- ✅ Nhắc tái khám tự động (bác sĩ)
- ✅ Tạo interaction history

### Chưa có liên kết:
- ❌ Admin → Bác sĩ/Bệnh nhân
- ❌ Bác sĩ → Bác sĩ (chuyển bệnh nhân)
- ❌ Thông báo hệ thống chung

## 🔧 Files liên quan

### Services:
- `src/lib/patient-notifications.ts` - Service tạo thông báo cho bệnh nhân
- `src/lib/doctor-notifications.ts` - Service tạo thông báo cho bác sĩ
- `src/lib/reminders.ts` - Service nhắc lịch khám cho bệnh nhân
- `src/lib/patient-followup.ts` - Service quản lý tương tác

### Pages:
- `src/pages/patient/Book.tsx` - Đặt lịch (tạo thông báo cho bác sĩ)
- `src/pages/doctor/Appointments.tsx` - Quản lý lịch khám (tạo thông báo cho bệnh nhân)
- `src/pages/doctor/Prescriptions.tsx` - Kê đơn thuốc (tạo thông báo cho bệnh nhân)
- `src/pages/patient/Notifications.tsx` - Xem thông báo (bệnh nhân)
- `src/pages/doctor/Notifications.tsx` - Xem thông báo (bác sĩ)

