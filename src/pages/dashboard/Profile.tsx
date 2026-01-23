import { useEffect, useState, useRef } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { UserCircle, Lock, Save, Camera, Mail, Phone, MapPin, Calendar } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getCurrentUser } from "@/lib/auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const USERS_KEY = "cliniccare:users";

interface User {
  id: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  username?: string;
  password?: string;
  avatar?: string;
}

const Profile = () => {
  const currentUser = getCurrentUser();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    gender: "male" as "male" | "female" | "other",
    dob: "",
    address: "",
  });

  // Avatar state
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  // Use ref to store the latest selected avatar to avoid losing it during re-renders
  const avatarRef = useRef<string | undefined>(undefined);

  // Password change states
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      // Load user account data
      const usersData = JSON.parse(localStorage.getItem(USERS_KEY) || "[]") as User[];
      let foundUser = usersData.find((u) => u.id === currentUser.id || u.email === currentUser.email);

      // If user not found in users list, create entry from currentUser
      if (!foundUser) {
        const newUserEntry: User = {
          id: currentUser.id,
          name: currentUser.name,
          role: currentUser.role,
          email: currentUser.email,
          phone: "",
          username: currentUser.username,
          avatar: undefined,
        };
        usersData.push(newUserEntry);
        localStorage.setItem(USERS_KEY, JSON.stringify(usersData));
        foundUser = newUserEntry;
      }

      if (foundUser) {
        setUser(foundUser);
        const loadedAvatar = foundUser.avatar;
        if (loadedAvatar && loadedAvatar.startsWith("data:image")) {
          setAvatar(loadedAvatar);
          avatarRef.current = loadedAvatar; // Also set ref
          console.log("Avatar loaded:", `Yes (length: ${loadedAvatar.length})`);
        } else {
          setAvatar(undefined);
          avatarRef.current = undefined;
          console.log("Avatar loaded: No", loadedAvatar ? `(invalid format: ${loadedAvatar.substring(0, 50)})` : "(not found)");
        }
        setFormData({
          fullName: foundUser.name,
          email: foundUser.email || "",
          phone: foundUser.phone || "",
          gender: "male",
          dob: "",
          address: "",
        });
      } else {
        // Fallback to currentUser from auth if not found in users
        setUser({
          id: currentUser.id,
          name: currentUser.name,
          role: currentUser.role,
          email: currentUser.email,
          phone: "",
        });
        setFormData({
          fullName: currentUser.name,
          email: currentUser.email || "",
          phone: "",
          gender: "male",
          dob: "",
          address: "",
        });
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      // Fallback to currentUser on error
      if (currentUser) {
        setUser({
          id: currentUser.id,
          name: currentUser.name,
          role: currentUser.role,
          email: currentUser.email,
          phone: "",
        });
        setFormData({
          fullName: currentUser.name,
          email: currentUser.email || "",
          phone: "",
          gender: "male",
          dob: "",
          address: "",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn file ảnh");
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Kích thước ảnh không được vượt quá 2MB");
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      if (base64String && base64String.startsWith("data:image")) {
        console.log("Avatar selected, base64 length:", base64String.length);
        setAvatar(base64String);
        // Also store in ref to ensure it's available when saving
        avatarRef.current = base64String;
        toast.success("Đã chọn ảnh đại diện");
      } else {
        console.error("Invalid base64 string:", base64String?.substring(0, 50));
        toast.error("Có lỗi xảy ra khi đọc file ảnh");
      }
    };
    reader.onerror = (error) => {
      console.error("FileReader error:", error);
      toast.error("Có lỗi xảy ra khi đọc file");
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = () => {
    if (!currentUser) return;

    // Validation
    if (!formData.fullName.trim()) {
      toast.error("Vui lòng nhập họ và tên");
      return;
    }
    if (!formData.email.trim()) {
      toast.error("Vui lòng nhập email");
      return;
    }

    try {
      // Update user account data
      // Use current avatar state if available, otherwise keep existing avatar from localStorage
      const usersData = JSON.parse(localStorage.getItem(USERS_KEY) || "[]") as User[];
      const foundUserIndex = usersData.findIndex((u) => u.id === currentUser.id || u.email === currentUser.email);
      
      // Determine avatar to save: prioritize avatar ref (newly selected) > avatar state > existing avatar
      let savedAvatar: string | undefined;
      
      // First priority: avatar ref (most reliable, won't be lost during re-renders)
      const refAvatar = avatarRef.current;
      // Second priority: avatar state
      const stateAvatar = avatar;
      
      console.log("Avatar ref:", refAvatar ? `Yes (length: ${refAvatar.length})` : "No");
      console.log("Avatar state:", stateAvatar ? `Yes (length: ${stateAvatar.length})` : "No");
      
      // Use ref first (most reliable), then state, then existing avatar
      if (refAvatar && refAvatar !== "" && refAvatar.startsWith("data:image")) {
        // User has selected a new avatar stored in ref
        console.log("Saving new avatar from ref, length:", refAvatar.length);
        savedAvatar = refAvatar;
      } else if (stateAvatar && stateAvatar !== "" && stateAvatar.startsWith("data:image")) {
        // User has selected a new avatar stored in state
        console.log("Saving new avatar from state, length:", stateAvatar.length);
        savedAvatar = stateAvatar;
      } else if (foundUserIndex !== -1 && usersData[foundUserIndex].avatar) {
        // Keep existing avatar from localStorage
        const existingAvatar = usersData[foundUserIndex].avatar;
        if (existingAvatar && existingAvatar !== "" && existingAvatar.startsWith("data:image")) {
          savedAvatar = existingAvatar;
          console.log("Keeping existing avatar from localStorage:", `Yes (length: ${existingAvatar.length})`);
        } else {
          savedAvatar = undefined;
          console.log("Existing avatar is invalid, clearing it");
        }
      } else if (user?.avatar && user.avatar !== "" && user.avatar.startsWith("data:image")) {
        // Fallback to user state avatar
        savedAvatar = user.avatar;
        console.log("Using user state avatar:", `Yes (length: ${user.avatar.length})`);
      } else {
        // No avatar available
        savedAvatar = undefined;
        console.log("No avatar to save");
      }

      if (foundUserIndex !== -1) {
        // Update existing user
        usersData[foundUserIndex] = {
          ...usersData[foundUserIndex],
          name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          avatar: savedAvatar,
        };
        console.log(`Updating user at index ${foundUserIndex}, avatar:`, savedAvatar ? `Yes (${savedAvatar.length} chars)` : "No");
      } else {
        // Create new user entry if not exists
        const newUser: User = {
          id: currentUser.id,
          name: formData.fullName,
          role: currentUser.role,
          email: formData.email,
          phone: formData.phone,
          password: user?.password || "", // Preserve password if exists
          avatar: savedAvatar,
        };
        usersData.push(newUser);
        console.log("Creating new user entry, avatar:", savedAvatar ? `Yes (${savedAvatar.length} chars)` : "No");
      }
      
      // Save to localStorage
      localStorage.setItem(USERS_KEY, JSON.stringify(usersData));
      console.log("Saved to localStorage, total users:", usersData.length);
      
      // Verify the save by reading back
      const verifyData = JSON.parse(localStorage.getItem(USERS_KEY) || "[]") as User[];
      const verifyUser = verifyData.find((u) => u.id === currentUser.id || u.email === formData.email);
      console.log("Verification - Avatar in localStorage:", verifyUser?.avatar ? `Yes (${verifyUser.avatar.length} chars)` : "No");

      // Update current user session
      const updatedCurrentUser = {
        ...currentUser,
        name: formData.fullName,
        email: formData.email,
      };
      localStorage.setItem("cliniccare:auth", JSON.stringify(updatedCurrentUser));
      window.dispatchEvent(new CustomEvent("cliniccare:auth:changed", { detail: updatedCurrentUser }));

      // Reload user data from localStorage to ensure we have the latest data
      const reloadedUsersData = JSON.parse(localStorage.getItem(USERS_KEY) || "[]") as User[];
      const updatedUser = reloadedUsersData.find((u) => u.id === currentUser.id || u.email === formData.email);
      if (updatedUser) {
        setUser(updatedUser);
        // Sync avatar state and ref with saved user avatar
        const savedAvatarValue = updatedUser.avatar;
        if (savedAvatarValue && savedAvatarValue.startsWith("data:image")) {
          setAvatar(savedAvatarValue);
          avatarRef.current = savedAvatarValue; // Also update ref
          console.log("Avatar saved and synced:", `Yes (length: ${savedAvatarValue.length})`);
        } else {
          // Only clear if we actually saved undefined, not if we're keeping existing
          if (savedAvatar === undefined) {
            setAvatar(undefined);
            avatarRef.current = undefined;
            console.log("Avatar cleared (invalid or empty)");
          } else {
            // Keep current avatar if we saved something
            console.log("Keeping current avatar state");
          }
        }
        console.log("Updated user object:", { 
          id: updatedUser.id, 
          name: updatedUser.name, 
          email: updatedUser.email,
          avatar: savedAvatarValue ? `present (${savedAvatarValue.length} chars)` : "missing" 
        });
      }

      // Dispatch event to notify other components about avatar update
      window.dispatchEvent(new CustomEvent("cliniccare:avatar:updated"));
      
      toast.success("Đã cập nhật thông tin thành công");
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Có lỗi xảy ra khi cập nhật thông tin");
    }
  };

  const handleChangePassword = () => {
    if (!currentUser) return;

    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Mật khẩu mới không khớp");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }

    try {
      const usersData = JSON.parse(localStorage.getItem(USERS_KEY) || "[]") as User[];
      const foundUserIndex = usersData.findIndex((u) => u.id === currentUser.id || u.email === currentUser.email);

      if (foundUserIndex !== -1) {
        const foundUser = usersData[foundUserIndex];
        // Verify current password
        if (foundUser.password && foundUser.password !== passwordData.currentPassword) {
          toast.error("Mật khẩu hiện tại không đúng");
          return;
        }

        // Update password
        usersData[foundUserIndex] = {
          ...usersData[foundUserIndex],
          password: passwordData.newPassword,
        };
      } else {
        // Create new user entry if not exists
        const newUser: User = {
          id: currentUser.id,
          name: currentUser.name,
          role: currentUser.role,
          email: currentUser.email,
          phone: user?.phone || "",
          password: passwordData.newPassword,
        };
        usersData.push(newUser);
      }
      localStorage.setItem(USERS_KEY, JSON.stringify(usersData));

      // Reload user data
      const updatedUser = usersData.find((u) => u.id === currentUser.id || u.email === currentUser.email);
      if (updatedUser) {
        setUser(updatedUser);
      }

      toast.success("Đã đổi mật khẩu thành công");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      console.error("Error changing password:", error);
      toast.error("Có lỗi xảy ra khi đổi mật khẩu");
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-64">
          <div className="text-[#687280]">Đang tải...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!currentUser) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-64">
          <div className="text-red-600">Không tìm thấy thông tin người dùng</div>
        </div>
      </DashboardLayout>
    );
  }

  const displayName = user?.name || currentUser.name;
  const displayEmail = user?.email || currentUser.email || "";
  const displayPhone = user?.phone || "";

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Thông tin tài khoản</h1>
            <p className="text-[#687280] mt-1">Quản lý thông tin cá nhân và cài đặt tài khoản</p>
          </div>
          {!isEditing && (
            <Button
              className="bg-[#007BFF] hover:bg-[#0056B3]"
              onClick={() => setIsEditing(true)}
            >
              <Save className="h-4 w-4 mr-2" />
              Chỉnh sửa
            </Button>
          )}
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Thông tin cá nhân</TabsTrigger>
            <TabsTrigger value="security">Bảo mật</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            {/* Avatar Section */}
            <Card className="border-[#E5E7EB]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCircle className="h-5 w-5" />
                  Ảnh đại diện
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <Avatar className="h-24 w-24">
                    <AvatarImage 
                      src={avatar || user?.avatar || undefined} 
                      alt={displayName}
                      onError={(e) => {
                        // If image fails to load, hide it and show fallback
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                    <AvatarFallback className="bg-[#007BFF] text-white text-2xl">
                      {displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {isEditing && (
                    <div>
                      <input
                        type="file"
                        id="avatar-upload"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        className="border-[#E5E7EB]"
                        onClick={() => document.getElementById("avatar-upload")?.click()}
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Đổi ảnh
                      </Button>
                      <p className="text-xs text-[#687280] mt-2">
                        JPG, PNG hoặc GIF. Tối đa 2MB
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Personal Information */}
            <Card className="border-[#E5E7EB]">
              <CardHeader>
                <CardTitle>Thông tin cá nhân</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fullName">Họ và tên *</Label>
                    <Input
                      id="fullName"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      disabled={!isEditing}
                      className="border-[#E5E7EB]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#687280]" />
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        disabled={!isEditing}
                        className="border-[#E5E7EB] pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="phone">Số điện thoại *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#687280]" />
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        disabled={!isEditing}
                        className="border-[#E5E7EB] pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="gender">Giới tính</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value) =>
                        setFormData({ ...formData, gender: value as "male" | "female" | "other" })
                      }
                      disabled={!isEditing}
                    >
                      <SelectTrigger className="border-[#E5E7EB]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Nam</SelectItem>
                        <SelectItem value="female">Nữ</SelectItem>
                        <SelectItem value="other">Khác</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="dob">Ngày sinh</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#687280]" />
                      <Input
                        id="dob"
                        type="date"
                        value={formData.dob}
                        onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                        disabled={!isEditing}
                        className="border-[#E5E7EB] pl-10"
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="address">Địa chỉ</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-[#687280]" />
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        disabled={!isEditing}
                        className="border-[#E5E7EB] pl-10"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            {isEditing && (
              <div className="flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  className="border-[#E5E7EB]"
                  onClick={() => {
                    setIsEditing(false);
                    // Reset form data and avatar
                    if (user) {
                      setFormData({
                        fullName: user.name,
                        email: user.email || "",
                        phone: user.phone || "",
                        gender: "male",
                        dob: "",
                        address: "",
                      });
                      setAvatar(user.avatar);
                      avatarRef.current = user.avatar; // Also reset ref
                    }
                  }}
                >
                  Hủy
                </Button>
                <Button className="bg-[#007BFF] hover:bg-[#0056B3]" onClick={handleSaveProfile}>
                  <Save className="h-4 w-4 mr-2" />
                  Lưu thay đổi
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card className="border-[#E5E7EB]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Đổi mật khẩu
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="currentPassword">Mật khẩu hiện tại *</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, currentPassword: e.target.value })
                    }
                    className="border-[#E5E7EB]"
                    placeholder="Nhập mật khẩu hiện tại"
                  />
                </div>
                <div>
                  <Label htmlFor="newPassword">Mật khẩu mới *</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, newPassword: e.target.value })
                    }
                    className="border-[#E5E7EB]"
                    placeholder="Tối thiểu 6 ký tự"
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                    }
                    className="border-[#E5E7EB]"
                    placeholder="Nhập lại mật khẩu mới"
                  />
                </div>
                <div className="flex items-center justify-end">
                  <Button className="bg-[#007BFF] hover:bg-[#0056B3]" onClick={handleChangePassword}>
                    <Lock className="h-4 w-4 mr-2" />
                    Đổi mật khẩu
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Profile;

