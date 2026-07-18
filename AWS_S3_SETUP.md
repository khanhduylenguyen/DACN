# AWS S3 Setup cho Medi Path Ease

Hướng dẫn này giúp bạn tạo tài khoản AWS, cấu hình bucket S3, IAM user, và kết nối vào
dự án Medi Path Ease để lưu trữ file y tế (kết quả xét nghiệm, đơn thuốc, chat
attachment...) an toàn với chi phí **Free Tier ($0/tháng trong 12 tháng đầu)**.

> Dự án của bạn có **$200 AWS credit** → dùng thoải mái tới hết năm thứ 2.

---

## 1. Tính năng tích hợp

- **Upload 1 file** — `POST /api/uploads/file` (multipart/form-data, field=`file`)
- **Upload nhiều file** — `POST /api/uploads/files` (field=`files`, tối đa 10 file/lần)
- **Presigned URL** — `GET /api/uploads/signed-url?key=...` (mặc định 1h, có thể chỉnh)
- **Kiểm tra tồn tại** — `HEAD /api/uploads/exists?key=...`
- **Xóa** — `DELETE /api/uploads?key=...`

**Bucket layout**: `s3://<bucket>/uploads/<folder>/<patientId>/<yyyy>/<mm>/<uuid>-<filename>`

Ví dụ: `s3://medi-path-ease/uploads/lab-results/abc123/2026/07/8f4a...-blood-test.pdf`

---

## 2. Tạo tài khoản AWS

1. Truy cập [aws.amazon.com/free](https://aws.amazon.com/free/) → **Create a free account**
2. Điền email, password, tên tài khoản
3. Chọn **Personal** account
4. Nhập thông tin thanh toán (Visa/MasterCard/JCB)
   > AWS sẽ **authorize $1** rồi hoàn lại ngay. **Không bị trừ tiền thật** nếu ở trong Free Tier.
5. Chọn **Free plan** (Basic Support)
6. Xác minh điện thoại

### Bật MFA (BẮT BUỘC - bảo mật)

Vào **IAM → Users → root user → Security credentials → MFA** → Assign MFA device.
Dùng app: Google Authenticator, Microsoft Authenticator, hoặc Authy.

### Set Billing Alarm (BẮT BUỘC - tránh bill shock)

Vào **Billing & Cost Management → Budgets → Create budget**

- Budget type: **Cost budget**
- Amount: **$5** (alert đầu tiên)
- Alert threshold: **100% of budget**
- Email: email của bạn

Lặp lại với **$50** và **$150** để cảnh báo sớm.

---

## 3. Tạo S3 Bucket

### Vào S3 Console

1. **Region**: chọn `Asia Pacific (Singapore)` `ap-southeast-1` (gần VN nhất)
   > Hoặc `US East (N. Virginia)` `us-east-1` (rẻ nhất, latency cao hơn ~200ms)
2. Vào **S3 → Create bucket**
3. **Bucket name**: `medi-path-ease-uploads-<your-initials>` (phải unique toàn cầu, vd: `medi-path-ease-uploads-khanh-2026`)
4. **Object Ownership**: ACLs disabled (recommended)
5. **Block Public Access**: **ON** (mặc định) — rất quan trọng, KHÔNG tắt
6. **Bucket Versioning**: **Enable** (giúp rollback nếu upload nhầm)
7. **Default encryption**: **Enable** với **SSE-S3 (AES-256)** — không tốn thêm phí
8. Click **Create bucket**

### Cấu hình CORS (cho phép frontend gọi presigned URL từ trình duyệt)

Vào bucket vừa tạo → **Permissions → CORS** → paste JSON sau:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:5173",
      "http://localhost:3000",
      "https://your-frontend-domain.com"
    ],
    "ExposeHeaders": ["Content-Length", "Content-Type", "ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

> ⚠️ Chỉ cần khi bạn muốn trình duyệt tải file trực tiếp từ S3. Trong code hiện tại, frontend
> đi qua backend (`/api/uploads/signed-url`) nên CORS không bắt buộc — nhưng nên có để dự phòng.

---

## 4. Tạo IAM User (BẮT BUỘC - bảo mật)

> **Không dùng root access key**! Luôn tạo IAM user riêng với quyền hạn chế.

### Tạo user

1. Vào **IAM → Users → Create user**
2. **User name**: `medi-path-ease-backend`
3. **Access type**: ☑ Programmatic access (để dùng AWS SDK)
4. Click **Next**

### Gắn policy (least privilege — quyền tối thiểu)

1. **Attach policies directly** → **Create policy** → tab **JSON**
2. Paste (thay `YOUR-BUCKET-NAME`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListBucket",
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME"
    },
    {
      "Sid": "ObjectRW",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:GetObjectVersion",
        "s3:HeadObject"
      ],
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    }
  ]
}
```

3. Đặt tên policy: `MediPathEaseS3Access`
4. **Create policy** → quay lại tab user → refresh → gắn policy vừa tạo
5. Click **Next → Create user**

### Lưu Access Key (CHỈ HIỆN 1 LẦN)

Sau khi tạo, AWS hiển thị:
- **Access Key ID**: `AKIA...` (copy lại)
- **Secret Access Key**: chuỗi dài (copy lại ngay, đóng trang này là mất)

> ⚠️ Lưu vào password manager (Bitwarden, 1Password) hoặc Secrets Manager. Không commit vào git.

---

## 5. Cấu hình Backend

Mở `server/.env` và điền:

```env
# Bật S3 (false = fallback blob URL, chỉ dùng được trong session)
AWS_S3_ENABLED=true

