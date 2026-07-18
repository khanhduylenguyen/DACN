import { useEffect, useState, useRef, useCallback } from "react";
import PatientLayout from "@/components/layout/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Calendar,
  Building2,
  User,
  X,
  Download,
  Eye,
  Trash2,
  Plus,
  TrendingUp,
  FileCheck,
  Search,
  ArrowUp,
  ArrowDown,
  Minus,
  Filter,
  SortAsc,
  SortDesc,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { getCurrentUser, AUTH_EVENT } from "@/lib/auth";
import { useS3Upload } from "@/lib/useS3Upload";
import { refreshSignedUrl } from "@/lib/upload";
import {
  getLabResults,
  saveLabResult,
  updateLabResult,
  deleteLabResult,
  fileToDataURL,
  validateLabFile,
  getUniqueTestNames,
  getTestHistory,
  type LabResult,
  type LabFile,
} from "@/lib/lab-results";
import { toast } from "sonner";
import { TestResultsSkeleton } from "@/components/loading/SkeletonLoaders";

const TestResults = () => {
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getCurrentUser>>(getCurrentUser());
  const [results, setResults] = useState<LabResult[]>([]);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<LabResult | null>(null);
  const [resultToDelete, setResultToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTestName, setSelectedTestName] = useState<string | null>(null);
  const [comparisonResults, setComparisonResults] = useState<LabResult[]>([]);
  const [sortBy, setSortBy] = useState<"date" | "name" | "facility">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterTestName, setFilterTestName] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("all");
  
  // Form state
  const [formData, setFormData] = useState({
    testName: "",
    testDate: new Date().toISOString().split("T")[0],
    facility: "",
    doctor: "",
    notes: "",
  });
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ file: File; preview: string; uploaded?: boolean; key?: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // S3 upload hook - tự động đẩy file lên AWS S3 qua backend.
  const { upload, isUploading: isS3Uploading, errors: s3Errors, uploads: s3Uploads } = useS3Upload({
    folder: "lab-results",
    patientId: currentUser?.id,
  });

  // Load results
  const loadResults = useCallback(() => {
    const userId = currentUser?.id;
    if (!userId) return;
    const data = getLabResults(userId);
    // Sort by date (newest first)
    const sorted = data.sort((a, b) => {
      const dateA = new Date(a.testDate).getTime();
      const dateB = new Date(b.testDate).getTime();
      return dateB - dateA;
    });
    setResults(sorted);
  }, [currentUser?.id]);

  // Listen for auth changes
  useEffect(() => {
    const handleAuthChange = () => {
      setCurrentUser(getCurrentUser());
    };
    window.addEventListener(AUTH_EVENT, handleAuthChange);
    return () => {
      window.removeEventListener(AUTH_EVENT, handleAuthChange);
    };
  }, []);

  useEffect(() => {
    const userId = currentUser?.id;
    
    if (userId) {
      setIsLoading(true);
      // Simulate loading delay for better UX
      const timer = setTimeout(() => {
        loadResults();
        setIsLoading(false);
      }, 300);

      // Listen for updates
      const handleUpdate = () => {
        loadResults();
      };
      window.addEventListener("labResultsUpdated", handleUpdate);
      
      return () => {
        clearTimeout(timer);
        window.removeEventListener("labResultsUpdated", handleUpdate);
      };
    } else {
      setIsLoading(false);
      return undefined;
    }
  }, [currentUser?.id, loadResults]);

  // Filter and sort results
  const filteredResults = results
    .filter((result) => {
      const matchesSearch = 
        result.testName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        result.facility?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        result.doctor?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesTestName = !filterTestName || result.testName === filterTestName;
      
      return matchesSearch && matchesTestName;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "date":
          comparison = new Date(a.testDate).getTime() - new Date(b.testDate).getTime();
          break;
        case "name":
          comparison = a.testName.localeCompare(b.testName);
          break;
        case "facility":
          comparison = (a.facility || "").localeCompare(b.facility || "");
          break;
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });

  // Get unique test names for autocomplete
  const testNames = getUniqueTestNames(currentUser?.id || "");

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Process files (validation + upload lên S3 qua backend)
  const processFiles = async (files: File[]) => {
    const validFiles: File[] = [];
    for (const file of files) {
      const validation = validateLabFile(file);
      if (!validation.valid) {
        toast.error(validation.error || `File không hợp lệ: ${file.name}`);
        continue;
      }
      validFiles.push(file);
    }
    if (validFiles.length === 0) return;

    // 1) Tạo preview URL (blob) cho UI hiển thị NGAY trong khi upload
    const newEntries = await Promise.all(
      validFiles.map(async (file) => {
        const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
        return { file, preview, uploaded: false };
      })
    );
    setUploadedFiles((prev) => [...prev, ...newEntries]);

    // 2) Upload song song (giới hạn concurrency trong hook) - đẩy lên S3
    for (const entry of newEntries) {
      try {
        const up = await upload(entry.file);
        if (up.key) {
          // Cập nhật entry với key + url thật (S3 presigned)
          setUploadedFiles((prev) =>
            prev.map((e) =>
              e === entry ? { ...e, preview: up.url, uploaded: true, key: up.key } : e
            )
          );
          if (up.error) {
            toast.warning(`Upload lỗi (đã dùng fallback): ${up.error}`);
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`Không upload được ${entry.file.name}: ${msg}`);
      }
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  // Remove file from upload list
  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle upload
  const handleUpload = async () => {
    if (!currentUser?.id) return;
    
    if (!formData.testName.trim()) {
      toast.error("Vui lòng nhập tên xét nghiệm");
      return;
    }
    
    if (uploadedFiles.length === 0) {
      toast.error("Vui lòng chọn ít nhất một file");
      return;
    }

    // Nếu S3 còn đang upload, đợi xong trước khi save
    if (isS3Uploading || (s3Uploads || []).some((u) => u.status === "uploading")) {
      toast.info("Đang upload lên AWS S3, vui lòng đợi...");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Chuyển file UI → LabFile (giữ S3 key & presigned URL)
      const labFiles: LabFile[] = uploadedFiles.map(({ file, preview, key, uploaded }) => ({
        id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        name: file.name,
        type: file.type === "application/pdf" ? "pdf" : "image",
        url: preview,
        key,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        s3Uploaded: Boolean(uploaded && key),
      }));
      
      // Save result
      saveLabResult({
        patientId: currentUser.id,
        testName: formData.testName.trim(),
        testDate: formData.testDate,
        facility: formData.facility.trim() || undefined,
        doctor: formData.doctor.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        files: labFiles,
      });
      
      toast.success("Đã lưu kết quả xét nghiệm");
      
      // Reload results to show new entry
      loadResults();
      
      // Reset form
      setFormData({
        testName: "",
        testDate: new Date().toISOString().split("T")[0],
        facility: "",
        doctor: "",
        notes: "",
      });
      setUploadedFiles([]);
      setIsUploadDialogOpen(false);
    } catch (error) {
      console.error("Error uploading:", error);
      toast.error("Có lỗi xảy ra khi lưu kết quả");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle view
  const handleView = (result: LabResult) => {
    setSelectedResult(result);
    setIsViewDialogOpen(true);
  };

  // Handle delete
  const handleDeleteClick = (id: string) => {
    setResultToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!resultToDelete) return;
    
    if (deleteLabResult(resultToDelete)) {
      toast.success("Đã xóa kết quả xét nghiệm");
      loadResults();
    } else {
      toast.error("Không thể xóa kết quả");
    }
    
    setIsDeleteDialogOpen(false);
    setResultToDelete(null);
  };

  // Handle comparison
  const handleCompare = (testName: string) => {
    if (!currentUser?.id) {
      toast.error("Vui lòng đăng nhập để sử dụng tính năng này");
      return;
    }
    
    const history = getTestHistory(currentUser.id, testName);
    
    if (history.length === 0) {
      toast.info("Chưa có lịch sử xét nghiệm cho loại này");
      return;
    }
    
    setComparisonResults(history);
    setSelectedTestName(testName);
    // Switch to compare tab
    setActiveTab("compare");
    
    toast.success(`Đã tải ${history.length} kết quả để so sánh`);
  };

  // Prepare chart data for comparison
  const getChartData = () => {
    if (comparisonResults.length === 0) return [];
    
    return comparisonResults.map((result, index) => {
      const date = new Date(result.testDate);
      const dateStr = date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      
      return {
        name: dateStr,
        date: result.testDate,
        index: index + 1,
        filesCount: result.files.length,
        fullDate: dateStr,
      };
    });
  };

  // Calculate time difference between results
  const getTimeDifference = (date1: string, date2: string) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) return `${diffDays} ngày`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} tháng`;
    return `${Math.floor(diffDays / 365)} năm`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /**
   * Làm mới URL khi file đã load qua S3 mà presigned URL hết hạn (sau 1h).
   * Gọi khi user bấm "Xem" hoặc khi <img>/<iframe> lỗi load.
   */
  const getViewableUrl = async (file: LabFile): Promise<string> => {
    if (!file.key) return file.url;
    try {
      const fresh = await refreshSignedUrl(file.key, 3600);
      return fresh;
    } catch {
      return file.url;
    }
  };

  /**
   * Handler "Xem" - mở file (đã refresh URL nếu cần).
   */
  const handleViewFile = async (file: LabFile) => {
    const url = await getViewableUrl(file);
    window.open(url, "_blank");
  };

  if (isLoading) {
    return (
      <PatientLayout>
        <TestResultsSkeleton />
      </PatientLayout>
    );
  }

  if (!currentUser) {
    return (
      <PatientLayout>
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-12 text-center">
            <FileText className="h-16 w-16 text-[#687280] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Vui lòng đăng nhập
            </h3>
            <p className="text-[#687280]">
              Bạn cần đăng nhập để xem kết quả xét nghiệm
            </p>
          </CardContent>
        </Card>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Kết quả Xét nghiệm Online</h1>
            <p className="text-[#687280] mt-1">
              Quản lý và theo dõi kết quả xét nghiệm của bạn - Upload PDF/ảnh, so sánh theo thời gian
            </p>
          </div>
          <Button
            onClick={() => setIsUploadDialogOpen(true)}
            className="bg-[#007BFF] hover:bg-[#0056B3]"
          >
            <Plus className="h-4 w-4 mr-2" />
            Upload kết quả
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-[#E5E7EB]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#687280]">Tổng số kết quả</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{results.length}</p>
                </div>
                <FileCheck className="h-8 w-8 text-[#007BFF]" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E5E7EB]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#687280]">Loại xét nghiệm</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{testNames.length}</p>
                </div>
                <FileText className="h-8 w-8 text-[#16a34a]" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E5E7EB]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#687280]">Kết quả gần nhất</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {results.length > 0 ? formatDate(results[0].testDate) : "Chưa có"}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-[#f59e0b]" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <Card className="border-[#E5E7EB]">
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#687280]" />
                  <Input
                    placeholder="Tìm kiếm theo tên xét nghiệm, cơ sở, bác sĩ..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-[#687280]" />
                  <Label className="text-sm text-[#687280]">Lọc theo:</Label>
                  <select
                    value={filterTestName}
                    onChange={(e) => setFilterTestName(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#007BFF]"
                  >
                    <option value="">Tất cả loại xét nghiệm</option>
                    {testNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-center gap-2 ml-auto">
                  <Label className="text-sm text-[#687280]">Sắp xếp:</Label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "date" | "name" | "facility")}
                    className="px-3 py-1.5 text-sm border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#007BFF]"
                  >
                    <option value="date">Ngày xét nghiệm</option>
                    <option value="name">Tên xét nghiệm</option>
                    <option value="facility">Cơ sở</option>
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                    className="px-3"
                  >
                    {sortOrder === "asc" ? (
                      <SortAsc className="h-4 w-4" />
                    ) : (
                      <SortDesc className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results List */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">Tất cả ({filteredResults.length})</TabsTrigger>
            <TabsTrigger value="compare">So sánh</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {filteredResults.length === 0 ? (
              <Card className="border-[#E5E7EB]">
                <CardContent className="p-12 text-center">
                  <FileText className="h-16 w-16 text-[#687280] mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {searchQuery ? "Không tìm thấy kết quả" : "Chưa có kết quả xét nghiệm"}
                  </h3>
                  <p className="text-[#687280] mb-4">
                    {searchQuery
                      ? "Thử tìm kiếm với từ khóa khác"
                      : "Upload kết quả xét nghiệm đầu tiên của bạn"}
                  </p>
                  {!searchQuery && (
                    <Button
                      onClick={() => setIsUploadDialogOpen(true)}
                      className="bg-[#007BFF] hover:bg-[#0056B3]"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Upload kết quả
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              filteredResults.map((result) => (
                <Card key={result.id} className="border-[#E5E7EB] hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{result.testName}</h3>
                          <Badge variant="outline" className="text-xs">
                            {result.files.length} {result.files.length === 1 ? "file" : "files"}
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm text-[#687280]">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDate(result.testDate)}</span>
                          </div>
                          {result.facility && (
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              <span>{result.facility}</span>
                            </div>
                          )}
                          {result.doctor && (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <span>{result.doctor}</span>
                            </div>
                          )}
                        </div>
                        {result.notes && (
                          <p className="text-sm text-[#687280] mt-2 line-clamp-2">{result.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCompare(result.testName)}
                        >
                          <TrendingUp className="h-4 w-4 mr-2" />
                          So sánh
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleView(result)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Xem
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(result.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="compare" className="space-y-4">
            {selectedTestName ? (
              <div className="space-y-4">
                <Card className="border-[#E5E7EB]">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl">So sánh: {selectedTestName}</CardTitle>
                        <CardDescription className="mt-1">
                          {comparisonResults.length} kết quả theo thời gian
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedTestName(null);
                          setComparisonResults([]);
                          setActiveTab("all");
                        }}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Đóng
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {comparisonResults.length === 0 ? (
                      <p className="text-[#687280] text-center py-8">
                        Chưa có dữ liệu để so sánh
                      </p>
                    ) : (
                      <div className="space-y-6">
                        {/* Chart Visualization */}
                        {comparisonResults.length > 1 && (
                          <Card className="border-[#E5E7EB] bg-gradient-to-br from-blue-50 to-indigo-50">
                            <CardHeader>
                              <CardTitle className="text-lg flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-[#007BFF]" />
                                Biểu đồ xu hướng
                              </CardTitle>
                              <CardDescription>
                                Số lượng file kết quả theo thời gian
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={getChartData()}>
                                    <defs>
                                      <linearGradient id="colorFiles" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#007BFF" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#007BFF" stopOpacity={0.1}/>
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                    <XAxis 
                                      dataKey="name" 
                                      stroke="#687280"
                                      style={{ fontSize: '12px' }}
                                    />
                                    <YAxis 
                                      stroke="#687280"
                                      style={{ fontSize: '12px' }}
                                    />
                                    <Tooltip 
                                      contentStyle={{ 
                                        backgroundColor: '#fff', 
                                        border: '1px solid #E5E7EB',
                                        borderRadius: '8px'
                                      }}
                                    />
                                    <Area 
                                      type="monotone" 
                                      dataKey="filesCount" 
                                      stroke="#007BFF" 
                                      fillOpacity={1} 
                                      fill="url(#colorFiles)"
                                      strokeWidth={2}
                                    />
                                  </AreaChart>
                                </ResponsiveContainer>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Timeline View */}
                        <div className="relative">
                          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#007BFF] via-blue-300 to-[#007BFF]"></div>
                          <div className="space-y-6">
                            {comparisonResults.map((result, index) => {
                              const isLast = index === comparisonResults.length - 1;
                              const prevResult = index > 0 ? comparisonResults[index - 1] : null;
                              const timeDiff = prevResult ? getTimeDifference(prevResult.testDate, result.testDate) : null;
                              
                              return (
                                <div key={result.id} className="relative pl-16">
                                  {/* Timeline dot */}
                                  <div className="absolute left-6 top-2">
                                    <div className="h-4 w-4 rounded-full bg-[#007BFF] border-4 border-white shadow-lg"></div>
                                  </div>
                                  
                                  <Card className="border-[#E5E7EB] hover:shadow-lg transition-all">
                                    <CardContent className="p-5">
                                      <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-3 mb-2">
                                            <Badge variant="outline" className="bg-[#007BFF]/10 text-[#007BFF] border-[#007BFF]">
                                              Lần {index + 1}
                                            </Badge>
                                            {timeDiff && (
                                              <Badge variant="outline" className="text-xs">
                                                <Calendar className="h-3 w-3 inline mr-1" />
                                                Cách {timeDiff}
                                              </Badge>
                                            )}
                                          </div>
                                          <p className="font-semibold text-gray-900 text-lg mb-1">
                                            {formatDate(result.testDate)}
                                          </p>
                                          {result.facility && (
                                            <p className="text-sm text-[#687280] flex items-center gap-1">
                                              <Building2 className="h-4 w-4" />
                                              {result.facility}
                                            </p>
                                          )}
                                          {result.doctor && (
                                            <p className="text-sm text-[#687280] flex items-center gap-1 mt-1">
                                              <User className="h-4 w-4" />
                                              {result.doctor}
                                            </p>
                                          )}
                                        </div>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleView(result)}
                                          className="ml-4"
                                        >
                                          <Eye className="h-4 w-4 mr-2" />
                                          Xem
                                        </Button>
                                      </div>
                                      
                                      {result.notes && (
                                        <p className="text-sm text-[#687280] mb-3 p-2 bg-gray-50 rounded border-l-2 border-[#007BFF]">
                                          {result.notes}
                                        </p>
                                      )}
                                      
                                      <div className="flex flex-wrap gap-2 mt-3">
                                        {result.files.map((file) => (
                                          <Badge 
                                            key={file.id} 
                                            variant="outline" 
                                            className="text-xs cursor-pointer hover:bg-[#007BFF]/10 transition-colors"
                                            onClick={() => {
                                              const link = document.createElement("a");
                                              link.href = file.url;
                                              link.download = file.name;
                                              link.click();
                                            }}
                                          >
                                            {file.type === "pdf" ? (
                                              <FileText className="h-3 w-3 inline mr-1 text-red-600" />
                                            ) : (
                                              <ImageIcon className="h-3 w-3 inline mr-1 text-blue-600" />
                                            )}
                                            {file.name}
                                            <Download className="h-3 w-3 inline ml-1" />
                                          </Badge>
                                        ))}
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="border-[#E5E7EB]">
                <CardContent className="p-12 text-center">
                  <TrendingUp className="h-16 w-16 text-[#687280] mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    So sánh kết quả xét nghiệm
                  </h3>
                  <p className="text-[#687280] mb-4">
                    Chọn một kết quả xét nghiệm và nhấn "So sánh" để xem lịch sử theo thời gian
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2 justify-center">
                    {testNames.slice(0, 5).map((name) => (
                      <Button
                        key={name}
                        variant="outline"
                        size="sm"
                        onClick={() => handleCompare(name)}
                      >
                        <TrendingUp className="h-4 w-4 mr-2" />
                        {name}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Upload Dialog */}
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upload kết quả xét nghiệm</DialogTitle>
              <DialogDescription>
                Tải lên file PDF hoặc ảnh kết quả xét nghiệm của bạn
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="testName">Tên xét nghiệm *</Label>
                <Input
                  id="testName"
                  value={formData.testName}
                  onChange={(e) => setFormData({ ...formData, testName: e.target.value })}
                  placeholder="Ví dụ: Xét nghiệm máu, Xét nghiệm nước tiểu..."
                  list="testNames"
                />
                <datalist id="testNames">
                  {testNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>

              <div>
                <Label htmlFor="testDate">Ngày xét nghiệm *</Label>
                <Input
                  id="testDate"
                  type="date"
                  value={formData.testDate}
                  onChange={(e) => setFormData({ ...formData, testDate: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="facility">Cơ sở xét nghiệm</Label>
                  <Input
                    id="facility"
                    value={formData.facility}
                    onChange={(e) => setFormData({ ...formData, facility: e.target.value })}
                    placeholder="Tên bệnh viện/phòng khám"
                  />
                </div>
                <div>
                  <Label htmlFor="doctor">Bác sĩ chỉ định</Label>
                  <Input
                    id="doctor"
                    value={formData.doctor}
                    onChange={(e) => setFormData({ ...formData, doctor: e.target.value })}
                    placeholder="Tên bác sĩ"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Ghi chú</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ghi chú thêm về kết quả xét nghiệm..."
                  rows={3}
                />
              </div>

              <div>
                <Label>File kết quả * (PDF hoặc ảnh, tối đa 10MB/file)</Label>
                <div className="mt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      isDragging
                        ? "border-[#007BFF] bg-blue-50"
                        : "border-[#E5E7EB] hover:border-[#007BFF]/50 bg-gray-50"
                    }`}
                  >
                    <Upload className={`h-12 w-12 mx-auto mb-4 ${isDragging ? "text-[#007BFF]" : "text-[#687280]"}`} />
                    <p className="text-sm text-gray-900 mb-2">
                      {isDragging ? "Thả file vào đây" : "Kéo thả file vào đây hoặc"}
                    </p>
                    <label htmlFor="file-upload">
                      <Button
                        type="button"
                        variant="outline"
                        className="bg-white hover:bg-gray-50"
                        asChild
                      >
                        <span className="cursor-pointer">
                          <Upload className="h-4 w-4 mr-2" />
                          Chọn file
                        </span>
                      </Button>
                    </label>
                    <p className="text-xs text-[#687280] mt-3">
                      Hỗ trợ PDF, JPG, PNG, WEBP (tối đa 10MB/file)
                    </p>
                  </div>
                </div>
                {uploadedFiles.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm font-medium text-gray-900">
                      Đã chọn {uploadedFiles.length} file:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {uploadedFiles.map((item, index) => (
                        <Card
                          key={index}
                          className="border-[#E5E7EB] hover:shadow-md transition-shadow"
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              {item.file.type === "application/pdf" ? (
                                <div className="flex-shrink-0">
                                  <FileText className="h-10 w-10 text-red-600" />
                                </div>
                              ) : (
                                <div className="flex-shrink-0">
                                  <img
                                    src={item.preview}
                                    alt={item.file.name}
                                    className="h-16 w-16 object-cover rounded border"
                                  />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {item.file.name}
                                  </p>
                                  {item.uploaded ? (
                                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-300">
                                      S3 ✓
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300">
                                      Đang upload...
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-[#687280] mb-2">
                                  {formatFileSize(item.file.size)}
                                </p>
                                {item.file.type !== "application/pdf" && item.preview && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-7"
                                    onClick={() => window.open(item.preview, "_blank")}
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    Xem ảnh
                                  </Button>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveFile(index)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsUploadDialogOpen(false);
                  setFormData({
                    testName: "",
                    testDate: new Date().toISOString().split("T")[0],
                    facility: "",
                    doctor: "",
                    notes: "",
                  });
                  setUploadedFiles([]);
                }}
              >
                Hủy
              </Button>
              <Button
                onClick={handleUpload}
                disabled={isSubmitting || isS3Uploading || uploadedFiles.some((f) => !f.uploaded)}
                className="bg-[#007BFF] hover:bg-[#0056B3]"
              >
                {isSubmitting
                  ? "Đang lưu..."
                  : isS3Uploading
                  ? "Đang upload lên S3..."
                  : uploadedFiles.some((f) => !f.uploaded)
                  ? "Đợi upload xong..."
                  : "Lưu"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {selectedResult && (
              <>
                <DialogHeader>
                  <DialogTitle>{selectedResult.testName}</DialogTitle>
                  <DialogDescription>
                    {formatDate(selectedResult.testDate)}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {selectedResult.facility && (
                      <div>
                        <p className="text-[#687280]">Cơ sở xét nghiệm</p>
                        <p className="font-medium text-gray-900">{selectedResult.facility}</p>
                      </div>
                    )}
                    {selectedResult.doctor && (
                      <div>
                        <p className="text-[#687280]">Bác sĩ chỉ định</p>
                        <p className="font-medium text-gray-900">{selectedResult.doctor}</p>
                      </div>
                    )}
                  </div>
                  {selectedResult.notes && (
                    <div>
                      <p className="text-sm text-[#687280] mb-1">Ghi chú</p>
                      <p className="text-sm text-gray-900">{selectedResult.notes}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-3">
                      File kết quả ({selectedResult.files.length})
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedResult.files.map((file) => (
                        <Card key={file.id} className="border-[#E5E7EB]">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {file.type === "pdf" ? (
                                  <FileText className="h-5 w-5 text-red-600" />
                                ) : (
                                  <ImageIcon className="h-5 w-5 text-blue-600" />
                                )}
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {file.name}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  // Tải về - nếu là S3 thì mở presigned URL
                                  const url = await getViewableUrl(file);
                                  const link = document.createElement("a");
                                  link.href = url;
                                  link.download = file.name;
                                  link.target = "_blank";
                                  link.click();
                                }}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                            <p className="text-xs text-[#687280] mb-2">
                              {formatFileSize(file.size)}
                            </p>
                            {file.type === "pdf" ? (
                              <iframe
                                src={file.url}
                                className="w-full h-64 border rounded"
                                title={file.name}
                                onError={async (e) => {
                                  const target = e.currentTarget;
                                  const fresh = await getViewableUrl(file);
                                  if (target.src !== fresh) target.src = fresh;
                                }}
                              />
                            ) : (
                              <img
                                src={file.url}
                                alt={file.name}
                                className="w-full h-auto rounded border cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => handleViewFile(file)}
                                onError={async (e) => {
                                  const target = e.currentTarget;
                                  const fresh = await getViewableUrl(file);
                                  if (target.src !== fresh) target.src = fresh;
                                }}
                              />
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                    Đóng
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
              <AlertDialogDescription>
                Bạn có chắc chắn muốn xóa kết quả xét nghiệm này? Hành động này không thể hoàn tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-red-600 hover:bg-red-700"
              >
                Xóa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PatientLayout>
  );
};

export default TestResults;

