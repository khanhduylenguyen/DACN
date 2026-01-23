import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import {
  Calendar,
  Mail,
  Lock,
  Phone,
  User,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { sendOTP, verifyOTP, getPendingOTPEmail } from "@/lib/otp";
import { registerUser, setCurrentUser } from "@/lib/auth";
import heroImage from "@/assets/hero-doctor.jpg";

// Multi-step form schemas
const step1Schema = z.object({
  fullName: z.string().min(2, "Họ tên phải có ít nhất 2 ký tự"),
  email: z.string().email("Email không hợp lệ"),
  phone: z
    .string()
    .min(10, "Số điện thoại không hợp lệ")
    .regex(/^(0|\+84)[0-9]{9,10}$/, "Số điện thoại không đúng định dạng"),
});

const step2Schema = z.object({
  username: z
    .string()
    .min(3, "Tên đăng nhập phải có ít nhất 3 ký tự")
    .regex(/^[a-zA-Z0-9_]+$/, "Tên đăng nhập chỉ chứa chữ, số và dấu gạch dưới"),
  password: z
    .string()
    .min(8, "Mật khẩu phải có ít nhất 8 ký tự")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Mật khẩu phải chứa chữ hoa, chữ thường và số"
    ),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Mật khẩu xác nhận không khớp",
  path: ["confirmPassword"],
});

const step3Schema = z.object({
  otp: z.string().length(6, "Mã OTP phải có 6 số"),
});

type Step1FormValues = z.infer<typeof step1Schema>;
type Step2FormValues = z.infer<typeof step2Schema>;
type Step3FormValues = z.infer<typeof step3Schema>;

