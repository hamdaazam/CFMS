import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { HeroBanner } from '../components/common/HeroBanner';
import { useAuth } from '../context/AuthContext';
import { courseFoldersAPI } from '../services/api';

interface MyReportItem {
  folderId: number;
  courseCode: string;
  courseTitle: string;
  instructor?: string | null;
  section: string;
  term: string;
  decision: string | null;
  submitted: boolean;
  submittedAt?: string | null;
  fileUrl?: string | null;
}

const AuditMemberReports: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<MyReportItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Use dedicated endpoint (returns submitted reports by default)
        const res = await courseFoldersAPI.getMyAuditReports();
        const raw: any[] = Array.isArray(res.data) ? res.data : [];
        const mapped: MyReportItem[] = raw.map(r => ({
          folderId: r.folder_id,
          courseCode: r.course?.code || 'N/A',
          courseTitle: r.course?.title || 'Course',
          // API usually returns `faculty` as the instructor's full name.
          // Accept multiple possible keys and default to null.
          instructor: r.faculty || r.faculty_name || null,
          section: r.section || 'N/A',
          term: r.term || 'N/A',
          decision: r.decision || null,
          submitted: !!r.submitted,
          submittedAt: r.submitted_at || null,
          fileUrl: r.file_url || null,
        }));
        setItems(mapped);

        // Fallback: if some mapped items don't have instructor data, fetch folder basic info
        // in parallel and attempt to populate the instructor name from the folder details.
        const missingInstructor = mapped.filter(i => !i.instructor).map(i => i.folderId);
        if (missingInstructor.length > 0) {
          try {
            const respPromises = missingInstructor.map(id => courseFoldersAPI.getBasic(id).then(res => ({ id, data: res.data })).catch(() => ({ id, data: null })));
            const responses = await Promise.all(respPromises);
            setItems(prev => prev.map(item => {
              if (item.instructor) return item;
              const found = responses.find(r => r.id === item.folderId && r.data);
              if (!found || !found.data) return item;
              // Several possible places to find faculty name depending on backend payload
              const name = found.data.faculty?.user_details?.full_name || found.data.faculty?.user?.full_name || found.data.faculty_name || found.data.faculty || null;
              return { ...item, instructor: name };
            }));
          } catch (err) {
            // ignore fallback failures; keep nulls
            console.warn('Failed to fetch missing instructor names', err);
          }
        }
      } catch (e) {
        console.error(e);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    if (user?.id) load();
  }, [user?.id]);

  return (
    <DashboardLayout userRole="faculty" userName={user?.full_name} userAvatar={user?.profile_picture || undefined}>
      <div className="p-6 space-y-6">
        <HeroBanner title="My Audit Reports" subtitle="Your submitted feedback and decisions" />

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-primary px-6 py-4 text-white font-semibold">Reports</div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Course</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Instructor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Section</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Term</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Submitted At</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">File</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">Loading…</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No reports yet</td></tr>
                ) : (
                  items.map((r, idx) => {
                    const status = (r.submitted ? (r.decision || 'SUBMITTED') : 'PENDING').toString().toUpperCase();
                    const color = status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700';
                    return (
                      <tr key={`${r.folderId}-${idx}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">{r.courseCode} - {r.courseTitle}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{r.instructor || '—'}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{r.section}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{r.term}</td>
                        <td className="px-6 py-4 text-sm"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${color}`}>{status}</span></td>
                        <td className="px-6 py-4 text-sm text-gray-900">{r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—'}</td>
                        <td className="px-6 py-4 text-sm">
                          {r.fileUrl ? (
                            <a href={r.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800">Open</a>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AuditMemberReports;
