import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { startReminderService, stopReminderService } from "@/lib/reminders";
import { startDoctorReminderService } from "@/lib/doctor-notifications";
import { getCurrentUser, AUTH_EVENT } from "@/lib/auth";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import ErrorBoundary from "@/components/error/ErrorBoundary";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import News from "./pages/News";
import NewsDetail from "./pages/NewsDetail";
import Dashboard from "./pages/dashboard/Dashboard";
import Appointments from "./pages/dashboard/Appointments";
import Doctors from "./pages/dashboard/Doctors";
import Patients from "./pages/dashboard/Patients";
import Services from "./pages/dashboard/Services";
import Clinics from "./pages/dashboard/Clinics";
import Reports from "./pages/dashboard/Reports";
import Settings from "./pages/dashboard/Settings";
import AdminNews from "./pages/dashboard/AdminNews";
import AdminComments from "./pages/dashboard/AdminComments";
import AdminNewsStats from "./pages/dashboard/AdminNewsStats";
import RequireRole from "@/components/auth/RequireRole";
import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import DoctorAppointments from "./pages/doctor/Appointments";
import DoctorRecords from "./pages/doctor/Records";
import DoctorPrescriptions from "./pages/doctor/Prescriptions";
import DoctorStats from "./pages/doctor/Stats";
import DoctorProfile from "./pages/doctor/Profile";
import FamilyPatients from "./pages/doctor/FamilyPatients";
import ScheduleManagement from "./pages/doctor/ScheduleManagement";
import PatientFollowUp from "./pages/doctor/PatientFollowUp";
import Analytics from "./pages/doctor/Analytics";
import DoctorNotifications from "./pages/doctor/Notifications";
import AdminProfile from "./pages/dashboard/Profile";
import PatientDashboard from "./pages/patient/PatientDashboard";
import PatientProfile from "./pages/patient/Profile";
import PatientBook from "./pages/patient/Book";
import PatientAppointments from "./pages/patient/Appointments";
import PatientRecords from "./pages/patient/Records";
import PatientPrescriptions from "./pages/patient/Prescriptions";
import PatientNotifications from "./pages/patient/Notifications";
import PatientPayments from "./pages/patient/Payments";
import MedicationSchedule from "./pages/patient/MedicationSchedule";
import TestResults from "./pages/patient/TestResults";
import HealthDashboard from "./pages/patient/HealthDashboard";
import Family from "./pages/patient/Family";
import FamilyMemberDetail from "./pages/patient/FamilyMemberDetail";
import FamilyDashboard from "./pages/patient/FamilyDashboard";
import AdvancedDoctorSearch from "./pages/patient/AdvancedDoctorSearch";
import TelemedicinePage from "./pages/telemedicine/Telemedicine";
import MomoCallback from "./pages/payment/MomoCallback";
import MomoQr from "./pages/payment/MomoQr";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Google Client ID - lấy từ environment variable
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

// Debug: Log Google Client ID status
console.log("[App] Google Client ID from env:", GOOGLE_CLIENT_ID ? "Found" : "Not found");
console.log("[App] Full env check:", {
  hasClientId: !!GOOGLE_CLIENT_ID,
  clientIdLength: GOOGLE_CLIENT_ID.length,
  isDummy: GOOGLE_CLIENT_ID === "dummy-client-id-for-development"
});

// Component để khởi động reminder service
const ReminderService = () => {
  useEffect(() => {
    try {
      // Start reminder service - check every 30 minutes
      // Có thể điều chỉnh interval qua environment variable
      const intervalMinutes = parseInt(import.meta.env.VITE_REMINDER_CHECK_INTERVAL || "30", 10);
      startReminderService(intervalMinutes);
    } catch (error) {
      console.error("Error starting reminder service:", error);
    }

    // Cleanup on unmount
    return () => {
      try {
        stopReminderService();
      } catch (error) {
        console.error("Error stopping reminder service:", error);
      }
    };
  }, []);

  return null;
};

// Component để khởi động doctor reminder service
const DoctorReminderService = () => {
  useEffect(() => {
    // Check if user is a doctor and start reminder service
    const checkAndStart = () => {
      try {
        const user = getCurrentUser();
        if (user && user.role === "doctor" && user.id) {
          const cleanup = startDoctorReminderService(user.id);
          return cleanup;
        }
      } catch (error) {
        console.error("Error starting doctor reminder service:", error);
      }
      return () => {};
    };

    const cleanup = checkAndStart();

    // Also listen for auth changes
    const handleAuthChange = () => {
      cleanup();
      checkAndStart();
    };
    window.addEventListener(AUTH_EVENT, handleAuthChange as EventListener);

    return () => {
      cleanup();
      window.removeEventListener(AUTH_EVENT, handleAuthChange as EventListener);
    };
  }, []);

  return null;
};

