import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';

interface User {
  id: number;
  full_name: string;
  cnic: string;
}

interface Team {
  id: string;
  name: string;
  memberIds: number[];
  createdAt: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (team: Team) => void;
}

export const CreateAuditTeamModal: React.FC<Props> = ({ isOpen, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [selected, setSelected] = useState<number[]>([]);

  const canSave = useMemo(() => name.trim().length > 0 && selected.length > 0, [name, selected]);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setSelected([]);
    setError(null);
    const load = async () => {
      try {
        setLoading(true);
        const [evalRes, auditRes] = await Promise.all([
          api.get('/auth/users/', { params: { role: 'EVALUATOR' } }),
          api.get('/auth/users/', { params: { role: 'AUDIT_TEAM' } }),
        ]);
        const list1 = (evalRes.data.results || evalRes.data) as User[];
        const list2 = (auditRes.data.results || auditRes.data) as User[];
        const map = new Map<number, User>();
        [...list1, ...list2].forEach((u) => map.set(u.id, u));
        setMembers(Array.from(map.values()));
      } catch (e) {
        console.error(e);
        setError('Failed to load users');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen]);

  const saveTeam = () => {
    if (!canSave) return;
    try {
      setSaving(true);
      const id = `team_${Date.now()}`;
      const team: Team = {
        id,
        name: name.trim(),
        memberIds: selected,
        createdAt: new Date().toISOString(),
      };
      const existing = JSON.parse(localStorage.getItem('auditTeams') || '[]');
      existing.push(team);
      localStorage.setItem('auditTeams', JSON.stringify(existing));
      if (onCreated) onCreated(team);
      onClose();
    } catch (e) {
      console.error(e);
      setError('Failed to save team');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Create Audit Team</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-900">✕</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              placeholder="e.g., Fall-25 Audit Team A"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Members</label>
            <div className="border rounded max-h-56 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-gray-600">Loading members…</div>
              ) : members.length === 0 ? (
                <div className="p-4 text-gray-600">No eligible members found</div>
              ) : (
                members.map((m) => (
                  <label key={m.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 border-b last:border-b-0">
                    <input
                      type="checkbox"
                      checked={selected.includes(m.id)}
                      onChange={() => setSelected((prev) => prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id])}
                    />
                    <div>
                      <div className="font-medium text-gray-900">{m.full_name}</div>
                      <div className="text-xs text-gray-600">CNIC: {m.cnic}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
            {selected.length > 0 && (
              <div className="text-sm text-blue-600 mt-2">{selected.length} member{selected.length > 1 ? 's' : ''} selected</div>
            )}
          </div>

          {error && <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded">{error}</div>}

          <div className="flex justify-end gap-3">
            <button className="px-4 py-2 border rounded hover:bg-gray-50" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="px-4 py-2 rounded bg-purple-600 text-white disabled:opacity-50"
                    disabled={!canSave || saving}
                    onClick={saveTeam}>
              {saving ? 'Saving…' : 'Create Team'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateAuditTeamModal;
