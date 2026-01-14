import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { HeroBanner } from '../components/common/HeroBanner';
import { courseFoldersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface AssignmentItem {
  id: number;
  auditor: { id: number; name: string };
  submitted: boolean;
  decision: 'APPROVED' | 'REJECTED' | 'PENDING' | string;
  remarks: string;
  ratings: Record<string, number>;
  file_url?: string | null;
  submitted_at?: string;
}

interface AuditReportsResponse {
  folder: {
    id: number;
    course: { code: string; title: string };
    section: string;
    term: string;
    faculty: string;
    status: string;
    consolidated_pdf_url?: string | null;
  };
  assignments: AssignmentItem[];
  summary: {
    total_assignments: number;
    overall_decision: string;
    decisions: { APPROVED: number; REJECTED: number; PENDING: number };
    average_ratings: Record<string, number>;
  };
}

export const AuditReportViewer: React.FC = () => {
  const { folderId } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState<AuditReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [genBusy, setGenBusy] = useState(false);

  const canGenerate = useMemo(() => {
    return user?.role === 'CONVENER' || user?.role === 'HOD' || user?.role === 'ADMIN';
  }, [user]);

  useEffect(() => {
    const load = async () => {
      if (!folderId) return;
      try {
        setLoading(true);
        const res = await courseFoldersAPI.getAuditReports(Number(folderId));
        setData(res.data);
      } catch (e: any) {
        setError(e?.response?.data?.error || 'Failed to load audit reports');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [folderId]);

  const onGenerate = async () => {
    if (!folderId) return;
    try {
      setGenBusy(true);
      await courseFoldersAPI.generateConsolidatedPdf(Number(folderId));
      const res = await courseFoldersAPI.getAuditReports(Number(folderId));
      setData(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to generate consolidated PDF');
    } finally {
      setGenBusy(false);
    }
  };

  const Banner: React.FC = () => (
    <HeroBanner
      title="Audit Reports"
      subtitle={data ? `${data.folder.course.code} - ${data.folder.course.title} • Section ${data.folder.section} • Term ${data.folder.term}` : undefined}
      bgImageUrl="/university-background.png"
      overlayClassName="bg-black/40 backdrop-blur-md"
    />
  );

  return (
    <DashboardLayout title="">
      <Banner />

      {loading && <div className="text-gray-600">Loading…</div>}
      {error && <div className="text-red-600 mb-4">{error}</div>}

      {data && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm text-gray-500">Overall Decision</div>
                <div className="text-xl font-semibold">{data.summary.overall_decision}</div>
              </div>
              <div className="hidden md:block w-px h-10 bg-gray-200" />
              <div>
                <div className="text-sm text-gray-500">Decisions</div>
                <div className="text-gray-800">
                  Approved {data.summary.decisions.APPROVED} • Rejected {data.summary.decisions.REJECTED} • Pending {data.summary.decisions.PENDING}
                </div>
              </div>
              <div className="hidden md:block w-px h-10 bg-gray-200" />
              <div>
                <div className="text-sm text-gray-500">Consolidated PDF</div>
                {data.folder.consolidated_pdf_url ? (
                  <a className="text-coral hover:underline" href={data.folder.consolidated_pdf_url} target="_blank" rel="noreferrer">Download</a>
                ) : canGenerate ? (
                  <button onClick={onGenerate} disabled={genBusy} className="px-4 py-2 rounded bg-coral text-white hover:opacity-90 disabled:opacity-50">
                    {genBusy ? 'Generating…' : 'Generate Consolidated PDF'}
                  </button>
                ) : (
                  <span className="text-gray-500">Not generated</span>
                )}
              </div>
            </div>

            {Object.keys(data.summary.average_ratings || {}).length > 0 && (
              <div className="mt-4">
                <div className="text-sm text-gray-500 mb-1">Average Ratings</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {Object.entries(data.summary.average_ratings).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between border rounded-md px-3 py-2">
                      <span className="text-gray-700">{k}</span>
                      <span className="font-semibold">{v.toFixed(2)} / 5</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Assignments */}
          <div className="bg-white rounded-xl shadow p-5">
            <div className="text-lg font-semibold mb-3">Member Reports</div>
            <div className="grid grid-cols-1 gap-4">
              {data.assignments.map((a) => (
                <div key={a.id} className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="font-medium text-gray-900">{a.auditor.name}</div>
                    <div className="text-sm text-gray-600">Decision: {a.decision || 'PENDING'}</div>
                    {a.remarks && <div className="text-sm text-gray-700 mt-1">Remarks: {a.remarks}</div>}
                  </div>
                  <div className="flex-1" />
                  <div className="max-w-xl w-full">
                    {Object.keys(a.ratings || {}).length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(a.ratings).map(([k, v]) => (
                          <div key={k} className="text-sm flex items-center justify-between bg-gray-50 rounded px-3 py-2">
                            <span className="text-gray-700 mr-3 truncate" title={k}>{k}</span>
                            <span className="font-semibold">{Number(v).toFixed(1)} / 5</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">No ratings provided</div>
                    )}
                  </div>
                  <div className="md:w-48">
                    {a.file_url ? (
                      <a className="text-coral hover:underline" href={a.file_url} target="_blank" rel="noreferrer">Open PDF</a>
                    ) : (
                      <span className="text-sm text-gray-500">PDF not uploaded</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default AuditReportViewer;
