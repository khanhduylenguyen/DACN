# 📖 Hướng Dẫn: Vite Đọc Biến Môi Trường Từ File .env

## 🔑 Nguyên Tắc Cơ Bản

Vite **chỉ đọc biến môi trường** khi:
1. ✅ Biến có prefix `VITE_`
2. ✅ File `.env` ở **root của project** (cùng cấp với `package.json`)
3. ✅ Server đã được **restart** sau khi thay đổi `.env`
4. ✅ Format file `.env` đúng (không có khoảng trắng thừa, không có BOM)

## 📝 Format File .env

### ✅ Đúng:

```env
VITE_USE_EMAILJS=true
VITE_EMAILJS_SERVICE_ID=service_hd1binp
VITE_EMAILJS_TEMPLATE_ID=template_femyln9
VITE_EMAILJS_PUBLIC_KEY=6GFj5AWAFmSL1VNaa
```

### ❌ Sai:

```env
# Có khoảng trắng trước/sau dấu =
VITE_USE_EMAILJS = true

# Có dấu ngoặc kép
VITE_USE_EMAILJS="true"

# Không có prefix VITE_
USE_EMAILJS=true

# Có comment trên cùng dòng (cần dòng riêng)
VITE_USE_EMAILJS=true # comment here
```

## 🚀 Các Bước Để Vite Đọc Được Biến Môi Trường

### Bước 1: Kiểm Tra File .env

Đảm bảo file `.env` có:
- ✅ Ở root project (cùng cấp với `package.json`)
- ✅ Format đúng (không có khoảng trắng thừa)
- ✅ Tất cả biến có prefix `VITE_`

**Kiểm tra nhanh:**
```powershell
# Xem nội dung file
Get-Content .env

# Kiểm tra encoding (không được có BOM)
$bytes = [System.IO.File]::ReadAllBytes(".env");
$hasBOM = $bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF;
Write-Host "Has BOM: $hasBOM"  # Phải là False
```

### Bước 2: Dừng Server Hoàn Toàn

**Quan trọng:** Vite chỉ đọc `.env` khi **khởi động**, không đọc lại khi đang chạy!

```powershell
# Cách 1: Trong terminal đang chạy npm run dev
# Nhấn Ctrl + C và đợi đến khi quay về prompt

# Cách 2: Dùng PowerShell (nếu Ctrl+C không hoạt động)
Stop-Process -Name node -Force
```

### Bước 3: Xóa Cache Vite (Khuyến Nghị)

Cache cũ có thể giữ lại giá trị cũ:

```powershell
Remove-Item -Recurse -Force node_modules\.vite -ErrorAction SilentlyContinue
```

### Bước 4: Khởi Động Lại Server

```powershell
npm run dev
```

**Lưu ý:** Đợi server khởi động xong (thấy message "Local: http://localhost:8080")

### Bước 5: Đóng Và Mở Lại Trình Duyệt

1. **Đóng tất cả tab** đang mở `localhost:8080`
2. **Đóng trình duyệt hoàn toàn** (không chỉ tab)
3. **Mở trình duyệt mới**
4. **Vào** `http://localhost:8080`

**Tại sao?** Trình duyệt có thể cache JavaScript cũ chứa giá trị biến môi trường cũ.

### Bước 6: Kiểm Tra Trong Console

Mở Console (F12) và gõ:

```javascript
console.log("=== KIỂM TRA BIẾN MÔI TRƯỜNG ===");
console.log("VITE_USE_EMAILJS:", import.meta.env.VITE_USE_EMAILJS);
console.log("VITE_EMAILJS_SERVICE_ID:", import.meta.env.VITE_EMAILJS_SERVICE_ID);
console.log("VITE_EMAILJS_TEMPLATE_ID:", import.meta.env.VITE_EMAILJS_TEMPLATE_ID);
console.log("VITE_EMAILJS_PUBLIC_KEY:", import.meta.env.VITE_EMAILJS_PUBLIC_KEY);
```

