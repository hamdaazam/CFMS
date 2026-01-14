import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { roleRequestsAPI } from '../services/api';
import { Loader } from 'lucide-react';

export const AdminPendingRoleRequests: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const resp = await roleRequestsAPI.getAll({ status: 'PENDING' });
      const data = Array.isArray(resp.data) ? resp.data : resp.data.results || [];
      // If admin, show requests created by this admin so they can track, otherwise show all
      const filtered = user?.role === 'ADMIN' ? data.filter((r:any) => r.requested_by === user?.id) : data;
      setRequests(filtered);
    } catch (err) {
      setRequests([]);
      setError('Failed to fetch pending requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);
  useEffect(() => {
    const handler = (e: any) => fetchRequests();
    window.addEventListener('roleRequestUpdated', handler as EventListener);
    return () => window.removeEventListener('roleRequestUpdated', handler as EventListener);
  }, []);

  const cancel = async (id: number) => {
    if (!window.confirm('Cancel this pending role request?')) return;
    setProcessingId(id);
    try {
      // Cancel (DELETE) the request so it is removed entirely. Admin can delete their own requests.
      await roleRequestsAPI.delete(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
      setSuccessMessage('Pending request cancelled.');
      setTimeout(() => setSuccessMessage(null), 3000);
      // Notify other UIs that a request was cancelled (deleted)
      window.dispatchEvent(new CustomEvent('roleRequestUpdated', { detail: { id, status: 'DELETED' } }));
    } catch (err: any) {
      setError('Failed to cancel request');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout userRole="admin" userName={user?.full_name || 'Admin'} userAvatar={user?.profile_picture || undefined}>
        <div className="flex items-center justify-center h-64">
          <Loader className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout userRole="admin" userName={user?.full_name || 'Admin'} userAvatar={user?.profile_picture || undefined}>
      <div className="p-8 max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Pending Role Requests</h1>
        {error && <div className="bg-red-50 text-red-600 p-2 mb-3 rounded">{error}</div>}
        {error && <div className="bg-red-50 text-red-600 p-2 mb-3 rounded">{error}</div>}
        {successMessage && <div className="bg-green-50 text-green-600 p-2 mb-3 rounded">{successMessage}</div>}
        {requests.length === 0 ? (
          <div className="bg-white rounded-lg p-6 text-center text-gray-600">No pending role requests.</div>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="bg-white p-4 rounded shadow-sm flex items-start justify-between">
                <div>
                  <div className="flex gap-2 items-center">
                    <div className="text-sm font-semibold">{r.role}</div>
                    <div className="text-xs text-gray-500">for {r.target_user_details?.full_name}</div>
                  </div>
                  <div className="mt-1 text-sm text-gray-700">Requested on: {new Date(r.requested_at).toLocaleString()}</div>
                </div>
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => cancel(r.id)}
                    disabled={processingId === r.id}
                    className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >Cancel</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminPendingRoleRequests;
