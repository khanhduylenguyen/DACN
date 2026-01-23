# PowerShell script to create .env file
$envContent = @"
# MongoDB Connection - MongoDB Atlas
MONGODB_URI=mongodb+srv://khanhduylenguyen74:6tRUZHofzIgi3LrT@cluster0.xnmerug.mongodb.net/medi-path-ease?retryWrites=true&w=majority

# Server Port
PORT=3000

# JWT Secret (Thay đổi trong production!)
JWT_SECRET=medi-path-ease-secret-key-2024-change-in-production

# CORS Origin (Frontend URL)
CORS_ORIGIN=http://localhost:5173
"@

$envContent | Out-File -FilePath ".env" -Encoding utf8
Write-Host "✅ File .env đã được tạo thành công!" -ForegroundColor Green

