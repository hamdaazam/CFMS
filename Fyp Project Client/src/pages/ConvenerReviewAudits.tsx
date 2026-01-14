import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { courseFoldersAPI } from '../services/api';
import { HeroBanner } from '../components/common/HeroBanner';
import { ConvenerReviewModal } from '../components/modals/ConvenerReviewModal';

interface CourseFolderItem {
  id: number;
  course: { code: string; title: string };
  section: string;
  facultyName: string;
  status: string;
}

const ConvenerReviewAudits: React.FC = () => {
  const { user } = useAuth();
  const [folders, setFolders] = useState<CourseFolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CourseFolderItem | null>(null);
  // Removed diagnostics now that flow is corrected
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      // Fetch all folders with scope_all, then filter for audit-related statuses
      // This ensures folders remain visible even after convener makes a decision
      const res = await courseFoldersAPI.getAll({ scope_all: 1 });
      const raw: any[] = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      
      // Filter folders that are in audit review stage (completed audit) or have been reviewed by convener
      // Include: AUDIT_COMPLETED, SUBMITTED_TO_HOD, REJECTED_BY_CONVENER
      // Exclude: APPROVED_BY_HOD, REJECTED_BY_HOD (final HOD decisions)
      const allowedStatuses = ['AUDIT_COMPLETED', 'SUBMITTED_TO_HOD', 'REJECTED_BY_CONVENER'];
      const filteredFolders = raw.filter((f: any) => {
        const status = (f.status || '').toUpperCase();
        return allowedStatuses.includes(status);
      });
      
      const mapped: CourseFolderItem[] = filteredFolders.map((f: any) => ({
        id: f.id,
        course: {
          code: f.course?.code || f.course_details?.code || 'N/A',
          title: f.course?.title || f.course_details?.title || 'Course',
        },
        section: f.section,
        facultyName: f.faculty?.user?.full_name || f.faculty_name || '—',
        status: f.status,
      }));
      setFolders(mapped);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <DashboardLayout userName={user?.full_name}>
      <HeroBanner
        title="Review Audits"
        subtitle="Browse audit-completed folders, open reports, and forward to HOD"
      />

      {loading ? (
        <div className="text-gray-600">Loading…</div>
      ) : folders.length === 0 ? (
        <div className="text-gray-600">No folders ready for review</div>
      ) : (
        <div className="bg-white rounded-xl shadow divide-y">
          {folders.map(f => (
            <div key={f.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="font-semibold text-gray-900">{f.course.code} - {f.course.title}</div>
                <div className="text-sm text-gray-600">Section {f.section} • Faculty {f.facultyName}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
                  {f.status === 'SUBMITTED_TO_HOD' ? 'Forwarded to HOD' : 
                   f.status === 'REJECTED_BY_CONVENER' ? 'Rejected' : 
                   'Pending Review'}
                </span>
                <a href={`/convener/folders/${f.id}/reports`} className="px-3 py-2 rounded bg-purple-100 text-purple-800 hover:bg-purple-200 text-sm">Open Reports</a>
                <button onClick={() => { setSelected(f as any); setShowModal(true); }} className="px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700 text-sm">
                  {f.status === 'SUBMITTED_TO_HOD' || f.status === 'REJECTED_BY_CONVENER' ? 'Change Decision' : 'Review & Forward'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <ConvenerReviewModal
          isOpen={showModal}
          onClose={() => { setShowModal(false); setSelected(null); }}
          folderId={selected.id}
          folderName={`${selected.course.code} - ${selected.section}`}
          onSuccess={load}
        />
      )}
    </DashboardLayout>
  );
};

export default ConvenerReviewAudits;
