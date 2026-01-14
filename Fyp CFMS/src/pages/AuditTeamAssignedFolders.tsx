import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { courseFoldersAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

export const AuditTeamAssignedFolders: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      // Use audit assignments endpoint (capability-based) so any user assigned to audit sees their folders,
      // even if their primary role is FACULTY/CONVENER/etc.
      const reportsRes = await courseFoldersAPI.getMyAuditReports({ submitted: 0 });
      const assignments: any[] = Array.isArray(reportsRes.data) ? reportsRes.data : (reportsRes.data?.results || []);
      // Map assignment rows to folder-like rows for rendering.
      // CRITICAL: Filter to only show folders that are actually in audit status (UNDER_AUDIT or AUDIT_COMPLETED)
      // This ensures we don't show coordinator-assigned folders or folders that have moved beyond audit
      const mapped = assignments
        .filter((a: any) => {
          // Only show folders that are in audit-related statuses
          const folderStatus = (a.folder_status || '').toUpperCase();
          return folderStatus === 'UNDER_AUDIT' || folderStatus === 'AUDIT_COMPLETED';
        })
        .map((a: any) => ({
          id: a.folder_id,
          course_details: { code: a.course?.code, title: a.course?.title },
          section: a.section,
          faculty_name: a.faculty,
          department_name: a.department || a.department_name,
          program_name: a.program || a.program_name,
          folder_status: a.folder_status, // Keep status for debugging
        }))
        .filter((x: any) => !!x.id);
      setRows(mapped);
    } catch (e) {
      console.error('Failed to load assigned folders', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <DashboardLayout userRole="faculty" userName={user?.full_name || 'Audit Team'} userAvatar={user?.profile_picture || undefined}>
      <div className="p-6 space-y-6">
        {/* Use faculty-first sidebar; audit links are shown there via capability flags */}
        {/* Header Section */}
        <div className="relative rounded-lg overflow-hidden" style={{backgroundImage:'url(/background-image.jpg)',backgroundSize:'cover',backgroundPosition:'center',minHeight:'160px'}}>
          <div className="absolute inset-0 bg-primary/70"/>
          <div className="relative z-10 p-6 text-white">
            <h2 className="text-2xl font-bold">Review Assigned Folders</h2>
            <p className="text-white/90 text-sm">Folders assigned to you for audit</p>
          </div>
        </div>

        {/* Assigned Folders Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Table Header */}
          <div className="bg-primary px-6 py-4 flex items-center justify-between">
            <h3 className="text-white font-semibold text-lg">Assigned Folders</h3>
            <button className="text-white hover:text-white/80">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Sr no</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Course</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Section</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Instructor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Dept.</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Program</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No assignments</td></tr>
                ) : (
                  rows.map((f, idx) => (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{idx + 1}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{f.course_details?.code || f.course?.code} - {f.course_details?.title || f.course?.title}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{f.section}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{f.faculty_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{f.department_name || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{f.program_name || 'All'}</td>
                      <td className="px-6 py-4 text-sm">
                        <button onClick={() => navigate(`/audit-member/folders/${f.id}/review`)} className="text-blue-600 hover:text-blue-800 font-medium">Review</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
