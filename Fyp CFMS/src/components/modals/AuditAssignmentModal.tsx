import { useState, useEffect } from 'react';
import api, { courseFoldersAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface User {
  id: number;
  full_name: string;
  cnic: string;
  role?: string;
}

interface AuditAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: number;
  folderName: string;
  onSuccess: () => void;
}

export const AuditAssignmentModal = ({
  isOpen,
  onClose,
  folderId,
  folderName,
  onSuccess,
}: AuditAssignmentModalProps) => {
  const { user } = useAuth();
  const [auditTeamMembers, setAuditTeamMembers] = useState<User[]>([]);
  const [selectedAuditors, setSelectedAuditors] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [teams, setTeams] = useState<{ id: string; name: string; memberIds: number[] }[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      fetchAuditTeamMembers();
      // load saved teams
      try {
        const saved = JSON.parse(localStorage.getItem('auditTeams') || '[]');
        setTeams(saved);
      } catch {
        setTeams([]);
      }
    }
  }, [isOpen]);

  const fetchAuditTeamMembers = async () => {
    setIsLoading(true);
    setError('');
    try {
      // Fetch all users in the department first
      const allUsersRes = await api.get('/auth/users/', { params: { department: user?.department } });
      const allUsers = (allUsersRes.data?.results || allUsersRes.data || []) as any[];
      
      if (!Array.isArray(allUsers)) {
        throw new Error('Invalid response format from API');
      }
      
      // Filter for audit team members:
      // 1. Users with explicit audit roles (AUDIT_MEMBER, AUDIT_TEAM, EVALUATOR)
      // 2. Users with has_audit_access capability flag (capability-based audit access)
      const auditRoles = ['AUDIT_MEMBER', 'AUDIT_TEAM', 'EVALUATOR'];
      const auditMembers = allUsers.filter((u: any) => {
        const userRole = String(u.role || '').toUpperCase();
        // Include if they have an audit role OR have audit access capability
        return (auditRoles.includes(userRole) || u.has_audit_access === true) 
          && userRole !== 'HOD';
      });
      
      // Map to User interface format
      const formattedMembers: User[] = auditMembers.map((u: any) => ({
        id: u.id,
        full_name: u.full_name || '',
        cnic: u.cnic || '',
        role: u.role,
      }));
      
      setAuditTeamMembers(formattedMembers);
      
      if (formattedMembers.length === 0) {
        setError('No audit team members found in your department. Please add audit members first.');
      }
    } catch (err: any) {
      console.error('Failed to fetch audit team members:', err);
      const errorMessage = err?.response?.data?.detail 
        || err?.response?.data?.error 
        || err?.message 
        || 'Failed to load audit team members. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleAuditor = (auditorId: number) => {
    setSelectedAuditors((prev) =>
      prev.includes(auditorId)
        ? prev.filter((id) => id !== auditorId)
        : [...prev, auditorId]
    );
  };

  const handleAssign = async () => {
    if (selectedAuditors.length === 0) {
      setError('Please select at least one auditor');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await courseFoldersAPI.assignAudit(folderId, { auditor_ids: selectedAuditors });
      alert(`Audit team assigned successfully (${selectedAuditors.length} member${selectedAuditors.length > 1 ? 's' : ''})!`);
      onSuccess();
      // Notify other components (auditors) to refresh their assigned lists
      window.dispatchEvent(new CustomEvent('foldersUpdated'));
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to assign audit team');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Assign Members</h2>
        
        <div className="mb-4">
          <p className="text-gray-700 mb-2">
            <strong>Folder:</strong> {folderName}
          </p>
          <p className="text-sm text-gray-600">
            Select one or more faculty members for this course folder audit (HOD is excluded).
          </p>
        </div>

        {teams.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Use Saved Team</label>
            <div className="flex items-center gap-2">
              <select
                className="flex-1 border rounded px-3 py-2"
                value={selectedTeamId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedTeamId(val);
                  const team = teams.find((t) => t.id === val);
                  if (team) {
                    // Only keep IDs available in current member list
                    const availableIds = new Set(auditTeamMembers.map((m) => m.id));
                    const filtered = team.memberIds.filter((id) => availableIds.has(id));
                    setSelectedAuditors(filtered);
                  }
                }}
              >
                <option value="">Select a team…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {selectedTeamId && (
                <button
                  className="px-3 py-2 border rounded hover:bg-gray-50"
                  onClick={() => { setSelectedTeamId(''); setSelectedAuditors([]); }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading audit team members...</p>
          </div>
        ) : (
          <>
            <div className="mb-4 max-h-64 overflow-y-auto border border-gray-300 rounded-md">
              {auditTeamMembers.length === 0 ? (
                <p className="p-4 text-gray-600 text-center">No audit team members available</p>
              ) : (
                auditTeamMembers.map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAuditors.includes(member.id)}
                      onChange={() => handleToggleAuditor(member.id)}
                      className="mr-3 h-5 w-5 text-blue-600"
                    />
                    <div>
                      <p className="font-medium">{member.full_name}</p>
                      <p className="text-sm text-gray-600">CNIC: {member.cnic}</p>
                    </div>
                  </label>
                ))
              )}
            </div>

            {selectedAuditors.length > 0 && (
              <p className="text-sm text-blue-600 mb-4">
                {selectedAuditors.length} auditor{selectedAuditors.length > 1 ? 's' : ''} selected
              </p>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleAssign}
                disabled={isSubmitting || selectedAuditors.length === 0}
                className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Assigning…' : 'Assign Members'}
              </button>
              
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
