import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { courseFoldersAPI } from '../services/api';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useReviewMode } from '../hooks/useReviewMode';
import CoordinatorFeedbackBox from '../components/common/CoordinatorFeedbackBox';
import AuditMemberFeedbackBox from '../components/common/AuditMemberFeedbackBox';
import { canEditFolder } from '../utils/folderPermissions';

interface FolderDetail {
  id: number;
  section: string;
  status?: string;
  course_title?: string;
  course_code?: string;
  outline_content?: OutlineContent;
}

interface Assignment {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

interface OutlineContent {
  assignments?: Assignment[];
}

const FolderAssignments: React.FC = () => {
  const params = useParams<{ id?: string; folderId?: string }>();
  const folderId = params.folderId ?? params.id;
  const navigate = useNavigate();
  const [data, setData] = useState<FolderDetail | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const { isCoordinatorReview, isAuditMemberReview, isConvenerReview, isHodReview, basePath } = useReviewMode();
  const [searchParams] = useSearchParams();
  const isReviewContext = isCoordinatorReview && searchParams.get('review') === '1';
  const submittedStatuses = new Set<string>(['SUBMITTED', 'UNDER_REVIEW_BY_COORDINATOR', 'APPROVED_COORDINATOR', 'UNDER_AUDIT', 'AUDIT_COMPLETED', 'SUBMITTED_TO_HOD', 'UNDER_REVIEW_BY_HOD', 'APPROVED_BY_HOD', 'COMPLETED']);
  const [status, setStatus] = useState<string | undefined>(undefined);

  const id = Number(folderId);
  const idForNav = isNaN(id) ? (data?.id ?? id) : id;

  useEffect(() => {
    let mounted = true;
    if (!id) return;
    courseFoldersAPI.getBasic(id)
      .then((res) => {
        if (!mounted) return;
        setData(res.data);
        const s = (res.data?.status || '').toUpperCase();
        setStatus(s);
        const firstActivityCompleted = res.data?.first_activity_completed || false;
        const canEditForFinalSubmission = res.data?.can_edit_for_final_submission || false;
        // Use utility function to determine if folder can be edited
        const canEdit = canEditFolder(s, firstActivityCompleted, canEditForFinalSubmission, isAuditMemberReview, isConvenerReview, isHodReview);
        setReadOnly(!canEdit);
        if (res.data.outline_content?.assignments) {
          setAssignments(res.data.outline_content.assignments);
        }
      })
      .catch(() => {
        if (mounted) setData(null);
      });
    return () => { mounted = false; };
  }, [id]);

  const courseTitle = data?.course_title || '—';

  const handleOpenModal = (assignment?: Assignment) => {
    if (readOnly) return;
    if (assignment) {
      setEditingId(assignment.id);
      setFormData({ name: assignment.name, description: assignment.description });
    } else {
      setEditingId(null);
      setFormData({ name: '', description: '' });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({ name: '', description: '' });
  };

  const handleSaveAssignment = async () => {
    if (!formData.name.trim()) {
      alert('Please enter assignment name');
      return;
    }

    setSaving(true);
    try {
      let updatedAssignments: Assignment[];

      if (editingId) {
        // Update existing
        updatedAssignments = assignments.map(a =>
          a.id === editingId
            ? { ...a, name: formData.name, description: formData.description }
            : a
        );
      } else {
        // Create new
        const newAssignment: Assignment = {
          id: Date.now().toString(),
          name: formData.name,
          description: formData.description,
          createdAt: new Date().toISOString()
        };
        updatedAssignments = [...assignments, newAssignment];
      }

      const existingContent = data?.outline_content || {};
      await courseFoldersAPI.saveOutline(id, {
        outline_content: { ...existingContent, assignments: updatedAssignments }
      });

      setAssignments(updatedAssignments);
      handleCloseModal();

      // Trigger sidebar refresh
      window.dispatchEvent(new CustomEvent('assignmentsUpdated', {
        detail: { folderId: id }
      }));

      alert(`Assignment ${editingId ? 'updated' : 'created'} successfully!`);
    } catch (error) {
      console.error('Error saving assignment:', error);
      alert('Failed to save assignment');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (readOnly) return;
    if (!confirm('Are you sure you want to delete this assignment?')) return;

    setSaving(true);
    try {
      const updatedAssignments = assignments.filter(a => a.id !== assignmentId);
      const existingContent = data?.outline_content || {};
      await courseFoldersAPI.saveOutline(id, {
        outline_content: { ...existingContent, assignments: updatedAssignments }
      });

      setAssignments(updatedAssignments);

      // Trigger sidebar refresh
      window.dispatchEvent(new CustomEvent('assignmentsUpdated', {
        detail: { folderId: id }
      }));

      alert('Assignment deleted successfully!');
    } catch (error) {
      console.error('Error deleting assignment:', error);
      alert('Failed to delete assignment');
    } finally {
      setSaving(false);
    }
  };

  const handleViewAssignment = (assignmentId: string) => {
    navigate(`${basePath}/folder/${idForNav}/assignments/${assignmentId}/question-paper${isReviewContext ? '?review=1' : ''}`);
  };

  const userRole = isCoordinatorReview ? 'coordinator' : isHodReview ? 'hod' : isAuditMemberReview ? 'audit' : isConvenerReview ? 'convener' : 'faculty';

  return (
    <DashboardLayout userRole={userRole}>
      <div className="p-4 md:p-6">
        <div className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-medium mb-4">
          {courseTitle}
        </div>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-base md:text-lg font-semibold text-gray-800">Assignments</h2>
          <button
            onClick={() => handleOpenModal()}
            disabled={readOnly}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-orange-600 text-white hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <Plus size={18} />
            Add Assignment
          </button>
        </div>

        {/* Assignment List */}
        <div className="grid gap-4 max-w-4xl">
          {assignments.map((assignment) => (
            <div
              key={assignment.id}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">{assignment.name}</h3>
                  <p className="text-sm text-gray-600 mb-3">{assignment.description || 'No description'}</p>
                  <p className="text-xs text-gray-500">
                    Created: {new Date(assignment.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleViewAssignment(assignment.id)}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-full hover:bg-indigo-700"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => handleOpenModal(assignment)}
                    disabled={readOnly}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-full disabled:text-gray-400 disabled:hover:bg-transparent"
                    title="Edit"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteAssignment(assignment.id)}
                    disabled={readOnly}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-full disabled:text-gray-400 disabled:hover:bg-transparent"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {assignments.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-500">No assignments created yet. Click "Add Assignment" to create one.</p>
            </div>
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                {editingId ? 'Edit Assignment' : 'Create Assignment'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assignment Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={readOnly}
                    placeholder="e.g., Assignment 1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    disabled={readOnly}
                    placeholder="Write description here..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:text-gray-400"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={handleCloseModal}
                  disabled={saving}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAssignment}
                  disabled={saving || readOnly}
                  className="px-6 py-2 bg-indigo-900 text-white rounded-full hover:bg-indigo-800 disabled:bg-gray-400"
                >
                  {saving ? 'Saving...' : readOnly ? 'Read-only' : editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex justify-between items-center">
          <button
            onClick={() => navigate(`${basePath}/folder/${idForNav}/lecture-notes${isReviewContext ? '?review=1' : ''}`)}
            className="px-6 py-2.5 rounded-full bg-coral text-white hover:bg-coral/90"
          >
            Previous
          </button>
          <button
            onClick={() => navigate(`${basePath}/folder/${idForNav}/quizzes${isReviewContext ? '?review=1' : ''}`)}
            className="px-6 py-2.5 rounded-full bg-indigo-900 text-white hover:bg-indigo-800"
          >
            Next
          </button>
        </div>

        {isReviewContext && submittedStatuses.has((status || '').toUpperCase()) && (
          <CoordinatorFeedbackBox folderId={id} section="ASSIGNMENTS" />
        )}

        {isAuditMemberReview && submittedStatuses.has((status || '').toUpperCase()) && (
          <AuditMemberFeedbackBox folderId={id} section="ASSIGNMENTS" />
        )}
      </div>
    </DashboardLayout>
  );
};

export default FolderAssignments;
