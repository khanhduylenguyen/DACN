/**
 * Test script để đăng nhập và kiểm tra
 */

const testLogin = async () => {
  try {
    console.log("🧪 Testing Login API...\n");

    // Sử dụng email từ test register trước đó
    const loginData = {
      email: "test1765744011945@example.com",
      password: "password123"
    };

    console.log("📝 Logging in:", loginData.email);

    const response = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(loginData),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log("✅ Login successful!");
      console.log("📊 User data:", JSON.stringify(data.data.user, null, 2));
      console.log("🔑 Token:", data.data.token.substring(0, 30) + "...");
    } else {
      console.error("❌ Login failed:", data.message);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
};

testLogin();