# Region trùng với bucket bạn tạo
AWS_REGION=ap-southeast-1

# Tên bucket đã tạo ở bước 3
AWS_S3_BUCKET=medi-path-ease-uploads-khanh-2026

# Access key từ IAM user ở bước 4
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Presigned URL hết hạn sau 1 giờ (đổi nếu cần)
AWS_S3_SIGNED_URL_EXPIRES=3600

# Tối đa 10MB/file (mặc định)
UPLOAD_MAX_FILE_SIZE=10485760

# MIME types cho phép
UPLOAD_ALLOWED_MIME=application/pdf,image/jpeg,image/png,image/webp
```

Khởi động lại backend:

```bash
cd server
npm run dev
```

Nếu thấy log `✅ Connected to MongoDB` + `🚀 Server is running` mà không lỗi S3 → thành công.

---

## 6. Test nhanh

### Test endpoint

```powershell
# 1. Health
curl http://localhost:3000/api/health

# 2. Upload file (PowerShell)
$file = Get-Item "C:\path\to\test.pdf"
$form = @{
  file = $file
  folder = "lab-results"
  patientId = "test-patient-001"
}
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/uploads/file" -Form $form

# Response mẫu:
# {
#   "success": true,
#   "data": {
#     "key": "uploads/lab-results/test-patient-001/2026/07/<uuid>-test.pdf",
#     "bucket": "medi-path-ease-uploads-khanh-2026",
#     "size": 12345,
#     "viewUrl": "https://medi-path-ease-uploads-khanh-2026.s3.ap-southeast-1.amazonaws.com/...?X-Amz-...",
#     "expiresIn": 3600
#   }
# }

# 3. Lấy presigned URL
Invoke-RestMethod -Uri "http://localhost:3000/api/uploads/signed-url?key=uploads/lab-results/test-patient-001/2026/07/<uuid>-test.pdf"
```

### Test trong frontend

Vào `http://localhost:5173/patient/test-results` → bấm **Upload kết quả** → chọn file PDF.
Bạn sẽ thấy badge **"S3 ✓"** xanh bên cạnh tên file khi upload thành công.

---

## 7. Kiểm tra trên AWS Console

Vào **S3 → bucket → Objects** — bạn sẽ thấy file vừa upload ở đúng folder.

---

## 8. Chi phí thực tế

### Free Tier (12 tháng đầu - tài khoản mới)

| Dịch vụ | Free Tier | Đủ cho |
|---------|-----------|--------|
| S3 Storage | 5GB (Standard) | ~5.000 file PDF (~1MB) |
| S3 GET requests | 20.000/tháng | ~650 lượt xem/ngày |
| S3 PUT requests | 2.000/tháng | ~65 file upload/ngày |
| Data Transfer Out | 15GB/tháng | ~30.000 lượt tải PDF |

### Sau Free Tier (hoặc vượt quota)

| Loại | Đơn giá | Cho phòng khám 100 user |
|------|---------|--------------------------|
| Storage Standard | $0.023/GB/tháng | $0.23 (10GB) |
| GET request | $0.0004 / 1.000 | $0.04 (100.000 req) |
| PUT request | $0.005 / 1.000 | $0.05 (10.000 req) |
| Transfer Out | $0.09/GB (sau 100GB free) | $0 (dưới 100GB) |
| **Tổng/tháng** | | **~$0.32** |

### Nếu lưu nhiều (>5GB), chuyển sang Glacier

Glacier chỉ $0.004/GB/tháng → rẻ hơn 6 lần. Dùng **Lifecycle rule**:

Vào bucket → **Management → Lifecycle rule → Create**:

- Rule name: `archive-old`
- Apply to: `uploads/lab-results/`
- Transition to **Glacier Instant Retrieval** sau **365 ngày**
- Expire sau **2555 ngày** (~7 năm, đúng quy định lưu trữ y tế VN)

