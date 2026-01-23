import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, Stethoscope, FileText, Activity, Pill, LayoutDashboard, Menu, X, Search, Bell, UserCircle, LogOut, Video, Users, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { logout, getCurrentUser } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = { children: React.ReactNode };

const menu = [
  { title: "Tổng quan", icon: LayoutDashboard, href: "/doctor" },
  { title: "Lịch khám", icon: Calendar, href: "/doctor/appointments" },
  { title: "Lịch làm việc", icon: Clock, href: "/doctor/schedule" },
  { title: "Theo dõi bệnh nhân", icon: Bell, href: "/doctor/followup" },
  { title: "Hồ sơ", icon: FileText, href: "/doctor/records" },
  { title: "Kê toa", icon: Pill, href: "/doctor/prescriptions" },
  { title: "Bệnh nhân gia đình", icon: Users, href: "/doctor/family-patients" },
  { title: "Phân tích & Báo cáo", icon: Activity, href: "/doctor/analytics" },
  { title: "Thống kê", icon: Activity, href: "/doctor/stats" },
  { title: "Thông báo", icon: Bell, href: "/doctor/notifications" },
  { title: "Telemedicine", icon: Video, href: "/telemedicine" },
];

const DoctorLayout = ({ children }: Props) => {
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
      // Try to load from staff storage first (for doctors)
      const STAFF_STORAGE_KEY = "cliniccare:staff";
      const staffData = JSON.parse(localStorage.getItem(STAFF_STORAGE_KEY) || "[]");
      const foundStaff = staffData.find(
        (s: any) => s.email === currentUser.email || s.id === currentUser.id || s.fullName === currentUser.name
      );
      if (foundStaff?.avatar) {
        setUserAvatar(foundStaff.avatar);
        return;
      }

      // Fallback to users storage
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
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#007BFF]"><Stethoscope className="h-6 w-6 text-white" /></div>
            {open && <span className="text-xl font-bold text-gray-900">Doctor</span>}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 hidden lg:flex" onClick={()=>setOpen(!open)}>
            <Calendar className={`h-4 w-4 opacity-0`} />
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
                <Input placeholder="Tìm lịch hẹn, bệnh nhân..." className="pl-10 border-[#E5E7EB] bg-[#F9FAFB]" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" size="icon"><Bell className="h-5 w-5 text-[#687280]" /></Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={userAvatar} />
                      <AvatarFallback className="bg-[#007BFF] text-white text-xs">
                        {currentUser?.name?.charAt(0).toUpperCase() || "DR"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:block text-sm font-medium text-gray-900">
                      {currentUser?.name || "Bác sĩ"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Tài khoản</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/doctor/profile" className="flex items-center gap-2">
                      <UserCircle className="h-4 w-4" />
                      Hồ sơ
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { logout(); navigate("/login"); }} className="text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
};

export default DoctorLayout;