**Kết quả mong đợi:**
```
=== KIỂM TRA BIẾN MÔI TRƯỜNG ===
VITE_USE_EMAILJS: "true"
VITE_EMAILJS_SERVICE_ID: "service_hd1binp"
VITE_EMAILJS_TEMPLATE_ID: "template_femyln9"
VITE_EMAILJS_PUBLIC_KEY: "6GFj5AWAFmSL1VNaa"
```

Nếu thấy `undefined` → Vite chưa đọc được, cần kiểm tra lại các bước trên.

## ⚡ Script Tự Động

Dùng script `restart-dev.ps1` để tự động làm tất cả:

```powershell
.\restart-dev.ps1
```

## 🔍 Debug: Kiểm Tra Log Tự Động

Khi bạn thử gửi OTP, code sẽ tự động log:

1. **`[Email Config Debug]`** - Giá trị raw từ `import.meta.env`
2. **`[Email Config]`** - Trạng thái cấu hình

Nếu thấy tất cả là `undefined` hoặc `false` → Vite chưa đọc được `.env`

## ❓ Vì Sao Vite Không Đọc Được?

### 1. File .env Không Ở Đúng Vị Trí

```
❌ Sai:
project/
  src/
    .env          ← Sai vị trí

✅ Đúng:
project/
  .env            ← Đúng vị trí (cùng cấp với package.json)
  package.json
  src/
```

### 2. Biến Không Có Prefix VITE_

```env
❌ USE_EMAILJS=true          → Vite không đọc
✅ VITE_USE_EMAILJS=true     → Vite đọc được
```

### 3. Server Chưa Restart

**Quan trọng:** Vite chỉ đọc `.env` khi **khởi động**, không đọc lại khi đang chạy!

→ Phải restart server sau mỗi lần thay đổi `.env`

### 4. Format File Sai

```env
❌ VITE_USE_EMAILJS = true        # Có khoảng trắng
❌ VITE_USE_EMAILJS="true"        # Có dấu ngoặc kép
❌ VITE_USE_EMAILJS=true # comment # Comment trên cùng dòng

✅ VITE_USE_EMAILJS=true           # Đúng
✅ # Comment phải ở dòng riêng
✅ VITE_USE_EMAILJS=true
```

### 5. Encoding File Sai

File `.env` phải là **UTF-8**, không có **BOM**.

**Kiểm tra:**
```powershell
$bytes = [System.IO.File]::ReadAllBytes(".env");
$hasBOM = $bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF;
if ($hasBOM) {
    Write-Host "❌ File có BOM, cần xóa BOM" -ForegroundColor Red
    # Xóa BOM
    $content = Get-Content .env -Raw;
    [System.IO.File]::WriteAllText(".env", $content, [System.Text.UTF8Encoding]::new($false));
    Write-Host "✅ Đã xóa BOM" -ForegroundColor Green
} else {
    Write-Host "✅ File không có BOM" -ForegroundColor Green
}
```

### 6. Cache Vite

Cache cũ có thể giữ giá trị cũ:

```powershell
Remove-Item -Recurse -Force node_modules\.vite
npm run dev
```

## 📚 Tài Liệu Tham Khảo

- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- File `.env` phải ở root project
- Chỉ biến có prefix `VITE_` mới được expose ra client
- Server phải restart sau mỗi lần thay đổi `.env`

## ✅ Checklist

Trước khi báo lỗi, hãy kiểm tra:

- [ ] File `.env` ở root project (cùng cấp với `package.json`)
- [ ] Tất cả biến có prefix `VITE_`
- [ ] Format file đúng (không có khoảng trắng thừa, không có dấu ngoặc kép)
- [ ] File không có BOM (encoding UTF-8)
- [ ] Server đã được restart sau khi thay đổi `.env`
- [ ] Đã xóa cache Vite (`node_modules/.vite`)
- [ ] Đã đóng và mở lại trình duyệt
- [ ] Đã kiểm tra trong Console và thấy giá trị (không phải `undefined`)