const Register = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingOTP, setIsSendingOTP] = useState(false);
  const [otpEmail, setOtpEmail] = useState<string>("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const navigate = useNavigate();

  const step1Form = useForm<Step1FormValues>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
    },
  });

  const step2Form = useForm<Step2FormValues>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
    },
  });

  const step3Form = useForm<Step3FormValues>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      otp: "",
    },
  });

  const onStep1Submit = (data: Step1FormValues) => {
    console.log("Step 1 data:", data);
    setCurrentStep(2);
  };

  const onStep2Submit = async (data: Step2FormValues) => {
    const step1Data = step1Form.getValues();
    const email = step1Data.email;
    
    setIsSendingOTP(true);
    setOtpEmail(email);
    
    try {
      const result = await sendOTP(email);
      if (result.success) {
        toast.success("Mã OTP đã được gửi đến email của bạn");
        // Trong development, hiển thị OTP trong console và toast
        if (result.otp) {
          console.log(`🔐 OTP Code: ${result.otp}`);
          toast.info(`Mã OTP (dev): ${result.otp}`, { duration: 10000 });
        }
        // Chỉ hiển thị warning nếu có error và không phải do thiếu config
        if (result.error && process.env.NODE_ENV === "development") {
          toast.warning(result.error, { duration: 8000 });
        }
        setCurrentStep(3);
        setResendCountdown(60); // 60 giây countdown
      } else {
        toast.error(result.error || "Không thể gửi mã OTP. Vui lòng thử lại");
      }
    } catch (error) {
      toast.error("Có lỗi xảy ra khi gửi mã OTP");
    } finally {
      setIsSendingOTP(false);
    }
  };

  const onStep3Submit = async (data: Step3FormValues) => {
    setIsLoading(true);
    
    try {
      const result = verifyOTP(otpEmail, data.otp);
      
      if (result.valid) {
        // OTP hợp lệ - tạo tài khoản
        const step1Data = step1Form.getValues();
        const step2Data = step2Form.getValues();
        
        // Đăng ký user mới với role patient (async)
        const newUser = await registerUser(
          step1Data.fullName,
          step1Data.email,
          step1Data.phone,
          step2Data.username,
          step2Data.password
        );
        
        if (!newUser) {
          toast.error("Email, số điện thoại hoặc username đã được sử dụng");
          return;
        }
        
        // Tự động đăng nhập user mới
        setCurrentUser(newUser);
        
        toast.success("Đăng ký thành công! Đang chuyển đến trang cá nhân...");
        
        // Chuyển đến trang patient dashboard
        setTimeout(() => {
          navigate("/patient");
        }, 1000);
      } else {
        toast.error(result.message || "Mã OTP không đúng");
        step3Form.setError("otp", { message: result.message || "Mã OTP không đúng" });
      }
    } catch (error) {
      console.error("Registration error:", error);
      toast.error("Có lỗi xảy ra khi đăng ký. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleResendOTP = async () => {
    if (resendCountdown > 0) return;
    
    setIsSendingOTP(true);
    
    try {
      const result = await sendOTP(otpEmail);
      if (result.success) {
        toast.success("Mã OTP mới đã được gửi đến email của bạn");
        if (result.otp) {
          console.log(`🔐 OTP Code: ${result.otp}`);
          toast.info(`Mã OTP (dev): ${result.otp}`, { duration: 10000 });
        }
        // Chỉ hiển thị warning nếu có error và không phải do thiếu config
        if (result.error && process.env.NODE_ENV === "development") {
          toast.warning(result.error, { duration: 8000 });
        }
        setResendCountdown(60);
      } else {
        toast.error(result.error || "Không thể gửi lại mã OTP. Vui lòng thử lại");
      }
    } catch (error) {
      toast.error("Có lỗi xảy ra khi gửi lại mã OTP");
    } finally {
      setIsSendingOTP(false);
    }
  };
  
  // Countdown timer cho resend OTP
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => {
        setResendCountdown(resendCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);
  
  // Lấy email từ pending OTP khi vào step 3
  useEffect(() => {
    if (currentStep === 3) {
      const pendingEmail = getPendingOTPEmail();
      if (pendingEmail && !otpEmail) {
        setOtpEmail(pendingEmail);
      }
    }
  }, [currentStep, otpEmail]);

  const handleSocialRegister = (provider: "google" | "facebook" | "zalo") => {
    console.log(`Register with ${provider}`);
    // Implement social registration logic here
  };

  const steps = [
    { number: 1, title: "Thông tin cá nhân", completed: currentStep > 1 },
    { number: 2, title: "Tạo tài khoản", completed: currentStep > 2 },
    { number: 3, title: "Xác thực", completed: false },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Image Section */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#F9FAFB] via-[#E8F5E9] to-[#C8E6C9] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-[#4CAF50]/20 to-transparent z-10" />
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
            Đăng ký ngay hôm nay
          </h2>
          <p className="text-lg text-center opacity-90 max-w-md">
            Tạo tài khoản chỉ trong 1 phút để đặt lịch khám nhanh chóng và
            theo dõi sức khỏe dễ dàng
          </p>
        </div>
      </div>

      {/* Right Side - Register Form */}
      <div className="w-full lg:w-1/2 flex flex-col bg-[#F9FAFB] overflow-y-auto">
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
              className="hover:text-[#007BFF] transition-colors"
            >
              Đăng nhập
            </Link>
            <Link
              to="/register"
              className="text-[#007BFF] font-medium"
            >
              Đăng ký
            </Link>
          </div>
        </div>

        {/* Register Form */}
        <div className="flex-1 flex items-center justify-center p-6 md:p-12">
          <div className="w-full max-w-md space-y-8 animate-fade-in">
            <div className="text-center space-y-4">
              <h1 className="text-3xl font-bold text-gray-900">Đăng ký</h1>
              <p className="text-[#687280]">
                Tạo tài khoản để bắt đầu đặt lịch khám
              </p>

              {/* Progress Steps */}
              <div className="flex items-center justify-center gap-2 mt-6">
                {steps.map((step, index) => (
                  <div key={step.number} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                          step.completed
                            ? "bg-[#4CAF50] border-[#4CAF50] text-white"
                            : currentStep === step.number
                            ? "bg-[#007BFF] border-[#007BFF] text-white"
                            : "bg-white border-[#E5E7EB] text-[#687280]"
                        }`}
                      >
                        {step.completed ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <span className="text-sm font-medium">
                            {step.number}
                          </span>
                        )}
                      </div>
                      <span
                        className={`mt-2 text-xs font-medium ${
                          currentStep === step.number
                            ? "text-[#007BFF]"
                            : "text-[#687280]"
                        }`}
                      >
                        {step.title}
                      </span>
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={`h-0.5 w-12 mx-2 ${
                          step.completed ? "bg-[#4CAF50]" : "bg-[#E5E7EB]"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>

              <Progress
                value={(currentStep / 3) * 100}
                className="mt-4 h-2"
              />
            </div>

            {/* Step 1: Personal Information */}
            {currentStep === 1 && (
              <Form {...step1Form}>
                <form
                  onSubmit={step1Form.handleSubmit(onStep1Submit)}
                  className="space-y-6"
                >
                  <FormField
                    control={step1Form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-900">Họ và tên</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#687280]" />
                            <Input
                              {...field}
                              type="text"
                              placeholder="Nguyễn Văn A"
                              className="pl-10 h-12 border-[#E5E7EB] bg-white"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step1Form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-900">Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#687280]" />
                            <Input
                              {...field}
                              type="email"
                              placeholder="email@example.com"
                              className="pl-10 h-12 border-[#E5E7EB] bg-white"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step1Form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-900">
                          Số điện thoại
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#687280]" />
                            <Input
                              {...field}
                              type="tel"
                              placeholder="0901234567"
                              className="pl-10 h-12 border-[#E5E7EB] bg-white"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full h-12 bg-[#007BFF] hover:bg-[#0056B3] text-white text-base font-medium rounded-lg"
                  >
                    Tiếp tục
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </form>
              </Form>
            )}

            {/* Step 2: Account Creation */}
            {currentStep === 2 && (
              <Form {...step2Form}>
                <form
                  onSubmit={step2Form.handleSubmit(onStep2Submit)}
                  className="space-y-6"
                >
                  <FormField
                    control={step2Form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-900">
                          Tên đăng nhập
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#687280]" />
                            <Input
                              {...field}
                              type="text"
                              placeholder="username"
                              className="pl-10 h-12 border-[#E5E7EB] bg-white"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-[#687280]">
                          Chỉ chứa chữ, số và dấu gạch dưới
                        </p>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step2Form.control}
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
                              placeholder="Tối thiểu 8 ký tự"
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
                        <p className="text-xs text-[#687280]">
                          Phải chứa chữ hoa, chữ thường và số
                        </p>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step2Form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-900">
                          Xác nhận mật khẩu
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#687280]" />
                            <Input
                              {...field}
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="Nhập lại mật khẩu"
                              className="pl-10 pr-10 h-12 border-[#E5E7EB] bg-white"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setShowConfirmPassword(!showConfirmPassword)
                              }
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#687280] hover:text-[#007BFF] transition-colors"
                            >
                              {showConfirmPassword ? (
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

                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep(1)}
                      className="flex-1 h-12 border-[#E5E7EB] hover:bg-gray-50"
                    >
                      <ArrowLeft className="mr-2 h-5 w-5" />
                      Quay lại
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSendingOTP}
                      className="flex-1 h-12 bg-[#007BFF] hover:bg-[#0056B3] text-white disabled:opacity-50"
                    >
                      {isSendingOTP ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Đang gửi OTP...
                        </span>
                      ) : (
                        <>
                          Tiếp tục
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            )}

            {/* Step 3: OTP Verification */}
            {currentStep === 3 && (
              <Form {...step3Form}>
                <form
                  onSubmit={step3Form.handleSubmit(onStep3Submit)}
                  className="space-y-6"
                >
                  <div className="text-center space-y-2">
                    <p className="text-[#687280]">
                      Chúng tôi đã gửi mã OTP đến email của bạn
                    </p>
                    {otpEmail && (
                      <p className="text-sm font-medium text-gray-900">
                        {otpEmail}
                      </p>
                    )}
                    <p className="text-sm text-[#687280]">
                      Vui lòng kiểm tra hộp thư và nhập mã 6 số
                    </p>
                  </div>

                  <FormField
                    control={step3Form.control}
                    name="otp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-900">
                          Mã OTP
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="text"
                            placeholder="000000"
                            maxLength={6}
                            pattern="[0-9]*"
                            inputMode="numeric"
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, "");
                              field.onChange(value);
                            }}
                            className="h-12 text-center text-2xl tracking-widest border-[#E5E7EB] bg-white"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="text-center">
                    <Button
                      type="button"
                      variant="link"
                      onClick={handleResendOTP}
                      disabled={resendCountdown > 0 || isSendingOTP}
                      className="text-[#007BFF] disabled:text-gray-400"
                    >
                      {isSendingOTP ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 border-2 border-[#007BFF] border-t-transparent rounded-full animate-spin" />
                          Đang gửi...
                        </span>
                      ) : resendCountdown > 0 ? (
                        `Gửi lại mã OTP (${resendCountdown}s)`
                      ) : (
                        "Gửi lại mã OTP"
                      )}
                    </Button>
                  </div>

                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCurrentStep(2)}
                      className="flex-1 h-12 border-[#E5E7EB] hover:bg-gray-50"
                    >
                      <ArrowLeft className="mr-2 h-5 w-5" />
                      Quay lại
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 h-12 bg-[#4CAF50] hover:bg-[#45A049] text-white"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Đang xác thực...
                        </span>
                      ) : (
                        <>
                          Hoàn tất
                          <CheckCircle2 className="ml-2 h-5 w-5" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            )}

            {/* Social Register - Only show on step 1 */}
            {currentStep === 1 && (
              <div className="space-y-4 pt-6 border-t border-[#E5E7EB]">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#E5E7EB]" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-[#F9FAFB] text-[#687280]">
                      Hoặc đăng ký bằng
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSocialRegister("google")}
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSocialRegister("facebook")}
                    className="h-12 border-[#E5E7EB] hover:bg-white hover:border-[#007BFF] transition-all"
                  >
                    <svg className="h-5 w-5" fill="#1877F2" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleSocialRegister("zalo")}
                    className="h-12 border-[#E5E7EB] hover:bg-white hover:border-[#007BFF] transition-all"
                  >
                    <svg className="h-5 w-5" fill="#0068FF" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5.5 8.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm-11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm5.5 7c-2.33 0-4.32-1.45-5.12-3.5h10.24c-.8 2.05-2.79 3.5-5.12 3.5z" />
                    </svg>
                  </Button>
                </div>
              </div>
            )}

            {/* Login Link */}
            <div className="text-center pt-4">
              <p className="text-sm text-[#687280]">
                Đã có tài khoản?{" "}
                <Link
                  to="/login"
                  className="text-[#007BFF] font-medium hover:underline"
                >
                  Đăng nhập ngay
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;

