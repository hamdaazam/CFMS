import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { roleRequestsAPI } from '../services/api';
import { Loader, Check, X } from 'lucide-react';

export const HODRoleRequests: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const resp = await roleRequestsAPI.getAll({ status: 'PENDING' });
      const data = Array.isArray(resp.data) ? resp.data : resp.data.results || [];
      setRequests(data);
    } catch (err) {
      console.error('Failed to fetch role requests', err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);
  useEffect(() => {
    const handler = () => fetchRequests();
    window.addEventListener('roleRequestUpdated', handler as EventListener);
    return () => window.removeEventListener('roleRequestUpdated', handler as EventListener);
  }, []);

  const approve = async (id: number) => {
    setProcessingId(id);
    try {
      await roleRequestsAPI.approve(id);
      setSuccessMessage('Request approved successfully.');
      await fetchRequests();
      // Notify other UIs (Admin, Manage pages) to refresh
      window.dispatchEvent(new CustomEvent('roleRequestUpdated', { detail: { id, status: 'APPROVED' } }));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Approve failed', err);
      const msg = (err as any)?.response?.data?.detail || 'Failed to approve request.';
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 4000);
    } finally {
      setProcessingId(null);
    }
  };

  const reject = async (id: number) => {
    const reason = window.prompt('Please provide a reason for rejection (optional):', '');
    setProcessingId(id);
    try {
      await roleRequestsAPI.reject(id, { decision_reason: reason === null ? undefined : reason });
      setSuccessMessage('Request rejected successfully.');
      await fetchRequests();
      // Notify other UIs (Admin, Manage pages) to refresh
      window.dispatchEvent(new CustomEvent('roleRequestUpdated', { detail: { id, status: 'REJECTED' } }));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Reject failed', err);
      const msg = (err as any)?.response?.data?.detail || 'Failed to reject request.';
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 4000);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout userRole="hod" userName={user?.full_name || 'HOD'} userAvatar={user?.profile_picture || undefined}>
        <div className="flex items-center justify-center h-64">
          <Loader className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout userRole="hod" userName={user?.full_name || 'HOD'} userAvatar={user?.profile_picture || undefined}>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Role Assignment Requests</h1>
        </div>
        {errorMessage && (
          <div className="bg-red-50 text-red-600 p-2 rounded mb-3">{errorMessage}</div>
        )}
        {successMessage && (
          <div className="bg-green-50 text-green-600 p-2 rounded mb-3">{successMessage}</div>
        )}
        {requests.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center text-gray-600">No pending role requests.</div>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="bg-white p-4 rounded shadow-sm flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{r.role} → {r.target_user_details?.full_name}</h3>
                  <p className="text-sm text-gray-600">Requested by: {r.requested_by_details?.full_name} on {new Date(r.requested_at).toLocaleString()}</p>
                  <div className="text-sm text-gray-700 mt-1">
                    <div>Department: {r.department_details?.name || '—'}</div>
                    <div>Program: {r.program_details?.title || '—'}</div>
                    {r.coordinator_course_ids?.length > 0 && (
                      <div>Courses: {r.coordinator_course_ids.join(', ')}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => approve(r.id)}
                    disabled={processingId === r.id}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    title="Approve request"
                  >
                    <Check className="w-4 h-4 inline" /> Approve
                  </button>
                  <button
                    onClick={() => reject(r.id)}
                    disabled={processingId === r.id}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    title="Reject request"
                  >
                    <X className="w-4 h-4 inline" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default HODRoleRequests;
