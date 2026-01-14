import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { courseFoldersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FolderPlus, Eye, BookOpen, Calendar, Users } from 'lucide-react';

interface CourseAllocation {
  allocation_id: number;
  course_code: string;
  course_title: string;
  section: string;
  term: string;
  term_id: number | null;
  department: string;
  department_id: number | null;
  program: string;
  program_id: number | null;
  course_id: number | null;
  folder_exists: boolean;
  folder: {
    id: number;
    status: string;
    first_activity_completed?: boolean;
  } | null;
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SUBMITTED: 'bg-yellow-100 text-yellow-800',
  APPROVED_COORDINATOR: 'bg-blue-100 text-blue-800',
  REJECTED_COORDINATOR: 'bg-red-100 text-red-800',
  ASSIGNED_TO_CONVENER: 'bg-teal-100 text-teal-800',
  UNDER_AUDIT: 'bg-purple-100 text-purple-800',
  AUDIT_COMPLETED: 'bg-indigo-100 text-indigo-800',
  REJECTED_BY_CONVENER: 'bg-rose-100 text-rose-700',
  SUBMITTED_TO_HOD: 'bg-orange-100 text-orange-800',
  APPROVED_BY_HOD: 'bg-green-100 text-green-800',
  REJECTED_BY_HOD: 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted to Coordinator',
  APPROVED_COORDINATOR: 'Approved by Coordinator',
  REJECTED_COORDINATOR: 'Returned by Coordinator',
  ASSIGNED_TO_CONVENER: 'Assigned to Convener',
  UNDER_AUDIT: 'Under Audit Review',
  AUDIT_COMPLETED: 'Audit Completed',
  REJECTED_BY_CONVENER: 'Returned by Convener',
  SUBMITTED_TO_HOD: 'Submitted to HOD',
  APPROVED_BY_HOD: 'Approved by HOD',
  REJECTED_BY_HOD: 'Returned by HOD',
};