---

## 9. Bảo mật checklist

- [x] MFA enabled cho root account
- [x] IAM user riêng (không dùng root key)
- [x] IAM policy **least privilege** (chỉ Put/Get/Delete trên 1 bucket)
- [x] Bucket **Block Public Access = ON**
- [x] Default encryption = **SSE-S3**
- [x] Versioning = **Enabled**
- [x] CORS chỉ cho phép origin của bạn
- [x] Billing alert ở $5, $50, $150
- [ ] (Tùy chọn) Bật **Access Analyzer** cho S3
- [ ] (Tùy chọn) Bật **CloudTrail** log mọi API call lên S3
- [ ] (Quan trọng cho HIPAA) Ký **BAA với AWS** trước khi lưu data thật
  → Vào [aws.amazon.com/compliance/hipaa-eligible-services](https://aws.amazon.com/compliance/hipaa-eligible-services/)

---

## 10. Troubleshooting

### Lỗi `NoSuchBucket`
- Tên bucket trong `.env` không khớp với trên console. Lưu ý S3 phân biệt HOA/thường.
- Đợi ~30s sau khi tạo bucket (propagation).

### Lỗi `AccessDenied`
- IAM policy sai ARN. Kiểm tra `arn:aws:s3:::YOUR-BUCKET-NAME/*` (có `/*` ở cuối).
- Access key bị xóa: tạo lại trong IAM → User → Security credentials.

### Lỗi `SignatureDoesNotMatch`
- Secret key copy sai dấu cách/dòng. Tạo lại access key mới.

### Upload thành công nhưng frontend không hiển thị badge "S3 ✓"
- Mở DevTools → Network → response của `POST /api/uploads/file` xem có `key` không.
- Nếu response là 503: AWS_S3_ENABLED chưa bật hoặc credentials sai.

### File upload > 10MB bị từ chối
- Tăng `UPLOAD_MAX_FILE_SIZE` trong `.env` (tối đa 5GB, nhưng Express default body-parser chỉ 100MB).
- S3 chấp nhận multipart upload >5GB qua API riêng (chưa implement trong code này).

### Presigned URL hết hạn
- Mặc định 1h. Frontend tự động gọi `refreshSignedUrl()` khi `<img>/<iframe>` lỗi load.
- Tăng `AWS_S3_SIGNED_URL_EXPIRES` nếu cần (tối đa 7 ngày = 604800s).

### Frontend vẫn dùng blob URL thay vì S3
- Kiểm tra Network tab: request `POST /api/uploads/file` có status 201 không.
- Nếu 503: xem log backend để biết `validate()` trả lỗi gì.

---

## 11. Tắt S3 (rollback)

Nếu muốn tạm tắt S3 (vd demo offline):

```env
AWS_S3_ENABLED=false
```

Backend vẫn chạy bình thường. Endpoint uploads trả 503 với message:
> `"Upload service chưa được bật (AWS_S3_ENABLED=false trong .env)"`

Frontend sẽ tự fallback về **blob URL** → user vẫn xem được file trong session hiện tại,
mất khi reload.

---

## 12. Production checklist

Trước khi deploy thật:

- [ ] Đổi `JWT_SECRET` thành chuỗi random 64 ký tự (`openssl rand -hex 32`)
- [ ] Dùng **AWS Secrets Manager** hoặc **AWS Parameter Store** thay vì `.env` plaintext
- [ ] Bật **VPC endpoint** cho S3 (tránh traffic qua internet, giảm chi phí)
- [ ] Cấu hình **CloudFront** CDN trước S3 → giảm latency, tăng tốc độ
- [ ] Bật **Access Log** trên S3 bucket → lưu vào S3 khác (data lake)
- [ ] Bật **S3 Object Lock** nếu cần WORM (Write Once Read Many) cho hồ sơ y tế
- [ ] Cấu hình **Cross-Region Replication** để backup disaster recovery
- [ ] Review **IAM Access Analyzer** định kỳ

---

## 13. Liên kết hữu ích

- [AWS Free Tier details](https://aws.amazon.com/free/)
- [S3 Pricing](https://aws.amazon.com/s3/pricing/)
- [S3 Security Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html)
- [HIPAA Eligible Services](https://aws.amazon.com/compliance/hipaa-eligible-services/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/)
- [S3 Presigned URL](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)

---

**Tóm tắt**: với $200 credit + Free Tier 12 tháng, bạn có thể chạy S3 cho đồ án tốt nghiệp
**gần như miễn phí** trong 2 năm. Sau đó chi phí chỉ vài chục cent mỗi tháng cho phòng khám nhỏ.