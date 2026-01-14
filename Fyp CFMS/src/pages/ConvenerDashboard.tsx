import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { HeroBanner } from '../components/common/HeroBanner';
import { useAuth } from '../context/AuthContext';
import { courseFoldersAPI, usersAPI, folderDeadlinesAPI } from '../services/api';
import { AuditAssignmentModal } from '../components/modals/AuditAssignmentModal';
import { ConvenerReviewModal } from '../components/modals/ConvenerReviewModal';
import { DeadlineModal } from '../components/modals/DeadlineModal';
import { BookOpen, Clock, CheckCircle, FileCheck, Users, AlertCircle, Calendar, Edit, Trash2 } from 'lucide-react';

interface CourseFolder {
  id: number;
  course?: { code?: string; title?: string } | null;
  course_details?: { code?: string; title?: string } | null;
  section?: string | null;
  faculty?: { user?: { full_name?: string } } | null;
  faculty_name?: string | null;
  term_name?: string | null;
  program_name?: string | null;
  status: string;
  submitted_at?: string | null;
  assigned_auditors?: Array<{ id: number; name: string; cnic: string }> | null;
}

export const ConvenerDashboard = () => {
  const { user } = useAuth();
  const [folders, setFolders] = useState<CourseFolder[]>([]);
  const [myFolders, setMyFolders] = useState<CourseFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<CourseFolder | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
  
  // Capability-based coordinator module
  const canUseCoordinatorModule = !!user?.has_coordinator_access;
  const [coordinatorFolders, setCoordinatorFolders] = useState<CourseFolder[]>([]);

  const fetchCoordinatorFolders = async () => {
    if (!canUseCoordinatorModule || !user) return;
    try {
      const response = await courseFoldersAPI.getAll({ assigned_to_me: 1 });
      const data = response.data;
      let foldersList: CourseFolder[] = [];
      if (Array.isArray(data)) {
        foldersList = data;
      } else if (data && Array.isArray(data.results)) {
        foldersList = data.results;
      }
      setCoordinatorFolders(foldersList);
    } catch (error) {
      console.error('Failed to fetch coordinator folders:', error);
      setCoordinatorFolders([]);
    }
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return; // Wait for user to load
    }
    fetchFolders();
    fetchMyFolders();
    fetchCoordinatorFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchFolders = async () => {
    try {
      setLoading(true);
      const response = await courseFoldersAPI.getAll();
      const data = response.data;
      // Normalize to array
      let foldersList: CourseFolder[] = [];
      if (Array.isArray(data)) {
        foldersList = data;
      } else if (data && Array.isArray(data.results)) {
        foldersList = data.results;
      } else if (data && data.results === undefined && Object.keys(data).length > 0) {
        // Handle case where data is an object but not paginated
        foldersList = [data];
      }
      setFolders(foldersList);
    } catch (error) {
      console.error('Failed to fetch folders:', error);
      setFolders([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const fetchMyFolders = async () => {
    try {
      const response = await courseFoldersAPI.getMyFolders();
      const data = response.data;
      setMyFolders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch my folders:', error);
      setMyFolders([]);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      'APPROVED_COORDINATOR': { color: 'bg-yellow-100 text-yellow-800', label: 'Awaiting Audit Assignment' },
      'UNDER_AUDIT': { color: 'bg-blue-100 text-blue-800', label: 'Under Audit' },
      'AUDIT_COMPLETED': { color: 'bg-purple-100 text-purple-800', label: 'Audit Completed' },
      'SUBMITTED_TO_HOD': { color: 'bg-green-100 text-green-800', label: 'Submitted to HOD' },
      'REJECTED_BY_CONVENER': { color: 'bg-red-100 text-red-800', label: 'Rejected' },
    };

    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${config.color}`}>
        {config.label}
      </span>
    );
  };

  // Inline mini team picker per-row
  const MiniTeamPicker: React.FC<{ folderId: number; onAssigned: () => void }> = ({ folderId, onAssigned }) => {
    const [members, setMembers] = useState<{ id: number; full_name: string }[]>([]);
    const [selected, setSelected] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
      const load = async () => {
        setLoading(true);
        setErr(null);
        try {
          // Fetch all users in the department
          const res = await usersAPI.getAll({ department: user?.department as any });
          const allUsers = (res.data?.results || res.data || []) as any[];
          
          if (!Array.isArray(allUsers)) {
            throw new Error('Invalid response format');
          }
          
          // Filter for audit team members:
          // 1. Users with explicit audit roles (AUDIT_MEMBER, AUDIT_TEAM, EVALUATOR)
          // 2. Users with has_audit_access capability flag (capability-based audit access)
          const auditRoles = ['AUDIT_MEMBER', 'AUDIT_TEAM', 'EVALUATOR'];
          const filtered = allUsers.filter((u: any) => {
            const userRole = String(u.role || '').toUpperCase();
            return (auditRoles.includes(userRole) || u.has_audit_access === true) 
              && userRole !== 'HOD';
          });
          
          setMembers(filtered.map((u: any) => ({ id: u.id, full_name: u.full_name })));
        } catch (e: any) {
          console.error('Failed to load audit team:', e);
          setErr(e?.response?.data?.error || 'Failed to load team');
        } finally {
          setLoading(false);
        }
      };
      load();
    }, []);

    const toggleSel = (id: number) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

    const assignNow = async () => {
      if (selected.length === 0) return;
      setAssigning(true);
      setErr(null);
      try {
        await courseFoldersAPI.assignAudit(folderId, { auditor_ids: selected });
        onAssigned();
        // Notify auditors to reload their assigned folders
        window.dispatchEvent(new CustomEvent('foldersUpdated'));
        setSelected([]);
      } catch (e: any) {
        setErr(e?.response?.data?.error || 'Failed to assign');
      } finally {
        setAssigning(false);
      }
    };

    return (
      <div className="flex items-center gap-2">
        <div className="relative">
          {loading ? (
            <span className="text-xs text-gray-500">Loading…</span>
          ) : members.length === 0 ? (
            <span className="text-xs text-gray-500">No team</span>
          ) : (
            <div className="flex flex-wrap gap-1 max-w-[220px]">
              {members.slice(0, 4).map((m) => (
                <button
                  key={m.id}
                  onClick={() => toggleSel(m.id)}
                  className={`px-2 py-1 rounded-full text-xs border ${selected.includes(m.id) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300'}`}
                  title={m.full_name}
                >
                  {m.full_name.split(' ').slice(0, 2).join(' ')}
                </button>
              ))}
              {members.length > 4 && (
                <span className="text-xs text-gray-500">+{members.length - 4} more</span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={assignNow}
          disabled={assigning || selected.length === 0}
          className="px-3 py-1 rounded bg-purple-600 text-white text-xs disabled:opacity-50"
        >
          {assigning ? 'Assigning…' : 'Quick Assign'}
        </button>
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
    );
  };

  // Tiny badges for per-auditor status in Audit Completed
  const AuditBadges: React.FC<{ folderId: number }> = ({ folderId }) => {
    const [items, setItems] = useState<{ id: number; auditor: { id: number; name: string }; submitted: boolean; decision: string | null }[]>([]);
    useEffect(() => {
      let mounted = true;
      (async () => {
        try {
          const res = await courseFoldersAPI.getAuditReports(folderId);
          const arr = (res.data?.assignments || []) as any[];
          if (mounted) setItems(arr);
        } catch { }
      })();
      return () => { mounted = false; };
    }, [folderId]);
    const badge = (a: any) => {
      const d = (a.decision || '').toUpperCase();
      const submitted = !!a.submitted;
      const color = d === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : d === 'REJECTED' ? 'bg-red-100 text-red-700' : submitted ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700';
      const text = d === 'APPROVED' ? 'A' : d === 'REJECTED' ? 'R' : submitted ? 'S' : 'P';
      return (
        <span key={a.id} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${color}`} title={`${a.auditor?.name || 'Auditor'}: ${d || (submitted ? 'SUBMITTED' : 'PENDING')}`}>{text}</span>
      );
    };
    if (!items.length) return null;
    return <div className="flex gap-1 flex-wrap">{items.map(badge)}</div>;
  };

  // Filter with defensive checks (no dependency on nested course now)
  const needsAuditAssignment = folders.filter(f => f && f.status === 'APPROVED_COORDINATOR');
  const underAudit = folders.filter(f => f && f.status === 'UNDER_AUDIT');
  const auditCompleted = folders.filter(f => f && f.status === 'AUDIT_COMPLETED');

  // My Courses stats (convener teaching folders)
  const myPendingFolders = myFolders.filter(f => f && !['SUBMITTED', 'UNDER_REVIEW_BY_COORDINATOR', 'APPROVED_COORDINATOR', 'UNDER_AUDIT', 'AUDIT_COMPLETED', 'SUBMITTED_TO_HOD', 'UNDER_REVIEW_BY_HOD', 'APPROVED_BY_HOD', 'COMPLETED'].includes(f.status));
  const myCompletedFolders = myFolders.filter(f => f && ['COMPLETED', 'SUBMITTED', 'UNDER_REVIEW_BY_COORDINATOR', 'APPROVED_COORDINATOR', 'UNDER_AUDIT', 'AUDIT_COMPLETED', 'SUBMITTED_TO_HOD', 'UNDER_REVIEW_BY_HOD', 'APPROVED_BY_HOD'].includes(f.status));
  const mySubmittedFolders = myFolders.filter(f => f && ['SUBMITTED', 'UNDER_REVIEW_BY_COORDINATOR', 'APPROVED_COORDINATOR', 'UNDER_AUDIT', 'AUDIT_COMPLETED', 'SUBMITTED_TO_HOD', 'UNDER_REVIEW_BY_HOD', 'APPROVED_BY_HOD'].includes(f.status));

  // Don't render until user is loaded
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <DashboardLayout
      userName={user?.full_name || 'Convener'}
      userAvatar={user?.profile_picture || undefined}
    >
      <div className="p-6 space-y-6">
        {/* Header using unified HeroBanner */}
        <HeroBanner>
          <div className="flex flex-col items-center justify-center py-6">
            <div className="w-24 h-24 rounded-full bg-white overflow-hidden mb-4 border-4 border-white shadow-lg flex items-center justify-center">
              {user?.profile_picture ? (
                <img
                  src={user.profile_picture}
                  alt={user.full_name || 'Convener'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl font-bold text-primary">
                  {user?.full_name?.charAt(0) || 'C'}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold mb-1">{user?.full_name || 'Convener'}</h1>
            <p className="text-white/90 text-sm">Designation: CONVENER</p>
            <p className="text-white/80 text-xs mt-1">Manage audit assignments and review reports</p>
          </div>
        </HeroBanner>

        {/* My Courses Stats */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <BookOpen className="w-5 h-5 mr-2 text-blue-600" />
              My Courses
            </h2>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
              TEACHING ROLE
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Pending Folders</p>
                  <h3 className="text-3xl font-bold text-gray-900 mt-2">{myPendingFolders.length}</h3>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-orange-600 font-medium bg-orange-50 px-2 py-0.5 rounded text-xs">In Progress</span>
                <span className="text-gray-400 mx-2">•</span>
                <span className="text-gray-500">Teaching</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Completed Folders</p>
                  <h3 className="text-3xl font-bold text-gray-900 mt-2">{myCompletedFolders.length}</h3>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded text-xs">Ready</span>
                <span className="text-gray-400 mx-2">•</span>
                <span className="text-gray-500">Submitted</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Submitted Folders</p>
                  <h3 className="text-3xl font-bold text-gray-900 mt-2">{mySubmittedFolders.length}</h3>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <FileCheck className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded text-xs">Under Review</span>
                <span className="text-gray-400 mx-2">•</span>
                <span className="text-gray-500">Awaiting approval</span>
              </div>
            </div>
          </div>
        </div>

        {/* Coordinator Module (if enabled) */}
        {canUseCoordinatorModule && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <FileCheck className="w-5 h-5 mr-2 text-indigo-600" />
                Course Coordinator
              </h2>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                COORDINATOR ROLE
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Pending Review</p>
                    <h3 className="text-3xl font-bold text-gray-900 mt-2">
                      {coordinatorFolders.filter(f => f.status === 'SUBMITTED').length}
                    </h3>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
                <div className="mt-4">
                  <Link to="/coordinator/review" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                    Review Now →
                  </Link>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Approved</p>
                    <h3 className="text-3xl font-bold text-gray-900 mt-2">
                      {coordinatorFolders.filter(f => f.status === 'APPROVED_COORDINATOR').length}
                    </h3>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Returned</p>
                    <h3 className="text-3xl font-bold text-gray-900 mt-2">
                      {coordinatorFolders.filter(f => f.status === 'REJECTED_COORDINATOR').length}
                    </h3>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submission Deadlines Management */}
        <DeadlineManagementSection user={user} />

        {/* Review Courses / Convener Responsibilities Stats */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <Users className="w-5 h-5 mr-2 text-purple-600" />
              Review Courses
            </h2>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100">
              CONVENER ROLE
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Awaiting Assignment</p>
                  <h3 className="text-3xl font-bold text-gray-900 mt-2">{needsAuditAssignment.length}</h3>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-yellow-600 font-medium bg-yellow-50 px-2 py-0.5 rounded text-xs">Action Required</span>
                <span className="text-gray-400 mx-2">•</span>
                <span className="text-gray-500">Assign Audit Team</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Under Audit</p>
                  <h3 className="text-3xl font-bold text-gray-900 mt-2">{underAudit.length}</h3>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded text-xs">In Progress</span>
                <span className="text-gray-400 mx-2">•</span>
                <span className="text-gray-500">Being reviewed</span>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Audit Completed</p>
                  <h3 className="text-3xl font-bold text-gray-900 mt-2">{auditCompleted.length}</h3>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-purple-600 font-medium bg-purple-50 px-2 py-0.5 rounded text-xs">Ready</span>
                <span className="text-gray-400 mx-2">•</span>
                <span className="text-gray-500">Final Review</span>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading folders...</p>
          </div>
        ) : (
          <>
            {/* Folders Awaiting Audit Assignment */}
            {needsAuditAssignment.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4 text-yellow-900">
                  📋 Folders Awaiting Audit Assignment ({needsAuditAssignment.length})
                </h2>
                <div className="space-y-3">
                  {needsAuditAssignment.map((folder) => {
                    const course = folder.course || folder.course_details || {};
                    const code = (course as any).code || 'N/A';
                    const title = (course as any).title || 'Unknown Course';
                    const section = folder.section || 'N/A';
                    const facultyName = folder.faculty_name || folder.faculty?.user?.full_name || 'Unknown';
                    const term = folder.term_name || 'N/A';
                    const program = folder.program_name || 'N/A';
                    return (
                      <div key={folder.id} className="border border-yellow-200 rounded-lg p-4 hover:bg-yellow-50 transition">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">
                              {code} - {title}
                            </h3>
                            <p className="text-gray-600 text-sm">Section: {section} • Faculty: {facultyName} • Term {term} • Program {program}</p>
                            <p className="text-gray-500 text-xs mt-1">
                              Submitted: {folder.submitted_at ? new Date(folder.submitted_at).toLocaleDateString() : 'N/A'}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {getStatusBadge(folder.status)}
                            {/* Inline quick team picker */}
                            <MiniTeamPicker folderId={folder.id} onAssigned={fetchFolders} />
                            <button
                              onClick={() => {
                                setSelectedFolder(folder);
                                setShowAssignModal(true);
                              }}
                              className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 text-sm"
                            >
                              Assign Audit Team
                            </button>
                            <button
                              onClick={() => setExpandedRowId(expandedRowId === folder.id ? null : folder.id)}
                              className="text-xs text-gray-600 underline"
                            >
                              {expandedRowId === folder.id ? 'Hide details' : 'View details'}
                            </button>
                          </div>
                        </div>
                        {expandedRowId === folder.id && (
                          <div className="mt-3 text-sm text-gray-700">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              <div><span className="font-semibold">Course:</span> {(folder.course?.title || folder.course_details?.title || 'Unknown')}</div>
                              <div><span className="font-semibold">Term:</span> {folder.term_name || 'N/A'}</div>
                              <div><span className="font-semibold">Program:</span> {folder.program_name || 'N/A'}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Audit Completed - Ready for Review */}
            {auditCompleted.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4 text-purple-900">
                  ✅ Audit Completed - Review & Forward ({auditCompleted.length})
                </h2>
                <div className="space-y-3">
                  {auditCompleted.map((folder) => {
                    const course = folder.course || folder.course_details || {};
                    const code = (course as any).code || 'N/A';
                    const title = (course as any).title || 'Unknown Course';
                    const section = folder.section || 'N/A';
                    const facultyName = folder.faculty_name || folder.faculty?.user?.full_name || 'Unknown';
                    const term = folder.term_name || 'N/A';
                    const program = folder.program_name || 'N/A';
                    return (
                      <div key={folder.id} className="border border-purple-200 rounded-lg p-4 hover:bg-purple-50 transition">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">
                              {code} - {title}
                            </h3>
                            <p className="text-gray-600 text-sm">Section: {section} • Faculty: {facultyName} • Term {term} • Program {program}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {getStatusBadge(folder.status)}
                            {/* Per-auditor badges */}
                            <AuditBadges folderId={folder.id} />
                            <a
                              href={`/convener/folders/${folder.id}/reports`}
                              className="bg-purple-100 text-purple-800 px-4 py-2 rounded-md hover:bg-purple-200 text-sm text-center"
                            >
                              Open Reports
                            </a>
                            <button
                              onClick={() => {
                                setSelectedFolder(folder);
                                setShowReviewModal(true);
                              }}
                              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
                            >
                              Review & Forward
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Under Audit */}
            {underAudit.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4 text-blue-900">
                  🔍 Under Audit ({underAudit.length})
                </h2>
                <div className="space-y-3">
                  {underAudit.map((folder) => {
                    const course = folder.course || folder.course_details || {};
                    const code = (course as any).code || 'N/A';
                    const title = (course as any).title || 'Unknown Course';
                    const section = folder.section || 'N/A';
                    const facultyName = folder.faculty_name || folder.faculty?.user?.full_name || 'Unknown';
                    const term = folder.term_name || 'N/A';
                    const program = folder.program_name || 'N/A';
                    const auditors = folder.assigned_auditors || [];
                    
                    return (
                      <div key={folder.id} className="border border-blue-200 rounded-lg p-4 hover:bg-blue-50 transition">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">
                              {code} - {title}
                            </h3>
                            <p className="text-gray-600 text-sm">Section: {section} • Faculty: {facultyName} • Term {term} • Program {program}</p>
                            {auditors.length > 0 && (
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
                                  Assigned to:
                                </span>
                                <span className="text-sm text-gray-700">
                                  {auditors.map(a => a.name).join(', ')}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {getStatusBadge(folder.status)}
                            <AuditBadges folderId={folder.id} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {folders.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p>No folders found</p>
              </div>
            )}
          </>
        )}

        {/* Modals */}
        {selectedFolder && (
          <>
            <AuditAssignmentModal
              isOpen={showAssignModal}
              onClose={() => {
                setShowAssignModal(false);
                setSelectedFolder(null);
              }}
              folderId={selectedFolder.id}
              folderName={`${(selectedFolder.course?.code || selectedFolder.course_details?.code || 'N/A')} - ${(selectedFolder.section || 'N/A')}`}
              onSuccess={fetchFolders}
            />

            <ConvenerReviewModal
              isOpen={showReviewModal}
              onClose={() => {
                setShowReviewModal(false);
                setSelectedFolder(null);
              }}
              folderId={selectedFolder.id}
              folderName={`${(selectedFolder.course?.code || selectedFolder.course_details?.code || 'N/A')} - ${(selectedFolder.section || 'N/A')}`}
              onSuccess={fetchFolders}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

// Deadline Management Section Component
interface DeadlineManagementSectionProps {
  user: any;
}

const DeadlineManagementSection: React.FC<DeadlineManagementSectionProps> = ({ user }) => {
  const [deadlines, setDeadlines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState<any | null>(null);

  useEffect(() => {
    loadDeadlines();
  }, []);

  const loadDeadlines = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (user?.department) {
        params.department = user.department;
      }
      const response = await folderDeadlinesAPI.getAll(params);
      const data = Array.isArray(response.data) ? response.data : (response.data?.results || []);
      setDeadlines(data);
    } catch (err: any) {
      console.error('Failed to load deadlines:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDeadline = () => {
    setEditingDeadline(null);
    setShowModal(true);
  };

  const handleEditDeadline = (deadline: any) => {
    setEditingDeadline(deadline);
    setShowModal(true);
  };

  const handleDeleteDeadline = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this deadline? This action cannot be undone.')) {
      return;
    }

    try {
      await folderDeadlinesAPI.delete(id);
      loadDeadlines();
    } catch (err: any) {
      console.error('Failed to delete deadline:', err);
      alert(err.response?.data?.error || 'Failed to delete deadline');
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const firstSubmissionDeadlines = deadlines.filter(d => d.deadline_type === 'FIRST_SUBMISSION');
  const finalSubmissionDeadlines = deadlines.filter(d => d.deadline_type === 'FINAL_SUBMISSION');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center">
          <Calendar className="w-5 h-5 mr-2 text-indigo-600" />
          Submission Deadlines
        </h2>
        <button
          onClick={handleCreateDeadline}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium flex items-center gap-2"
        >
          <Calendar className="w-4 h-4" />
          Set Deadline
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading deadlines...</div>
      ) : deadlines.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p>No deadlines set yet. Click "Set Deadline" to create one.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* First Submission Deadlines */}
          {firstSubmissionDeadlines.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">First Submission (After Midterm)</h3>
              <div className="space-y-2">
                {firstSubmissionDeadlines.map((deadline) => (
                  <div
                    key={deadline.id}
                    className={`border rounded-lg p-4 flex items-center justify-between ${
                      deadline.is_passed ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{deadline.term_name || 'Term'}</span>
                        {deadline.department_name && (
                          <span className="text-xs text-gray-600">({deadline.department_name})</span>
                        )}
                        {deadline.is_passed ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                            Passed
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700">
                        Deadline: <span className="font-medium">{formatDateTime(deadline.deadline_date)}</span>
                      </p>
                      {deadline.notes && (
                        <p className="text-xs text-gray-600 mt-1 italic">{deadline.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleEditDeadline(deadline)}
                        className="p-2 text-indigo-600 hover:bg-indigo-100 rounded transition-colors"
                        title="Edit deadline"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDeadline(deadline.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded transition-colors"
                        title="Delete deadline"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Final Submission Deadlines */}
          {finalSubmissionDeadlines.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Final Submission (After Final Term)</h3>
              <div className="space-y-2">
                {finalSubmissionDeadlines.map((deadline) => (
                  <div
                    key={deadline.id}
                    className={`border rounded-lg p-4 flex items-center justify-between ${
                      deadline.is_passed ? 'bg-red-50 border-red-200' : 'bg-purple-50 border-purple-200'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{deadline.term_name || 'Term'}</span>
                        {deadline.department_name && (
                          <span className="text-xs text-gray-600">({deadline.department_name})</span>
                        )}
                        {deadline.is_passed ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                            Passed
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700">
                        Deadline: <span className="font-medium">{formatDateTime(deadline.deadline_date)}</span>
                      </p>
                      {deadline.notes && (
                        <p className="text-xs text-gray-600 mt-1 italic">{deadline.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleEditDeadline(deadline)}
                        className="p-2 text-indigo-600 hover:bg-indigo-100 rounded transition-colors"
                        title="Edit deadline"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDeadline(deadline.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded transition-colors"
                        title="Delete deadline"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <DeadlineModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingDeadline(null);
        }}
        onSuccess={() => {
          loadDeadlines();
          setShowModal(false);
          setEditingDeadline(null);
        }}
        deadline={editingDeadline}
        departmentId={user?.department}
      />
    </div>
  );
};