export const CreateCourseFolder: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [allocations, setAllocations] = useState<CourseAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingAllocationId, setUploadingAllocationId] = useState<number | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadValidation, setUploadValidation] = useState<any | null>(null);

  useEffect(() => {
    fetchCourseAllocations();
  }, []);

  const fetchCourseAllocations = async () => {
    try {
      setLoading(true);
      const response = await courseFoldersAPI.getMyCourseAllocations();
      const allocationsData = Array.isArray(response.data)
        ? response.data
        : (response.data.results || []);

      const normalizedAllocations = allocationsData.map((alloc: any) => ({
        allocation_id: alloc.allocation_id,
        course_code: alloc.course_code || 'N/A',
        course_title: alloc.course_title || 'N/A',
        section: alloc.section || 'N/A',
        term: alloc.term || 'Current Term',
        term_id: alloc.term_id ?? null,
        department: alloc.department || 'N/A',
        department_id: alloc.department_id ?? null,
        program: alloc.program || 'N/A',
        program_id: alloc.program_id ?? null,
        course_id: alloc.course_id ?? null,
        folder_exists: Boolean(alloc.folder_exists),
        folder: alloc.folder ? {
          id: alloc.folder.id,
          status: alloc.folder.status,
          first_activity_completed: alloc.folder.first_activity_completed || false
        } : null,
      }));

      setAllocations(normalizedAllocations);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching course allocations:', err);
      setError(err.response?.data?.error || 'Failed to load course allocations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrResumeFolder = (allocation: CourseAllocation) => {
    const base = user?.role === 'COORDINATOR' ? '/coordinator' : user?.role === 'CONVENER' ? '/convener' : '/faculty';
    if (allocation.folder_exists && allocation.folder?.id) {
      // Go to the folder title page flow (sidebar-based folder pages)
      navigate(`${base}/folder/${allocation.folder.id}/title-page`);
      return;
    }

    // Create flow starts by creating a folder in backend (handled in FolderCreationWizard),
    // but UX request: go directly to Title Page once folder exists.
    // So we route to the wizard create route; it will create the folder and then user will continue.
    navigate(`${base}/folders/create/${allocation.allocation_id}`, { state: { allocation } });
  };

  const handleViewFolder = (folderId: number) => {
    const base = user?.role === 'COORDINATOR' ? '/coordinator' : user?.role === 'CONVENER' ? '/convener' : '/faculty';
    navigate(`${base}/folders/${folderId}`);
  };

  const createFolderForAllocation = async (allocation: CourseAllocation): Promise<number> => {
    const currentYear = new Date().getFullYear();
    const response = await courseFoldersAPI.create({
      course: allocation.course_id ?? 0,
      course_allocation: allocation.allocation_id,
      faculty: user?.id ?? 0,
      term: allocation.term_id ?? 0,
      department: allocation.department_id ?? 0,
      program: allocation.program_id || undefined,
      academic_year: `${currentYear}-${currentYear + 1}`,
    });
    return response.data.id as number;
  };

  const handleCreateFolderClick = async (allocation: CourseAllocation) => {
    try {
      setError(null);
      // If folder already exists, go directly to title page
      if (allocation.folder_exists && allocation.folder?.id) {
        navigate(`/faculty/folder/${allocation.folder.id}/title-page`);
        return;
      }

      // Otherwise create it now, then go to title page
      const id = await createFolderForAllocation(allocation);
      await fetchCourseAllocations();
      navigate(`/faculty/folder/${id}/title-page`);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create folder');
    }
  };

  const handleUploadPdfClick = (allocation: CourseAllocation) => {
    setUploadMessage(null);
    setUploadValidation(null);
    setUploadingAllocationId(allocation.allocation_id);
    const input = document.getElementById('allocation-folder-pdf-input') as HTMLInputElement | null;
    if (input) {
      input.value = '';
      input.click();
    }
  };

  const handlePdfSelected = async (file: File | null) => {
    if (!file) {
      setUploadingAllocationId(null);
      return;
    }
    const allocation = allocations.find((a) => a.allocation_id === uploadingAllocationId) || null;
    if (!allocation) {
      setUploadMessage('Invalid course selection.');
      setUploadingAllocationId(null);
      return;
    }
    try {
      setUploadMessage('Uploading PDF and validating…');
      setUploadValidation(null);

      let folderId = allocation.folder?.id ?? null;
      if (!folderId) {
        folderId = await createFolderForAllocation(allocation);
      }

      const form = new FormData();
      form.append('file', file);
      const res = await courseFoldersAPI.uploadFolderPdf(folderId, form);
      setUploadValidation(res.data?.validation || null);
      setUploadMessage('Uploaded. Validation completed.');

      await fetchCourseAllocations();
    } catch (err: any) {
      setUploadValidation(null);
      setUploadMessage(err?.response?.data?.error || 'Failed to upload/validate PDF.');
    } finally {
      setUploadingAllocationId(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout
        title="Create Course Folder"
        userRole={user?.role === 'COORDINATOR' ? 'coordinator' : 'faculty'}
        userName={user?.full_name || (user?.role === 'COORDINATOR' ? 'Coordinator' : 'Faculty')}
        userAvatar={user?.profile_picture || undefined}
      >
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout
        title="Create Course Folder"
        userRole={user?.role === 'COORDINATOR' ? 'coordinator' : 'faculty'}
        userName={user?.full_name || (user?.role === 'COORDINATOR' ? 'Coordinator' : 'Faculty')}
        userAvatar={user?.profile_picture || undefined}
      >
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">{error}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Create Course Folder"
      userRole={user?.role === 'COORDINATOR' ? 'coordinator' : 'faculty'}
      userName={user?.full_name || (user?.role === 'COORDINATOR' ? 'Coordinator' : 'Faculty')}
      userAvatar={user?.profile_picture || undefined}
    >
      <input
        id="allocation-folder-pdf-input"
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => handlePdfSelected(e.target.files?.[0] || null)}
      />
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            My Course Allocations
          </h2>
          <p className="text-gray-600">
            Select a course to create or view its folder
          </p>
        </div>

        {uploadMessage && (
          <div className="bg-white rounded-lg shadow-sm p-4 border border-slate-100">
            <p className="text-sm text-slate-800">{uploadMessage}</p>
            {uploadValidation && (
              <div className="mt-3 text-sm bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="flex flex-wrap gap-3">
                  <span className="font-medium">Type: {uploadValidation.course_type || 'THEORY'}</span>
                  <span className={uploadValidation.missing?.length ? 'text-red-700' : 'text-green-700'}>
                    Missing: {Array.isArray(uploadValidation.missing) ? uploadValidation.missing.length : 0}
                  </span>
                  <span className={uploadValidation.order_ok ? 'text-green-700' : 'text-amber-700'}>
                    Order: {uploadValidation.order_ok ? 'OK' : 'Issues'}
                  </span>
                </div>
                {Array.isArray(uploadValidation.missing) && uploadValidation.missing.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-red-800">
                    {uploadValidation.missing.map((m: string) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* Course Cards */}
        {allocations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No Course Allocations
            </h3>
            <p className="text-gray-500">
              You don't have any course allocations yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allocations.map((allocation) => (
              <div
                key={allocation.allocation_id}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden border border-gray-100"
              >
                {/* Card Header - Professional Slate Gradient */}
                <div className="bg-gradient-to-r from-slate-700 to-slate-600 p-4 text-white">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold mb-1">
                        {allocation.course_code}
                      </h3>
                      <p className="text-slate-200 text-sm line-clamp-2">
                        {allocation.course_title}
                      </p>
                    </div>
                    {allocation.folder_exists && allocation.folder && (
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${statusColors[allocation.folder.status] || 'bg-gray-100 text-gray-800'
                            }`}
                        >
                          {statusLabels[allocation.folder.status] || allocation.folder.status}
                        </span>
                        {allocation.folder.status === 'APPROVED_BY_HOD' && allocation.folder.first_activity_completed && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
                            Ready for Final Submission
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  {/* Course Details */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-gray-600">
                      <Users className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="font-medium">Section:</span>
                      <span className="ml-2">{allocation.section}</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Calendar className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="font-medium">Term:</span>
                      <span className="ml-2">{allocation.term}</span>
                    </div>
                    <div className="flex items-start text-gray-600">
                      <BookOpen className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium">Department:</span>
                        <span className="ml-2 block text-xs text-gray-500">
                          {allocation.department}
                        </span>
                      </div>
                    </div>
                    {allocation.program !== 'N/A' && (
                      <div className="text-gray-600 text-xs">
                        <span className="font-medium">Program:</span>
                        <span className="ml-2">{allocation.program}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons (Simple: Create + Upload PDF) */}
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => handleCreateFolderClick(allocation)}
                        className="flex-1 bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-800 hover:to-slate-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow-md"
                      >
                        <FolderPlus className="w-4 h-4 mr-2" />
                        Create Folder
                      </button>

                      <button
                        onClick={() => handleUploadPdfClick(allocation)}
                        disabled={uploadingAllocationId === allocation.allocation_id}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center disabled:bg-gray-400"
                        title="Upload a single PDF folder (system validates required sections)"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        {uploadingAllocationId === allocation.allocation_id ? 'Uploading…' : 'Upload PDF'}
                      </button>
                    </div>

                    {allocation.folder_exists && allocation.folder?.id && (
                      <button
                        onClick={() => handleViewFolder(allocation.folder!.id)}
                        className="mt-3 w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Folder
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CreateCourseFolder;
