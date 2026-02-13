import axios from 'axios';

// Base API URL - checks runtime config, environment variable, or defaults to localhost for development
// @ts-ignore - window.APP_CONFIG is set by config.js at runtime
const getApiBaseUrl = () => {
  // Check for runtime config (set by config.js in dist folder)
  if (typeof window !== 'undefined' && (window as any).APP_CONFIG?.API_BASE_URL) {
    return (window as any).APP_CONFIG.API_BASE_URL;
  }
  // Check for build-time environment variable
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  // Default to localhost for development
  return 'http://127.0.0.1:8000/api';
};

const API_BASE_URL = getApiBaseUrl();

// Simple in-memory cache for API responses
interface CacheEntry {
  data: any;
  timestamp: number;
}

const apiCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5000; // 5 seconds

// Helper to get cached data
const getCachedData = (key: string) => {
  const entry = apiCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  apiCache.delete(key);
  return null;
};

// Helper to set cached data
const setCachedData = (key: string, data: any) => {
  apiCache.set(key, { data, timestamp: Date.now() });
};

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // For FormData uploads, let axios set Content-Type automatically with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        const response = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
          refresh: refreshToken,
        });

        const { access } = response.data;
        localStorage.setItem('access_token', access);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh token failed, logout user
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Authentication APIs
export const authAPI = {
  login: (data: { cnic?: string; email?: string; password: string }) =>
    api.post('/auth/login/', data),

  register: (data: {
    cnic: string;
    email?: string;
    full_name: string;
    password: string;
    password_confirm: string;
    role: string;
    department?: number;
    program?: number;
  }) => api.post('/auth/register/', data),

  logout: (refresh: string) =>
    api.post('/auth/logout/', { refresh }),

  getCurrentUser: () => api.get('/auth/me/'),

  changePassword: (data: {
    old_password: string;
    new_password: string;
    confirm_password: string;
  }) => api.post('/auth/change-password/', data),

  updateProfile: (data: {
    full_name?: string;
    email?: string;
    cnic?: string;
  }) => api.put('/auth/update-profile/', data),

  uploadProfilePicture: (profile_picture: string) =>
    api.post('/auth/upload-profile-picture/', { profile_picture }),
};

// Terms APIs
export const termsAPI = {
  getAll: (params?: { is_active?: boolean }) =>
    api.get('/terms/', { params }),

  getById: (id: number) => api.get(`/terms/${id}/`),

  create: (data: {
    session_term: string;
    start_date: string;
    end_date: string;
    is_active?: boolean;
  }) => api.post('/terms/', data),

  update: (id: number, data: any) =>
    api.put(`/terms/${id}/`, data),

  partialUpdate: (id: number, data: any) =>
    api.patch(`/terms/${id}/`, data),

  delete: (id: number) => api.delete(`/terms/${id}/`),

  // Activate a specific term (deactivates all others)
  activate: (id: number) =>
    api.post(`/terms/${id}/activate/`),

  // Manually trigger deactivation of expired terms (admin only)
  deactivateExpired: () =>
    api.post('/terms/deactivate_expired/'),
};

// Departments APIs
export const departmentsAPI = {
  getAll: (params?: { search?: string }) =>
    api.get('/departments/', { params }),

  getById: (id: number) => api.get(`/departments/${id}/`),

  create: (data: {
    name: string;
    short_code: string;
    description?: string;
  }) => api.post('/departments/', data),

  update: (id: number, data: any) =>
    api.put(`/departments/${id}/`, data),

  partialUpdate: (id: number, data: any) =>
    api.patch(`/departments/${id}/`, data),

  delete: (id: number) => api.delete(`/departments/${id}/`),
};

// Programs APIs
export const programsAPI = {
  getAll: (params?: { department?: number }) =>
    api.get('/programs/', { params }),

  getById: (id: number) => api.get(`/programs/${id}/`),

  create: (data: {
    title: string;
    short_code: string;
    department: number;
    description?: string;
  }) => api.post('/programs/', data),

  update: (id: number, data: any) =>
    api.put(`/programs/${id}/`, data),

  partialUpdate: (id: number, data: any) =>
    api.patch(`/programs/${id}/`, data),

  delete: (id: number) => api.delete(`/programs/${id}/`),
};

