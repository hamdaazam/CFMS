import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { usersAPI } from '../services/api';

interface AuditUser {
  id: number;
  full_name: string;
  email?: string;
  cnic: string;
  role: string;
  department?: number;
  department_name?: string;
  is_active: boolean;
}

export const ConvenerManageAuditMembers: React.FC = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState<AuditUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<AuditUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
  // Load only dedicated AUDIT_MEMBER role for members
  const res = await usersAPI.getAll({ role: 'AUDIT_MEMBER', department: user?.department as any });
      const raw = (res.data?.results || res.data || []) as any[];
      const list: AuditUser[] = raw.map((u: any) => ({
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        cnic: u.cnic,
        role: u.role,
        department: u.department,
        department_name: u.department_name,
        is_active: u.is_active,
      }));
      setMembers(list);
    } catch (e: any) {
      console.error(e);
      const apiMsg = e?.response?.data?.detail || e?.response?.data?.role?.[0];
      setError(apiMsg || 'Failed to load audit members');
    } finally {
      setLoading(false);
    }
  };

  // Load only after user context is ready (prevents invalid params like undefined department)
  useEffect(() => {
    if (user) {
      load();
    }
  }, [user?.department]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return members;
    return members.filter(m =>
      m.full_name.toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q) ||
      m.cnic.includes(search)
    );
  }, [members, search]);

  const onDelete = async (id: number) => {
    const item = members.find(m => m.id === id);
    if (!item) return;
    if (!window.confirm(`Delete audit member "${item.full_name}"?`)) return;
    try {
      await usersAPI.delete(id);
      setSuccess('Member deleted');
      setTimeout(() => setSuccess(null), 1500);
      load();
    } catch (e: any) {
      console.error(e);
      setError(e?.response?.data?.detail || 'Failed to delete member');
      setTimeout(() => setError(null), 3000);
    }
  };

  const startEdit = (m: AuditUser) => {
    setEditTarget(m);
    setEditName(m.full_name);
    setEditEmail(m.email || '');
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    setError(null);
    try {
      await usersAPI.partialUpdate(editTarget.id, { full_name: editName.trim(), email: editEmail || null });
      setSuccess('Member updated');
      setTimeout(() => setSuccess(null), 1500);
      setEditTarget(null);
      load();
    } catch (e: any) {
      console.error(e);
      setError(e?.response?.data?.detail || 'Failed to update member');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout userName={user?.full_name || 'User'} userAvatar={user?.profile_picture || undefined}>
      <div className="p-6 space-y-6">
        <div className="bg-gradient-to-r from-primary to-primary-dark rounded-lg p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Audit Members</h2>
          <p className="text-white/90">Search, edit, or remove audit members in your department</p>
        </div>

        {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">{success}</div>}
        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div>}

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-4">
            <div className="relative max-w-md w-full">
              <input
                type="text"
                placeholder="Search by name, email, or CNIC"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading members...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500">{search ? 'No members match your search.' : 'No audit members found.'}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Sr. No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">CNIC</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filtered.map((m, idx) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{idx + 1}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{m.full_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{m.email || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{m.cnic}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{m.department_name || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${m.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-700'}`}>
                          {m.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        <button onClick={() => startEdit(m)} className="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                        <button onClick={() => onDelete(m.id)} className="text-red-600 hover:text-red-800 font-medium">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {editTarget && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-md shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Edit Audit Member</h3>
                <button onClick={() => setEditTarget(null)} className="text-gray-600 hover:text-gray-900">✕</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input className="w-full border rounded px-3 py-2" value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input className="w-full border rounded px-3 py-2" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                </div>
                {error && <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded">{error}</div>}
                <div className="flex justify-end gap-3">
                  <button className="px-4 py-2 border rounded hover:bg-gray-50" onClick={() => setEditTarget(null)} disabled={saving}>Cancel</button>
                  <button className="px-4 py-2 rounded bg-purple-600 text-white disabled:opacity-50" disabled={saving || !editName.trim()} onClick={saveEdit}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ConvenerManageAuditMembers;