import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { usersAPI } from '../services/api';

export const HODApprovals: React.FC = () => {
  const { user } = useAuth();
  const [convenerRequests, setConvenerRequests] = useState<any[]>([]);
  const [coordinatorRequests, setCoordinatorRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const convRes = await usersAPI.getAll({ role: 'CONVENER', department: user?.department });
      const coordRes = await usersAPI.getAll({ role: 'COORDINATOR', department: user?.department });
      const rawConv = convRes.data.results || convRes.data || [];
      const rawCoord = coordRes.data.results || coordRes.data || [];
      // Filter for inactive requests (created but not activated)
      setConvenerRequests((rawConv as any[]).filter((u: any) => !u.is_active));
      setCoordinatorRequests((rawCoord as any[]).filter((u: any) => !u.is_active));
    } catch (err) {
      console.error('Failed to fetch pending approvals', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approveUser = async (id: number) => {
    try {
      await usersAPI.partialUpdate(id, { is_active: true });
      await fetchPending();
    } catch (err) {
      console.error('Failed to approve user', err);
      alert('Failed to approve. Try again later.');
    }
  };

  const rejectUser = async (id: number) => {
    try {
      await usersAPI.delete(id);
      await fetchPending();
    } catch (err) {
      console.error('Failed to reject user', err);
      alert('Failed to reject. Try again later.');
    }
  };

  return (
    <DashboardLayout userRole="hod" userName={user?.full_name || 'Head of Department'} userAvatar={user?.profile_picture || undefined}>
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Pending Approvals</h2>
        {loading ? (
          <div className="text-center py-6">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-md p-4 shadow">
              <h3 className="font-semibold mb-3">Convener Creation Requests</h3>
              {convenerRequests.length === 0 ? (
                <p className="text-sm text-gray-500">No convener creation requests</p>
              ) : (
                convenerRequests.map((u) => (
                  <div key={u.id} className="flex justify-between items-center py-2 border-b last:border-b-0">
                    <div>
                      <div className="font-medium">{u.full_name || u.user?.full_name}</div>
                      <div className="text-xs text-gray-500">CNIC: {u.cnic}</div>
                      <div className="text-xs text-gray-500">Role: CONVENER</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => approveUser(u.id)} className="px-3 py-1 bg-green-600 text-white rounded text-sm">Approve</button>
                      <button onClick={() => rejectUser(u.id)} className="px-3 py-1 bg-red-600 text-white rounded text-sm">Reject</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="bg-white rounded-md p-4 shadow">
              <h3 className="font-semibold mb-3">Coordinator Creation Requests</h3>
              {coordinatorRequests.length === 0 ? (
                <p className="text-sm text-gray-500">No coordinator creation requests</p>
              ) : (
                coordinatorRequests.map((u) => (
                  <div key={u.id} className="flex justify-between items-center py-2 border-b last:border-b-0">
                    <div>
                      <div className="font-medium">{u.full_name || u.user?.full_name}</div>
                      <div className="text-xs text-gray-500">CNIC: {u.cnic}</div>
                      <div className="text-xs text-gray-500">Role: COORDINATOR</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => approveUser(u.id)} className="px-3 py-1 bg-green-600 text-white rounded text-sm">Approve</button>
                      <button onClick={() => rejectUser(u.id)} className="px-3 py-1 bg-red-600 text-white rounded text-sm">Reject</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default HODApprovals;