// Faculty APIs
export const facultyAPI = {
  getAll: (params?: {
    department?: number;
    program?: number;
    is_active?: boolean;
  }) => api.get('/faculty/', { params }),

  getById: (id: number) => api.get(`/faculty/${id}/`),

  // Get logged-in faculty member's profile
  getMyProfile: () => api.get('/faculty/my-profile/'),

  // Update logged-in faculty member's profile
  updateMyProfile: (data: any) => api.patch('/faculty/update-profile/', data),

  create: (data: {
    email: string;
    full_name: string;
    password: string;
    cnic?: string;
    department: number;
    program?: number;
    designation: string;
    phone?: string;
    address?: string;
    date_of_joining?: string;
    qualification?: string;
    specialization?: string;
    coordinator_course_ids?: number[];
  }) => api.post('/faculty/', data),

  update: (id: number, data: any) =>
    api.put(`/faculty/${id}/`, data),

  partialUpdate: (id: number, data: any) =>
    api.patch(`/faculty/${id}/`, data),

  delete: (id: number) => api.delete(`/faculty/${id}/`),
};

// Courses APIs
export const coursesAPI = {
  getAll: (params?: {
    department?: number;
    program?: number;
    course_type?: string;
    is_active?: boolean;
    search?: string;
  }) => api.get('/courses/', { params }),

  getById: (id: number) => api.get(`/courses/${id}/`),

  uploadExcel: (formData: FormData) =>
    api.post('/courses/upload-excel/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  create: (data: {
    code: string;
    title: string;
    credit_hours: number;
    course_type: string;
    department: number;
    program?: number;
    description?: string;
    pre_requisites?: string;
    is_active?: boolean;
  }) => api.post('/courses/', data),

  update: (id: number, data: any) =>
    api.put(`/courses/${id}/`, data),

  partialUpdate: (id: number, data: any) =>
    api.patch(`/courses/${id}/`, data),

  delete: (id: number) => api.delete(`/courses/${id}/`),
};

// Course Allocations APIs
export const courseAllocationsAPI = {
  getAll: (params?: {
    course?: number;
    faculty?: number;
    department?: number;
    program?: number;
    term?: number;
    section?: string;
    is_active?: boolean;
  }) => api.get('/courses/allocations/', { params }),

  getById: (id: number) => api.get(`/courses/allocations/${id}/`),

  // Get courses allocated to the logged-in faculty member
  getMyCourses: () => api.get('/courses/allocations/my-courses/'),

  uploadExcel: (formData: FormData) =>
    api.post('/courses/allocations/upload-excel/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  create: (data: {
    course: number;
    faculty: number;
    section: string;
    department: number;
    program?: number | null;
    term?: number | null;
    is_active?: boolean;
    is_coordinator?: boolean;
  }) => api.post('/courses/allocations/', data),

  update: (id: number, data: any) =>
    api.put(`/courses/allocations/${id}/`, data),

  partialUpdate: (id: number, data: any) =>
    api.patch(`/courses/allocations/${id}/`, data),

  delete: (id: number) => api.delete(`/courses/allocations/${id}/`),

  getCoordinatorAssignments: (params?: {
    coordinator?: number;
    course?: number;
    department?: number;
    program?: number;
    term?: number;
    is_active?: boolean;
  }) => api.get('/courses/allocations/coordinator-assignments/', { params }),
  
  // Coordinator Assignment CRUD operations
  getCoordinatorAssignmentById: (id: number) => api.get(`/courses/coordinator-assignments/${id}/`),
  updateCoordinatorAssignment: (id: number, data: any) => api.put(`/courses/coordinator-assignments/${id}/`, data),
  partialUpdateCoordinatorAssignment: (id: number, data: any) => api.patch(`/courses/coordinator-assignments/${id}/`, data),
  deleteCoordinatorAssignment: (id: number) => api.delete(`/courses/coordinator-assignments/${id}/`),
};

