import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGoogleLogin } from "@react-oauth/google";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Calendar, Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { authenticate, setCurrentUser, authenticateWithGoogle, saveRememberMe, getRememberMe, clearRememberMe } from "@/lib/auth";
import { toast } from "sonner";
import heroImage from "@/assets/hero-doctor.jpg";

const loginSchema = z.object({
  emailOrPhone: z
    .string()
    .min(1, "Vui lòng nhập email, số điện thoại hoặc tên đăng nhập")
    .refine(
      (val) =>
        /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(val) ||
        /^(0|\+84)[0-9]{9,10}$/.test(val) ||
        /^[a-zA-Z0-9_]{3,}$/.test(val), // Cho phép username (chữ, số, gạch dưới, tối thiểu 3 ký tự)
      "Email, số điện thoại hoặc tên đăng nhập không hợp lệ"
    ),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
  rememberMe: z.boolean().default(false),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      emailOrPhone: "",
      password: "",
      rememberMe: false,
    },
  });

  // Load thông tin đăng nhập đã lưu khi component mount
  useEffect(() => {
    const savedIdentifier = getRememberMe();
    if (savedIdentifier) {
      form.setValue("emailOrPhone", savedIdentifier);
      form.setValue("rememberMe", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      const user = authenticate(data.emailOrPhone, data.password);
      setIsLoading(false);
      if (!user) {
        toast.error("Sai thông tin đăng nhập");
        return;
      }
      setCurrentUser(user);
      
      // Xử lý ghi nhớ đăng nhập
      if (data.rememberMe) {
        // Lưu email/username để tự động điền lần sau
        saveRememberMe(data.emailOrPhone);
      } else {
        // Xóa thông tin đã lưu nếu không chọn ghi nhớ
        clearRememberMe();
      }
      
      // Check if there's a return path from location state
      const returnPath = (location.state as any)?.returnPath;
      const specialty = (location.state as any)?.specialty;
      
      if (returnPath && user.role === "patient") {
        // Navigate to booking page with specialty pre-selected
        navigate(returnPath, { state: { specialty } });
      } else {
        const dest = user.role === "admin" ? "/dashboard" : user.role === "doctor" ? "/doctor" : user.role === "patient" ? "/patient" : "/";
        navigate(dest);
      }
    }, 800);
  };

  // Check if Google Client ID is available
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  const hasGoogleAuth = !!GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== "dummy-client-id-for-development";

  // Google Login Handler - luôn gọi hook (vì đã có GoogleOAuthProvider), nhưng chỉ sử dụng nếu có Google Client ID hợp lệ
  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      // Kiểm tra lại xem có Google Client ID hợp lệ không
      if (!hasGoogleAuth) {
        toast.info("Đăng nhập bằng Google chưa được cấu hình. Vui lòng sử dụng email/mật khẩu.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // Lấy thông tin user từ Google API
        const response = await fetch(
          `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${tokenResponse.access_token}`
        );
        
        if (!response.ok) {
          throw new Error("Failed to fetch user info");
        }
        
        const googleUser = await response.json();
        
        // Xác thực hoặc tạo user mới
        const user = authenticateWithGoogle({
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture,
        });
        
        if (!user) {
          toast.error("Đăng nhập bằng Google thất bại");
          setIsLoading(false);
          return;
        }
        
        // Lưu user vào localStorage
        setCurrentUser(user);
        
        // Lưu email để ghi nhớ đăng nhập (nếu user muốn)
        // Với Google login, luôn lưu email để tiện lần sau
        if (googleUser.email) {
          saveRememberMe(googleUser.email);
        }
        
        // Check return path
        const returnPath = (location.state as any)?.returnPath;
        const specialty = (location.state as any)?.specialty;
        
        if (returnPath && user.role === "patient") {
          navigate(returnPath, { state: { specialty } });
        } else {
          const dest = user.role === "admin" ? "/dashboard" : user.role === "doctor" ? "/doctor" : user.role === "patient" ? "/patient" : "/";
          navigate(dest);
        }
        
        toast.success(`Chào mừng ${user.name}!`);
        setIsLoading(false);
      } catch (error) {
        console.error("Google login error:", error);
        toast.error("Đăng nhập bằng Google thất bại. Vui lòng thử lại.");
        setIsLoading(false);
      }
    },
    onError: () => {
      if (hasGoogleAuth) {
        toast.error("Đăng nhập bằng Google thất bại. Vui lòng thử lại.");
      } else {
        toast.info("Đăng nhập bằng Google chưa được cấu hình. Vui lòng sử dụng email/mật khẩu.");
      }
      setIsLoading(false);
    },
  });

  const handleSocialLogin = (provider: "google" | "facebook" | "zalo") => {
    if (provider === "google") {
      setIsLoading(true);
      handleGoogleLogin();
    } else {
      console.log(`Login with ${provider} - Coming soon`);
      toast.info("Tính năng đăng nhập bằng " + (provider === "facebook" ? "Facebook" : "Zalo") + " sẽ sớm được cập nhật");
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Image Section */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#F9FAFB] via-[#E3F2FD] to-[#BBDEFB] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent z-10" />
        <img
          src={heroImage}
          alt="Bác sĩ tư vấn bệnh nhân"
          className="w-full h-full object-cover opacity-90"
        />
        {/* Overlay content */}
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-12 text-white">
          <div className="flex items-center gap-2 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
              <Calendar className="h-7 w-7 text-white" />
            </div>
            <span className="text-2xl font-bold">ClinicCare</span>
          </div>
          <h2 className="text-3xl font-bold mb-4 text-center">
            Chăm sóc sức khỏe của bạn
          </h2>
          <p className="text-lg text-center opacity-90 max-w-md">
            Sứ mệnh của chúng tôi là mang đến dịch vụ y tế chất lượng cao,
            tận tâm và tiện lợi nhất cho bạn
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col bg-[#F9FAFB]">
        {/* Top Navigation */}
        <div className="flex justify-between items-center p-6 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#007BFF]">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">ClinicCare</span>
          </div>
          <div className="hidden md:flex items-center gap-4 text-sm text-[#687280]">
            <Link
              to="/"
              className="hover:text-[#007BFF] transition-colors"
            >
              Trang chủ
            </Link>
            <Link
              to="/login"
              className="text-[#007BFF] font-medium"
            >
              Đăng nhập
            </Link>
            <Link
              to="/register"
              className="hover:text-[#007BFF] transition-colors"
            >
              Đăng ký
            </Link>
          </div>
        </div>

        {/* Login Form */}
        <div className="flex-1 flex items-center justify-center p-6 md:p-12">
          <div className="w-full max-w-md space-y-8 animate-fade-in">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-gray-900">
                Đăng nhập
              </h1>
              <p className="text-[#687280]">
                Chào mừng bạn trở lại! Vui lòng đăng nhập để tiếp tục
              </p>
            </div>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="emailOrPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-900">
                        Email, số điện thoại hoặc tên đăng nhập
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#687280]" />
                          <Input
                            {...field}
                            type="text"
                            placeholder="email@example.com, 0901234567 hoặc username"
                            className="pl-10 h-12 border-[#E5E7EB] bg-white"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-900">Mật khẩu</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#687280]" />
                          <Input
                            {...field}
                            type={showPassword ? "text" : "password"}
                            placeholder="Nhập mật khẩu"
                            className="pl-10 pr-10 h-12 border-[#E5E7EB] bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#687280] hover:text-[#007BFF] transition-colors"
                          >
                            {showPassword ? (
                              <EyeOff className="h-5 w-5" />
                            ) : (
                              <Eye className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center justify-between">
                  <FormField
                    control={form.control}
                    name="rememberMe"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="border-[#E5E7EB]"
                          />
                        </FormControl>
                        <FormLabel className="text-sm text-[#687280] cursor-pointer">
                          Ghi nhớ đăng nhập
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                  <Link
                    to="/forgot-password"
                    className="text-sm text-[#007BFF] hover:underline"
                  >
                    Quên mật khẩu?
                  </Link>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-[#007BFF] hover:bg-[#0056B3] text-white text-base font-medium rounded-lg transition-all"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Đang xác thực, vui lòng chờ...
                    </span>
                  ) : (
                    <>
                      Đăng nhập
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
                <div className="text-xs text-center text-[#687280]">Demo: admin@cliniccare.vn, doctor@cliniccare.vn, patient@cliniccare.vn • Mật khẩu: 123456</div>
              </form>
            </Form>

            {/* Social Login */}
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#E5E7EB]" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-[#F9FAFB] text-[#687280]">
                    Hoặc đăng nhập bằng
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {hasGoogleAuth && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSocialLogin("google")}
                    className="h-12 border-[#E5E7EB] hover:bg-white hover:border-[#007BFF] transition-all"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSocialLogin("facebook")}
                  className="h-12 border-[#E5E7EB] hover:bg-white hover:border-[#007BFF] transition-all"
                >
                  <svg className="h-5 w-5" fill="#1877F2" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSocialLogin("zalo")}
                  className="h-12 border-[#E5E7EB] hover:bg-white hover:border-[#007BFF] transition-all"
                >
                  <svg className="h-5 w-5" fill="#0068FF" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5.5 8.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm-11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm5.5 7c-2.33 0-4.32-1.45-5.12-3.5h10.24c-.8 2.05-2.79 3.5-5.12 3.5z" />
                  </svg>
                </Button>
              </div>
            </div>

            {/* Register Link */}
            <div className="text-center">
              <p className="text-sm text-[#687280]">
                Chưa có tài khoản?{" "}
                <Link
                  to="/register"
                  className="text-[#007BFF] font-medium hover:underline"
                >
                  Đăng ký để đặt lịch khám nhanh hơn chỉ với 1 phút!
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