// Wrapper component để xử lý GoogleOAuthProvider an toàn
const AppContent = () => (
  <TooltipProvider>
    <ReminderService />
    <DoctorReminderService />
    <Toaster />
    <Sonner />
    <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/news" element={<News />} />
          <Route path="/news/:id" element={<NewsDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          {/* Dashboard Routes (Admin only) */}
          <Route path="/dashboard" element={<RequireRole roles={["admin"]}><Dashboard /></RequireRole>} />
          <Route path="/dashboard/appointments" element={<RequireRole roles={["admin"]}><Appointments /></RequireRole>} />
          <Route path="/dashboard/patients" element={<RequireRole roles={["admin"]}><Patients /></RequireRole>} />
          <Route path="/dashboard/doctors" element={<RequireRole roles={["admin"]}><Doctors /></RequireRole>} />
          <Route path="/dashboard/services" element={<RequireRole roles={["admin"]}><Services /></RequireRole>} />
          <Route path="/dashboard/clinics" element={<RequireRole roles={["admin"]}><Clinics /></RequireRole>} />
          <Route path="/dashboard/reports" element={<RequireRole roles={["admin"]}><Reports /></RequireRole>} />
          <Route path="/dashboard/settings" element={<RequireRole roles={["admin"]}><Settings /></RequireRole>} />
          <Route path="/dashboard/profile" element={<RequireRole roles={["admin"]}><AdminProfile /></RequireRole>} />
          <Route path="/dashboard/news" element={<RequireRole roles={["admin"]}><AdminNews /></RequireRole>} />
          <Route path="/dashboard/news/comments" element={<RequireRole roles={["admin"]}><AdminComments /></RequireRole>} />
          <Route path="/dashboard/news/stats" element={<RequireRole roles={["admin"]}><AdminNewsStats /></RequireRole>} />
          {/* Role specific dashboards */}
          <Route path="/doctor" element={<RequireRole roles={["doctor"]}><DoctorDashboard /></RequireRole>} />
          <Route path="/doctor/appointments" element={<RequireRole roles={["doctor"]}><DoctorAppointments /></RequireRole>} />
          <Route path="/doctor/records" element={<RequireRole roles={["doctor"]}><DoctorRecords /></RequireRole>} />
          <Route path="/doctor/prescriptions" element={<RequireRole roles={["doctor"]}><DoctorPrescriptions /></RequireRole>} />
          <Route path="/doctor/family-patients" element={<RequireRole roles={["doctor"]}><FamilyPatients /></RequireRole>} />
          <Route path="/doctor/schedule" element={<RequireRole roles={["doctor"]}><ScheduleManagement /></RequireRole>} />
          <Route path="/doctor/followup" element={<RequireRole roles={["doctor"]}><PatientFollowUp /></RequireRole>} />
          <Route path="/doctor/analytics" element={<RequireRole roles={["doctor"]}><Analytics /></RequireRole>} />
          <Route path="/doctor/stats" element={<RequireRole roles={["doctor"]}><DoctorStats /></RequireRole>} />
          <Route path="/doctor/notifications" element={<RequireRole roles={["doctor"]}><DoctorNotifications /></RequireRole>} />
          <Route path="/doctor/profile" element={<RequireRole roles={["doctor"]}><DoctorProfile /></RequireRole>} />
          {/* Patient Routes */}
          <Route path="/patient" element={<RequireRole roles={["patient"]}><PatientDashboard /></RequireRole>} />
          <Route path="/patient/book" element={<RequireRole roles={["patient"]}><PatientBook /></RequireRole>} />
          <Route path="/patient/appointments" element={<RequireRole roles={["patient"]}><PatientAppointments /></RequireRole>} />
          <Route path="/patient/records" element={<RequireRole roles={["patient"]}><PatientRecords /></RequireRole>} />
          <Route path="/patient/prescriptions" element={<RequireRole roles={["patient"]}><PatientPrescriptions /></RequireRole>} />
          <Route path="/patient/notifications" element={<RequireRole roles={["patient"]}><PatientNotifications /></RequireRole>} />
          <Route path="/patient/payments" element={<RequireRole roles={["patient"]}><PatientPayments /></RequireRole>} />
          <Route path="/patient/medication-schedule" element={<RequireRole roles={["patient"]}><MedicationSchedule /></RequireRole>} />
          <Route path="/patient/test-results" element={<RequireRole roles={["patient"]}><TestResults /></RequireRole>} />
          <Route path="/patient/health" element={<RequireRole roles={["patient"]}><HealthDashboard /></RequireRole>} />
          <Route path="/patient/family" element={<RequireRole roles={["patient"]}><Family /></RequireRole>} />
          <Route path="/patient/family/dashboard" element={<RequireRole roles={["patient"]}><FamilyDashboard /></RequireRole>} />
          <Route path="/patient/family/:id" element={<RequireRole roles={["patient"]}><FamilyMemberDetail /></RequireRole>} />
          <Route path="/patient/profile" element={<RequireRole roles={["patient"]}><PatientProfile /></RequireRole>} />
          <Route path="/patient/search" element={<RequireRole roles={["patient"]}><AdvancedDoctorSearch /></RequireRole>} />
          {/* Telemedicine */}
          <Route path="/telemedicine" element={<RequireRole roles={["patient", "doctor"]}><TelemedicinePage /></RequireRole>} />
          {/* Allow direct links to a specific appointment or instant room (e.g. /telemedicine/A008 or /telemedicine/instant-REQ-123) */}
          <Route path="/telemedicine/:appointmentId" element={<RequireRole roles={["patient", "doctor"]}><TelemedicinePage /></RequireRole>} />
          {/* Payment */}
          <Route path="/payment/momo/callback" element={<MomoCallback />} />
          <Route path="/payment/momo/qr" element={<MomoQr />} />
          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
);

const App = () => {
  // Luôn wrap với GoogleOAuthProvider để tránh lỗi "must be used within GoogleOAuthProvider"
  // Nếu không có clientId, dùng một dummy value (Google login sẽ không hoạt động nhưng app vẫn chạy)
  const clientId = GOOGLE_CLIENT_ID || "dummy-client-id-for-development";
  
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <GoogleOAuthProvider clientId={clientId}>
            <AppContent />
          </GoogleOAuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;