// Course Folders APIs
export const courseFoldersAPI = {
  getAll: (params?: {
    status?: string;
    department?: number;
    program?: number;
    term?: number;
    faculty?: number;
    // Added filters supported by backend for faster lookups/scoping
    course_allocation?: number;
    assigned_to_me?: number | boolean;
    // Convener-only optional scoping flag to view all departments
    scope_all?: number | boolean;
  }) => api.get('/course-folders/folders/', { params }),

  getById: (id: number) => api.get(`/course-folders/folders/${id}/`),

  // Get current faculty member's folders
  getMyFolders: (params?: { status?: string; term?: number; course_allocation?: number }) =>
    api.get('/course-folders/folders/my_folders/', { params }),

  // Get basic folder info (ultra fast, no nested serializers) - for Title Page and Course Outline
  // Caching disabled to ensure fresh data for course code, title, instructor name, and outline content
  getBasic: async (id: number) => {
    // Add cache-busting timestamp to prevent browser caching (query param only, no headers to avoid CORS issues)
    const timestamp = new Date().getTime();
    return api.get(`/course-folders/folders/${id}/basic/`, {
      params: { _t: timestamp }
    });
  },

  // Save course outline content
  saveOutline: (id: number, data: { outline_content: any; section?: string }) => {
    // Clear cache when saving
    apiCache.delete(`folder_basic_${id}`);
    return api.patch(`/course-folders/folders/${id}/save-outline/`, data);
  },

  // Get faculty's course allocations for folder creation
  getMyCourseAllocations: () =>
    api.get('/course-folders/folders/my_course_allocations/'),

  create: (data: {
    course: number;
    course_allocation: number;
    faculty: number;
    term: number;
    department: number;
    program?: number;
    academic_year: string;
  }) => api.post('/course-folders/folders/', data),

  update: (id: number, data: any) => {
    apiCache.delete(`folder_basic_${id}`);
    return api.put(`/course-folders/folders/${id}/`, data);
  },

  partialUpdate: (id: number, data: any) => {
    apiCache.delete(`folder_basic_${id}`);
    return api.patch(`/course-folders/folders/${id}/`, data);
  },

  delete: (id: number) => {
    apiCache.delete(`folder_basic_${id}`);
    return api.delete(`/course-folders/folders/${id}/`);
  },

  // Submit folder for review
  submit: (id: number, data?: { skip_validation?: number }) => {
    apiCache.delete(`folder_basic_${id}`);
    return api.post(`/course-folders/folders/${id}/submit/`, data);
  },

  // Check folder completeness
  checkCompleteness: (id: number) =>
    api.get(`/course-folders/folders/${id}/check_completeness/`),

  // Coordinator review (approve/reject)
  coordinatorReview: (id: number, data: { action: 'approve' | 'reject'; notes: string }) =>
    api.post(`/course-folders/folders/${id}/coordinator_review/`, data),
  // Coordinator per-section feedback
  saveCoordinatorFeedback: (id: number, data: { section: string; notes: string }) => {
    apiCache.delete(`folder_basic_${id}`);
    return api.post(`/course-folders/folders/${id}/coordinator_feedback/`, data);
  },

  // Audit member per-section feedback
  saveAuditMemberFeedback: (id: number, data: { section: string; notes: string }) => {
    apiCache.delete(`folder_basic_${id}`);
    return api.post(`/course-folders/folders/${id}/audit_member_feedback/`, data);
  },

  // Convener assigns audit team
  assignAudit: (id: number, data: { auditor_ids: number[] }) =>
    api.post(`/course-folders/folders/${id}/assign_audit/`, data),

  // Convener unassigns audit team
  unassignAudit: (id: number) =>
    api.post(`/course-folders/folders/${id}/unassign_audit/`),

  // Audit team submits report
  submitAuditReport: (id: number, formData: FormData) => {
    apiCache.delete(`folder_basic_${id}`);
    return api.post(`/course-folders/folders/${id}/submit_audit_report/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Convener reviews audit and forwards to HOD or rejects
  convenerReview: (id: number, data: { action: 'forward_to_hod' | 'reject'; notes: string }) =>
    api.post(`/course-folders/folders/${id}/convener_review/`, data),

  // HOD final decision
  hodFinalDecision: (id: number, data: { decision: 'approve' | 'reject'; notes: string; final_feedback?: string }) =>
    api.post(`/course-folders/folders/${id}/hod_final_decision/`, data),

  // Audit report viewer (Convener/HOD)
  getAuditReports: (id: number) =>
    api.get(`/course-folders/folders/${id}/audit_reports/`),

  // Generate consolidated audit PDF on server (Convener/HOD)
  generateConsolidatedPdf: (id: number) =>
    api.post(`/course-folders/folders/${id}/generate_consolidated_pdf/`),

  // Generate complete folder report (merges all PDFs: templates + uploads)
  generateFolderReport: (id: number) =>
    api.post(`/course-folders/folders/${id}/generate_folder_report/`),

  // Auditor's own submitted reports
  getMyAuditReports: (params?: { submitted?: 0 | 1; decision?: string; status?: string }) =>
    api.get('/course-folders/folders/my_audit_reports/', { params }),

  // Diagnostic helpers (convener)
  getStatusCounts: (params?: { scope_all?: 0 | 1 }) =>
    api.get('/course-folders/folders/status_counts/', { params }),
  getAuditQueue: (params?: { scope_all?: 0 | 1 }) =>
    api.get('/course-folders/folders/audit_queue/', { params }),

  // Coordinator decision (approve/disapprove) with final remarks
  updateDecision: (id: number, data: {
    coordinator_decision: 'APPROVED' | 'DISAPPROVED';
    coordinator_remarks: string;
    status: string;
  }) =>
    api.patch(`/course-folders/folders/${id}/`, data),

  // Project Report File Upload/Download
  uploadProjectReport: (id: number, formData: FormData) =>
    api.post(`/course-folders/folders/${id}/upload-project-report/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // Optional: upload a single PDF for the whole folder and validate checklist
  uploadFolderPdf: (id: number, formData: FormData) =>
    api.post(`/course-folders/folders/${id}/upload-folder-pdf/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  downloadProjectReport: (id: number) =>
    api.get(`/course-folders/folders/${id}/download-project-report/`, {
      responseType: 'blob',
    }),

  deleteProjectReport: (id: number) =>
    api.delete(`/course-folders/folders/${id}/delete-project-report/`),

  // Course Result File Upload/Download
  uploadCourseResult: (id: number, formData: FormData) =>
    api.post(`/course-folders/folders/${id}/upload-course-result/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  downloadCourseResult: (id: number) =>
    api.get(`/course-folders/folders/${id}/download-course-result/`, {
      responseType: 'blob',
    }),

  deleteCourseResult: (id: number) =>
    api.delete(`/course-folders/folders/${id}/delete-course-result/`),

  // CLO Assessment File Upload/Download
  uploadCloAssessment: (id: number, formData: FormData) =>
    api.post(`/course-folders/folders/${id}/upload-clo-assessment/`, formData, {
      // Don't set Content-Type manually - axios will set it with correct boundary
      timeout: 60000, // 60 seconds timeout for file uploads
    }),

  downloadCloAssessment: (id: number) =>
    api.get(`/course-folders/folders/${id}/download-clo-assessment/`, {
      responseType: 'blob',
    }),

  deleteCloAssessment: (id: number) =>
    api.delete(`/course-folders/folders/${id}/delete-clo-assessment/`),

  // Folder Review Report File Upload/Download
  uploadFolderReviewReport: (id: number, formData: FormData) =>
    api.post(`/course-folders/folders/${id}/upload-folder-review-report/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  downloadFolderReviewReport: (id: number) =>
    api.get(`/course-folders/folders/${id}/download-folder-review-report/`, {
      responseType: 'blob',
    }),

  deleteFolderReviewReport: (id: number) =>
    api.delete(`/course-folders/folders/${id}/delete-folder-review-report/`),

  // Admin: Get approved folders by term
  getApprovedByTerm: (params?: {
    term?: number;
    department?: number;
    program?: number;
    course?: number;
    faculty?: number;
  }) =>
    api.get('/course-folders/folders/approved-by-term/', { params }),

  // Admin: Share folder with convener or HOD
  shareWithRole: (id: number, data: { role: 'CONVENER' | 'HOD' }) =>
    api.post(`/course-folders/folders/${id}/share-with-role/`, data),

  // Folder Access Requests (CONVENER/HOD)
  requestAccess: (id: number) =>
    api.post(`/course-folders/folders/${id}/request-access/`),
  
  getMyAccessRequests: () =>
    api.get('/course-folders/folders/my-access-requests/'),
  
  // Admin: Folder Access Requests
  getFolderAccessRequests: (status?: string) =>
    api.get('/course-folders/folders/folder-access-requests/', { params: status ? { status } : {} }),
  
  approveAccessRequest: (folderId: number, data: { request_id: number; action: 'approve' | 'reject'; notes?: string }) =>
    api.post(`/course-folders/folders/${folderId}/approve-access-request/`, data),
};

// Folder Deadlines APIs
export const folderDeadlinesAPI = {
  getAll: (params?: {
    term?: number;
    department?: number;
    deadline_type?: 'FIRST_SUBMISSION' | 'FINAL_SUBMISSION';
  }) => api.get('/course-folders/deadlines/', { params }),

  getById: (id: number) => api.get(`/course-folders/deadlines/${id}/`),

  create: (data: {
    deadline_type: 'FIRST_SUBMISSION' | 'FINAL_SUBMISSION';
    term: number;
    department?: number;
    deadline_date: string; // ISO datetime string
    notes?: string;
  }) => api.post('/course-folders/deadlines/', data),

  update: (id: number, data: {
    deadline_type?: 'FIRST_SUBMISSION' | 'FINAL_SUBMISSION';
    term?: number;
    department?: number;
    deadline_date?: string;
    notes?: string;
  }) => api.put(`/course-folders/deadlines/${id}/`, data),

  partialUpdate: (id: number, data: {
    deadline_type?: 'FIRST_SUBMISSION' | 'FINAL_SUBMISSION';
    term?: number;
    department?: number;
    deadline_date?: string;
    notes?: string;
  }) => api.patch(`/course-folders/deadlines/${id}/`, data),

  delete: (id: number) => api.delete(`/course-folders/deadlines/${id}/`),

  // Get current deadlines for a specific folder
  getCurrentForFolder: (folderId: number) =>
    api.get('/course-folders/deadlines/current-for-folder/', { params: { folder_id: folderId } }),
};

// Folder Components APIs
export const folderComponentsAPI = {
  getAll: (params: { folder: number }) =>
    api.get('/course-folders/components/', { params }),

  getById: (id: number) => api.get(`/course-folders/components/${id}/`),

  create: (data: FormData) =>
    api.post('/course-folders/components/', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  update: (id: number, data: FormData) =>
    api.put(`/course-folders/components/${id}/`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  delete: (id: number) => api.delete(`/course-folders/components/${id}/`),
};

// Assessments APIs
export const assessmentsAPI = {
  getAll: (params: { folder: number }) =>
    api.get('/course-folders/assessments/', { params }),

  getById: (id: number) => api.get(`/course-folders/assessments/${id}/`),

  create: (data: FormData) =>
    api.post('/course-folders/assessments/', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  update: (id: number, data: FormData) =>
    api.put(`/course-folders/assessments/${id}/`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  partialUpdate: (id: number, data: FormData) =>
    api.patch(`/course-folders/assessments/${id}/`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  delete: (id: number) => api.delete(`/course-folders/assessments/${id}/`),
};

// Course Log Entries APIs
export const courseLogsAPI = {
  getAll: (params: { folder: number }) =>
    api.get('/course-folders/logs/', { params }),

  getById: (id: number) => api.get(`/course-folders/logs/${id}/`),

  create: (data: {
    folder: number;
    lecture_number: number;
    date: string;
    duration: number;
    topics_covered: string;
    evaluation_instrument?: string;
  }) => api.post('/course-folders/logs/', data),

  update: (id: number, data: any) =>
    api.put(`/course-folders/logs/${id}/`, data),

  partialUpdate: (id: number, data: any) =>
    api.patch(`/course-folders/logs/${id}/`, data),

  uploadAttendance: (id: number, data: FormData) =>
    api.post(`/course-folders/logs/${id}/upload-attendance/`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  delete: (id: number) => api.delete(`/course-folders/logs/${id}/`),
};

// Notifications APIs
export const notificationsAPI = {
  getAll: () => api.get('/course-folders/notifications/'),

  getById: (id: number) => api.get(`/course-folders/notifications/${id}/`),

  // Mark notification as read
  acknowledge: (id: number) =>
    api.post(`/course-folders/notifications/${id}/acknowledge/`),

  // Mark all notifications as read
  markAllRead: () =>
    api.post('/course-folders/notifications/mark_all_read/'),

  delete: (id: number) => api.delete(`/course-folders/notifications/${id}/`),
};

export default api;

// Users (generic) APIs - for admin/convener user management
export const usersAPI = {
  getAll: (params?: { role?: string; search?: string; department?: number }) =>
    api.get('/auth/users/', { params }),
  getById: (id: number) => api.get(`/auth/users/${id}/`),
  update: (id: number, data: any) => api.put(`/auth/users/${id}/`, data),
  partialUpdate: (id: number, data: any) => api.patch(`/auth/users/${id}/`, data),
  delete: (id: number) => api.delete(`/auth/users/${id}/`),
};

// Role Assignment Requests (Admin -> HOD) APIs
export const roleRequestsAPI = {
  getAll: (params?: { status?: string }) => api.get('/auth/role-requests/', { params }),
  getById: (id: number) => api.get(`/auth/role-requests/${id}/`),
  create: (data: { target_user: number; role: string; department?: number; program?: number; coordinator_course_ids?: number[] }) =>
    api.post('/auth/role-requests/', data),
  approve: (id: number) => api.post(`/auth/role-requests/${id}/approve/`),
  reject: (id: number, data?: { decision_reason?: string }) => api.post(`/auth/role-requests/${id}/reject/`, data || {}),
  // Delete a role request (admins may want to cancel a request) - backend allows delete on requests
  delete: (id: number) => api.delete(`/auth/role-requests/${id}/`),
};

