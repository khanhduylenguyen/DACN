/**
 * Test script để tạo tài khoản và kiểm tra lưu vào MongoDB
 */

const testRegister = async () => {
  try {
    console.log("🧪 Testing Register API...\n");

    // Test data
    const testUser = {
      name: "Test User",
      email: `test${Date.now()}@example.com`,
      password: "password123",
      phone: "0123456789",
      role: "patient"
    };

    console.log("📝 Creating user:", testUser.email);

    // Call register API
    const response = await fetch("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testUser),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log("✅ User created successfully!");
      console.log("📊 Response:", JSON.stringify(data, null, 2));
      console.log("\n🔍 User ID:", data.data.user.id);
      console.log("📧 Email:", data.data.user.email);
      console.log("👤 Name:", data.data.user.name);
      console.log("🔑 Token:", data.data.token.substring(0, 20) + "...");
      
      console.log("\n✅ Tài khoản đã được lưu vào MongoDB!");
      console.log("💡 Bạn có thể kiểm tra trong MongoDB Atlas:");
      console.log("   - Database: medi-path-ease");
      console.log("   - Collection: users");
      console.log("   - Email:", testUser.email);
    } else {
      console.error("❌ Error:", data.message);
    }
  } catch (error) {
    console.error("❌ Connection error:", error.message);
    console.log("\n💡 Đảm bảo backend server đang chạy:");
    console.log("   cd server");
    console.log("   npm run dev");
  }
};

testRegister();

