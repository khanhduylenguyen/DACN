import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CalendarPlus, ClipboardList, Pill, FileText, LayoutDashboard, Menu, X, Search, Bell, User, CreditCard, Video, Clock, TestTube, Activity, Users, BarChart3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { logout, getCurrentUser } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

type Props = { children: React.ReactNode };

const menu = [
  { title: "Tổng quan", icon: LayoutDashboard, href: "/patient" },
  { title: "Đặt lịch", icon: CalendarPlus, href: "/patient/book" },
  { title: "Lịch hẹn", icon: ClipboardList, href: "/patient/appointments" },
  { title: "Thanh toán", icon: CreditCard, href: "/patient/payments" },
  { title: "Hồ sơ bệnh án", icon: FileText, href: "/patient/records" },
  { title: "Toa thuốc", icon: Pill, href: "/patient/prescriptions" },
  { title: "Lịch uống thuốc", icon: Clock, href: "/patient/medication-schedule" },
  { title: "Kết quả xét nghiệm", icon: TestTube, href: "/patient/test-results" },
  { title: "Health Dashboard", icon: Activity, href: "/patient/health" },
  { title: "Quản lý Gia đình", icon: Users, href: "/patient/family" },
  { title: "Dashboard Gia đình", icon: BarChart3, href: "/patient/family/dashboard" },
  { title: "Thông báo", icon: Bell, href: "/patient/notifications" },
  { title: "Telemedicine", icon: Video, href: "/telemedicine" },
];

const PatientLayout = ({ children }: Props) => {
  const [open, setOpen] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | undefined>(undefined);
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  const loadUserAvatar = () => {
    if (!currentUser) {
      setUserAvatar(undefined);
      return;
    }

    try {
      // Load from users storage
      const USERS_KEY = "cliniccare:users";
      const usersData = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
      const foundUser = usersData.find((u: any) => u.id === currentUser.id || u.email === currentUser.email);
      if (foundUser?.avatar) {
        setUserAvatar(foundUser.avatar);
        return;
      }
    } catch (error) {
      console.error("Error loading avatar:", error);
    }
    setUserAvatar(undefined);
  };

  useEffect(() => {
    loadUserAvatar();
    // Listen for avatar updates
    const handleAvatarUpdate = () => loadUserAvatar();
    window.addEventListener("cliniccare:avatar:updated", handleAvatarUpdate);
    return () => window.removeEventListener("cliniccare:avatar:updated", handleAvatarUpdate);
  }, [currentUser]);

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex">
      <aside className={`${open ? "w-64" : "w-20"} bg-white border-r border-[#E5E7EB] fixed lg:static h-screen z-50 transition-all duration-300`}>
        <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#007BFF]"><User className="h-6 w-6 text-white" /></div>
            {open && <span className="text-xl font-bold text-gray-900">Patient</span>}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 hidden lg:flex" onClick={()=>setOpen(!open)}>
            <CalendarPlus className={`h-4 w-4 opacity-0`} />
          </Button>
        </div>
        <nav className="p-4">
          <ul className="space-y-1">
            {menu.map((m)=>{
              const Icon = m.icon;
              const active = location.pathname === m.href;
              return (
                <li key={m.href}>
                  <Link to={m.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${active ? "bg-[#007BFF] text-white" : "text-[#687280] hover:bg-[#F3F4F6] hover:text-[#007BFF]"}`}>
                    <Icon className="h-5 w-5" />
                    {open && <span className="text-sm font-medium">{m.title}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <div className="flex-1 flex flex-col lg:ml-0 overflow-hidden">
        <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-40">
          <div className="flex items-center justify-between p-4 gap-4">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={()=>setMobile(!mobile)}>
              {mobile ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
            <div className="flex-1 max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#687280]" />
                <Input placeholder="Tìm toa thuốc, lịch sử..." className="pl-10 border-[#E5E7EB] bg-[#F9FAFB]" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" size="icon"><Bell className="h-5 w-5 text-[#687280]" /></Button>
              <Avatar className="h-8 w-8">
                <AvatarImage src={userAvatar} />
                <AvatarFallback className="bg-[#007BFF] text-white text-xs">
                  {currentUser?.name?.charAt(0).toUpperCase() || "PT"}
                </AvatarFallback>
              </Avatar>
              <Button variant="outline" className="border-[#E5E7EB]" onClick={()=>{ logout(); navigate("/login"); }}>Đăng xuất</Button>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
};

export default PatientLayout;


