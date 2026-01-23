/**
 * Test script để lấy danh sách users từ database
 */

const testGetUsers = async () => {
  try {
    console.log("🧪 Testing Get Users API...\n");

    const response = await fetch("http://localhost:3000/api/users", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log(`✅ Found ${data.data.length} users in database:\n`);
      
      data.data.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email})`);
        console.log(`   Role: ${user.role}`);
        console.log(`   ID: ${user._id || user.id}`);
        console.log(`   Created: ${new Date(user.createdAt).toLocaleString('vi-VN')}`);
        console.log("");
      });

      console.log("✅ Dữ liệu đã được lưu vào MongoDB!");
    } else {
      console.error("❌ Error:", data.message);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
};

testGetUsers();

