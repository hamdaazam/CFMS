import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { HeroBanner } from '../components/common/HeroBanner';
import api from '../services/api';

interface User { id: number; full_name: string; }
interface Team { id: string; name: string; memberIds: number[]; createdAt: string; }

export const ConvenerManageAuditTeams: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [usersMap, setUsersMap] = useState<Record<number, User>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const load = async () => {
    const saved: Team[] = JSON.parse(localStorage.getItem('auditTeams') || '[]');
    setTeams(saved);
    try {
      const [evalRes, auditRes] = await Promise.all([
        api.get('/auth/users/', { params: { role: 'EVALUATOR' } }),
        api.get('/auth/users/', { params: { role: 'AUDIT_TEAM' } }),
      ]);
      const list1 = (evalRes.data.results || evalRes.data) as User[];
      const list2 = (auditRes.data.results || auditRes.data) as User[];
      const map: Record<number, User> = {};
      [...list1, ...list2].forEach((u) => { map[u.id] = u; });
      setUsersMap(map);
    } catch (e) {
      // non-fatal, teams will still show
      console.warn('Failed to fetch users for names', e);
    }
  };

  useEffect(() => { load(); }, []);

  const memberNames = (ids: number[]) => ids.map((id) => usersMap[id]?.full_name || `User #${id}`).join(', ');

  const onDelete = (id: string) => {
    const next = teams.filter((t) => t.id !== id);
    setTeams(next);
    localStorage.setItem('auditTeams', JSON.stringify(next));
  };

  const startRename = (team: Team) => { setRenamingId(team.id); setNewName(team.name); };
  const applyRename = () => {
    if (!renamingId) return;
    const next = teams.map((t) => (t.id === renamingId ? { ...t, name: newName.trim() || t.name } : t));
    setTeams(next);
    localStorage.setItem('auditTeams', JSON.stringify(next));
    setRenamingId(null);
    setNewName('');
  };

  return (
    <DashboardLayout>
      <HeroBanner title="Manage Audit Teams" subtitle="Rename or delete saved teams" />

      <div className="bg-white rounded-xl shadow divide-y">
        {teams.length === 0 ? (
          <div className="p-6 text-gray-600">No teams created yet. Click "Create Team" on the Audit Team page to add one.</div>
        ) : (
          teams.map((team) => (
            <div key={team.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex-1 min-w-0">
                {renamingId === team.id ? (
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} className="border rounded px-3 py-2 w-full md:w-80" />
                ) : (
                  <div className="font-semibold text-gray-900 truncate">{team.name}</div>
                )}
                <div className="text-sm text-gray-600 mt-1 truncate">Members: {memberNames(team.memberIds) || '—'}</div>
              </div>
              <div className="flex items-center gap-2">
                {renamingId === team.id ? (
                  <>
                    <button className="px-3 py-2 rounded bg-green-600 text-white" onClick={applyRename}>Save</button>
                    <button className="px-3 py-2 rounded border" onClick={() => { setRenamingId(null); setNewName(''); }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button className="px-3 py-2 rounded bg-slate-700 text-white" onClick={() => startRename(team)}>Rename</button>
                    <button className="px-3 py-2 rounded bg-red-600 text-white" onClick={() => onDelete(team.id)}>Delete</button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </DashboardLayout>
  );
};

export default ConvenerManageAuditTeams;
