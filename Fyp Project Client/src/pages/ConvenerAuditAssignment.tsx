import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { HeroBanner } from '../components/common/HeroBanner';
import { useAuth } from '../context/AuthContext';
import { courseFoldersAPI } from '../services/api';
import { AuditAssignmentModal } from '../components/modals/AuditAssignmentModal';

interface CourseFolder {
  id: number;
  course?: { code?: string; title?: string } | null;
  course_details?: { code?: string; title?: string } | null; // list serializer uses this field
  section?: string | null;
  faculty?: { user?: { full_name?: string } } | null;
  faculty_name?: string | null; // list serializer provides this convenience field
  term_name?: string | null;
  program_name?: string | null;
  status?: string;
  assigned_auditors?: Array<{ id: number; name: string; cnic: string }> | null;
}

const ConvenerAuditAssignment: React.FC = () => {
  const { user } = useAuth();
  const [pendingFolders, setPendingFolders] = useState<CourseFolder[]>([]);
  const [assignedFolders, setAssignedFolders] = useState<CourseFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CourseFolder | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'assigned'>('pending');

  const load = async () => {
    setLoading(true);
    try {
      // Fetch pending assignment
      const resPending = await courseFoldersAPI.getAll({ status: 'APPROVED_COORDINATOR' });
      const listPending = (resPending.data?.results || resPending.data || []) as CourseFolder[];
      setPendingFolders(Array.isArray(listPending) ? listPending : []);

      // Fetch already assigned (UNDER_AUDIT)
      const resAssigned = await courseFoldersAPI.getAll({ status: 'UNDER_AUDIT' });
      const listAssigned = (resAssigned.data?.results || resAssigned.data || []) as CourseFolder[];
      setAssignedFolders(Array.isArray(listAssigned) ? listAssigned : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUnassign = async (folderId: number) => {
    if (!window.confirm('Are you sure you want to unassign the audit team? This will reset the folder status to Approved by Coordinator.')) return;
    try {
      await courseFoldersAPI.unassignAudit(folderId);
      load(); // Reload lists
    } catch (e) {
      console.error('Failed to unassign', e);
      alert('Failed to unassign audit team');
    }
  };

  useEffect(() => { load(); }, []);

  const renderFolderList = (folders: CourseFolder[], isAssignedList: boolean) => {
    if (folders.length === 0) {
      return <div className="p-8 text-center text-gray-500">No folders found in this category</div>;
    }
    return (
      <div className="bg-white rounded-xl shadow divide-y">
        {folders.map((f) => {
          const course = f.course || f.course_details || {};
          const code = (course as any).code || 'N/A';
          const title = (course as any).title || 'No Title';
          const section = f.section || '—';
          const facultyName = f.faculty_name || f.faculty?.user?.full_name || 'Unknown';
          const term = f.term_name || 'N/A';
          const program = f.program_name || 'N/A';
          const auditors = f.assigned_auditors || [];
          
          return (
            <div key={f.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex-1">
                <div className="font-semibold text-gray-900">{code} - {title}</div>
                <div className="text-sm text-gray-600">Section {section} • Faculty {facultyName} • Term {term} • Program {program}</div>
                {isAssignedList && auditors.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
                      Assigned to:
                    </span>
                    <span className="text-sm text-gray-700">
                      {auditors.map(a => a.name).join(', ')}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0">
                {isAssignedList ? (
                  <button
                    onClick={() => handleUnassign(f.id)}
                    className="px-3 py-2 rounded bg-red-100 text-red-700 hover:bg-red-200 text-sm border border-red-200"
                  >
                    Unassign / Reset
                  </button>
                ) : (
                  <button
                    onClick={() => { setSelected(f); setShowModal(true); }}
                    className="px-3 py-2 rounded bg-purple-600 text-white hover:bg-purple-700 text-sm"
                  >
                    Assign to Members
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <DashboardLayout userName={user?.full_name}>
      <HeroBanner
        title="Assign Courses"
        subtitle="Manage audit assignments for approved course folders"
      />

      <div className="mb-6">
        <div className="flex border-b border-gray-200">
          <button
            className={`py-2 px-4 font-medium text-sm focus:outline-none ${activeTab === 'pending' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('pending')}
          >
            Pending Assignment ({pendingFolders.length})
          </button>
          <button
            className={`py-2 px-4 font-medium text-sm focus:outline-none ${activeTab === 'assigned' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('assigned')}
          >
            Assigned / Under Audit ({assignedFolders.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-600">Loading…</div>
      ) : (
        activeTab === 'pending' ? renderFolderList(pendingFolders, false) : renderFolderList(assignedFolders, true)
      )}

      {selected && (
        <AuditAssignmentModal
          isOpen={showModal}
          onClose={() => { setShowModal(false); setSelected(null); }}
          folderId={selected.id}
          folderName={`${(selected.course?.code || selected.course_details?.code || 'N/A')} - ${(selected.section || '')}`}
          onSuccess={load}
        />
      )}
    </DashboardLayout>
  );
};

export default ConvenerAuditAssignment;
