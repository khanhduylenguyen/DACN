import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Calendar, Phone, User, LogOut, LayoutDashboard, UserCircle, Lock, Home } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { getCurrentUser, logout, AUTH_EVENT, type AuthUser, type UserRole } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showHotlineDialog, setShowHotlineDialog] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | undefined>(undefined);
  const [doctorClinic, setDoctorClinic] = useState<string | undefined>(undefined);

  const loadUserAvatar = () => {
    if (!currentUser) {
      setUserAvatar(undefined);
      return;
    }

    try {
      // Try to load from users storage
      const USERS_KEY = "cliniccare:users";
      const usersData = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
      const foundUser = usersData.find((u: any) => u.id === currentUser.id || u.email === currentUser.email);
      if (foundUser?.avatar) {
        setUserAvatar(foundUser.avatar);
        return;
      }

      // For doctors, try to load from staff storage
      if (currentUser.role === "doctor") {
        const STAFF_STORAGE_KEY = "cliniccare:staff";
        const staffData = JSON.parse(localStorage.getItem(STAFF_STORAGE_KEY) || "[]");
        const foundStaff = staffData.find(
          (s: any) => s.email === currentUser.email || s.id === currentUser.id || s.fullName === currentUser.name
        );
        if (foundStaff?.avatar) {
          setUserAvatar(foundStaff.avatar);
          return;
        }
        // set clinic/branch name if available
        if (foundStaff) {
          const clinic = foundStaff.clinicName || foundStaff.department || foundStaff.specialty;
          setDoctorClinic(clinic);
        } else {
          setDoctorClinic(undefined);
        }
      }
    } catch (error) {
      console.error("Error loading avatar:", error);
    }
    setUserAvatar(undefined);
  };

  useEffect(() => {
    setCurrentUser(getCurrentUser());
    const handleAuthChange = () => {
      setCurrentUser(getCurrentUser());
    };
    window.addEventListener("storage", handleAuthChange);
    window.addEventListener(AUTH_EVENT, handleAuthChange as EventListener);
    return () => {
      window.removeEventListener("storage", handleAuthChange);
      window.removeEventListener(AUTH_EVENT, handleAuthChange as EventListener);
    };
  }, []);

  useEffect(() => {
    loadUserAvatar();
    // Listen for profile updates
    const handleProfileUpdate = () => loadUserAvatar();
    window.addEventListener("storage", handleProfileUpdate);
    window.addEventListener("cliniccare:avatar:updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("storage", handleProfileUpdate);
      window.removeEventListener("cliniccare:avatar:updated", handleProfileUpdate);
    };
  }, [currentUser]);
 
  // Fetch staff info from server to get clinic/branch for doctor accounts
  useEffect(() => {
    const fetchStaff = async () => {
      if (!currentUser || currentUser.role !== "doctor") return;
      try {
        const res = await fetch("/api/staff");
        if (!res.ok) {
          console.warn("Failed to fetch staff from server:", res.status);
          return;
        }
        const data = await res.json();
        const staffList = Array.isArray(data.data) ? data.data : data;
        const found = staffList.find(
          (s: any) =>
            (s.userId && String(s.userId) === String(currentUser.id)) ||
            s.email === currentUser.email ||
            s.fullName === currentUser.name
        );
        if (found) {
          const clinic = found.clinicName || found.department || found.specialty;
          setDoctorClinic(clinic);
        }
      } catch (error) {
        console.error("Error fetching staff info:", error);
      }
    };

    fetchStaff();
  }, [currentUser]);

  const roleActions: Record<UserRole, { href: string; label: string }> = {
    admin: { href: "/dashboard", label: "Trang quản trị" },
    doctor: { href: "/doctor", label: "Trang bác sĩ" },
    receptionist: { href: "/dashboard", label: "Trang làm việc" },
    patient: { href: "/patient", label: "Trang bệnh nhân" },
  };

  const getProfileRoute = (role: UserRole): string => {
    switch (role) {
      case "doctor":
        return "/doctor/profile";
      case "patient":
        return "/patient/profile";
      case "admin":
      case "receptionist":
      default:
        return "/dashboard/profile";
    }
  };

  const getChangePasswordRoute = (role: UserRole): string => {
    switch (role) {
      case "doctor":
        return "/doctor/change-password";
      case "patient":
        return "/patient/change-password";
      case "admin":
      case "receptionist":
      default:
        return "/dashboard/change-password";
    }
  };

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    setIsMenuOpen(false);
    navigate("/login");
  };

  // Check if user is on their dashboard
  const isOnUserDashboard = (role: UserRole): boolean => {
    switch (role) {
      case "admin":
      case "receptionist":
        return location.pathname.startsWith("/dashboard");
      case "doctor":
        return location.pathname.startsWith("/doctor");
      case "patient":
        return location.pathname.startsWith("/patient");
      default:
        return false;
    }
  };
  
  // Check if should show dashboard link for current user
  const shouldShowDashboardLink = currentUser 
    ? !isOnUserDashboard(currentUser.role)
    : false;
  
  // Get dashboard link info for current user
  const dashboardLink = currentUser && shouldShowDashboardLink
    ? roleActions[currentUser.role]
    : null;

  const navLinks = [
    { name: "Trang chủ", href: "/" },
    { name: "Dịch vụ", href: "#services" },
    { name: "Bác sĩ", href: "#doctors" },
    { name: "Tin tức", href: "/news" },
    { name: "Liên hệ", href: "#contact" },
  ];

  // Handle logo click - navigate to home
  const handleLogoClick = () => {
    if (location.pathname !== "/") {
      navigate("/");
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    setIsMenuOpen(false);
  };

  // Handle smooth scroll for anchor links
  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("#")) {
      e.preventDefault();
      const targetId = href.substring(1);
      
      // If not on home page, navigate first
      if (location.pathname !== "/") {
        navigate("/", { state: { scrollTo: targetId } });
        return;
      }

      // Scroll to section
      const element = document.querySelector(`#${targetId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setIsMenuOpen(false);
    }
  };

  // Handle booking button click
  const handleBookingClick = () => {
    const user = currentUser;
    if (!user) {
      navigate("/login", { state: { returnPath: "/patient/book" } });
      setIsMenuOpen(false);
      return;
    }

    if (user.role === "patient") {
      navigate("/patient/book");
    } else {
      // Scroll to booking section if on home page
      if (location.pathname === "/") {
        const bookingSection = document.querySelector("#quick-booking");
        if (bookingSection) {
          bookingSection.scrollIntoView({ behavior: "smooth" });
        } else {
          navigate("/login", { state: { returnPath: "/patient/book" } });
        }
      } else {
        navigate("/login", { state: { returnPath: "/patient/book" } });
      }
    }
    setIsMenuOpen(false);
  };

  // Handle hotline click
  const handleHotlineClick = () => {
    setShowHotlineDialog(true);
  };

  // Copy phone number to clipboard
  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    toast.success(`Đã sao chép số điện thoại: ${phone}`);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <button
            onClick={handleLogoClick}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80">
              <Calendar className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">ClinicCare</span>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              link.href.startsWith("/") ? (
                <Link
                  key={link.name}
                  to={link.href}
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                >
                  {link.name}
                </Link>
              ) : (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={(e) => handleAnchorClick(e, link.href)}
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary cursor-pointer"
                >
                  {link.name}
                </a>
              )
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" size="sm" className="gap-2" onClick={handleHotlineClick}>
              <Phone className="h-4 w-4" />
              <span className="text-sm">Hotline</span>
            </Button>
            {currentUser ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={userAvatar} />
                      <AvatarFallback className="bg-[#007BFF] text-white text-xs">
                        {currentUser.name?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden md:flex md:flex-col md:items-start">
                      <span className="text-sm font-medium text-gray-900">
                        {currentUser.name || "Người dùng"}
                      </span>
                      {currentUser.role === "doctor" && doctorClinic && (
                        <span className="text-xs text-[#687280]">{doctorClinic}</span>
                      )}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Tài khoản</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {dashboardLink && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to={dashboardLink.href} className="flex items-center gap-2">
                          <LayoutDashboard className="h-4 w-4" />
                          {dashboardLink.label}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {currentUser && (currentUser.role === "doctor" || currentUser.role === "patient") && isOnUserDashboard(currentUser.role) && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/" className="flex items-center gap-2">
                          <Home className="h-4 w-4" />
                          Trang chủ
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem asChild>
                    <Link to={getProfileRoute(currentUser.role)} className="flex items-center gap-2">
                      <UserCircle className="h-4 w-4" />
                      Hồ sơ
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={getChangePasswordRoute(currentUser.role)} className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Đổi mật khẩu
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link to="/login">
                <User className="h-4 w-4" />
                <span>Đăng nhập</span>
              </Link>
            </Button>
            )}
            <Button size="sm" className="gap-2" onClick={handleBookingClick}>
              <Calendar className="h-4 w-4" />
              <span>Đặt lịch ngay</span>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t space-y-2">
            <div className="px-4">
              <ThemeToggle />
            </div>
            <nav className="flex flex-col gap-4">
              {navLinks.map((link) => (
                link.href.startsWith("/") ? (
                  <Link
                    key={link.name}
                    to={link.href}
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {link.name}
                  </Link>
                ) : (
                  <a
                    key={link.name}
                    href={link.href}
                    onClick={(e) => handleAnchorClick(e, link.href)}
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary cursor-pointer"
                  >
                    {link.name}
                  </a>
                )
              ))}
              <div className="flex flex-col gap-2 pt-4 border-t">
                <Button variant="ghost" size="sm" className="w-full gap-2 justify-start" onClick={handleHotlineClick}>
                  <Phone className="h-4 w-4" />
                  <span>Hotline</span>
                </Button>
                {currentUser ? (
                  <>
                    <div className="flex items-center gap-2 px-2 py-2 border-b">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-[#007BFF] text-white text-xs">
                          {currentUser.name?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">{currentUser.name || "Người dùng"}</span>
                        {currentUser.role === "doctor" && doctorClinic && (
                          <span className="text-xs text-[#687280]">{doctorClinic}</span>
                        )}
                      </div>
                    </div>
                    {dashboardLink && (
                      <Button variant="outline" size="sm" className="w-full gap-2 justify-start" asChild>
                        <Link to={dashboardLink.href} onClick={() => setIsMenuOpen(false)}>
                          <LayoutDashboard className="h-4 w-4" />
                          <span>{dashboardLink.label}</span>
                        </Link>
                      </Button>
                    )}
                    {(currentUser.role === "doctor" || currentUser.role === "patient") && isOnUserDashboard(currentUser.role) && (
                      <Button variant="outline" size="sm" className="w-full gap-2 justify-start" asChild>
                        <Link to="/" onClick={() => setIsMenuOpen(false)}>
                          <Home className="h-4 w-4" />
                          <span>Trang chủ</span>
                        </Link>
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="w-full gap-2 justify-start" asChild>
                      <Link to={getProfileRoute(currentUser.role)} onClick={() => setIsMenuOpen(false)}>
                        <UserCircle className="h-4 w-4" />
                        <span>Hồ sơ</span>
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="w-full gap-2 justify-start" asChild>
                      <Link to={getChangePasswordRoute(currentUser.role)} onClick={() => setIsMenuOpen(false)}>
                        <Lock className="h-4 w-4" />
                        <span>Đổi mật khẩu</span>
                      </Link>
                    </Button>
                    <Button variant="secondary" size="sm" className="w-full gap-2 justify-start text-red-600" onClick={handleLogout}>
                      <LogOut className="h-4 w-4" />
                      <span>Đăng xuất</span>
                    </Button>
                  </>
                ) : (
                <Button variant="outline" size="sm" className="w-full gap-2" asChild>
                  <Link to="/login" onClick={() => setIsMenuOpen(false)}>
                    <User className="h-4 w-4" />
                    <span>Đăng nhập</span>
                  </Link>
                </Button>
                )}
                <Button size="sm" className="w-full gap-2" onClick={handleBookingClick}>
                  <Calendar className="h-4 w-4" />
                  <span>Đặt lịch ngay</span>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>

      {/* Hotline Dialog */}
      <Dialog open={showHotlineDialog} onOpenChange={setShowHotlineDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liên hệ với chúng tôi</DialogTitle>
            <DialogDescription>
              Vui lòng chọn một trong các số điện thoại sau để liên hệ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Hotline chính</p>
                  <p className="text-sm text-muted-foreground">24/7 hỗ trợ</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="tel:19001234"
                  className="text-lg font-semibold text-primary hover:underline"
                >
                  1900 1234
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyPhone("19001234")}
                  className="h-8 w-8 p-0"
                >
                  📋
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Hotline khẩn cấp</p>
                  <p className="text-sm text-muted-foreground">Hỗ trợ 24/7</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="tel:0912345678"
                  className="text-lg font-semibold text-primary hover:underline"
                >
                  0912 345 678
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyPhone("0912345678")}
                  className="h-8 w-8 p-0"
                >
                  📋
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Tư vấn đặt lịch</p>
                  <p className="text-sm text-muted-foreground">8:00 - 20:00</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="tel:0987654321"
                  className="text-lg font-semibold text-primary hover:underline"
                >
                  0987 654 321
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyPhone("0987654321")}
                  className="h-8 w-8 p-0"
                >
                  📋
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
};

export default Header;
