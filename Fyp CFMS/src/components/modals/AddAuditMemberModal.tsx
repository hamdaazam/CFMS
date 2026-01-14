import React, { useMemo, useState, useEffect } from 'react';
import { authAPI, facultyAPI, usersAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Search, UserPlus, X } from 'lucide-react';

interface FacultyMember {
  id: number;
  user_details?: {
    id: number;
    full_name: string;
    email: string;
    cnic: string;
  };
  user?: {
    id: number;
    full_name: string;
    email: string;
    cnic: string;
  };
  department: number;
  designation: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (userId: number) => void;
}

export const AddAuditMemberModal: React.FC<Props> = ({ isOpen, onClose, onCreated }) => {
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [cnic, setCnic] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Faculty list state
  const [facultyList, setFacultyList] = useState<FacultyMember[]>([]);
  const [loadingFaculty, setLoadingFaculty] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFacultyList, setShowFacultyList] = useState(true);
  const [selectedFaculty, setSelectedFaculty] = useState<FacultyMember | null>(null);
  const [manualMode, setManualMode] = useState(false);

  const departmentId = user?.department || undefined;

  // Fetch faculty members list
  useEffect(() => {
    if (isOpen && departmentId) {
      fetchFacultyList();
    }
  }, [isOpen, departmentId]);

  const fetchFacultyList = async () => {
    setLoadingFaculty(true);
    try {
      const response = await facultyAPI.getAll({ 
        department: departmentId,
        is_active: true 
      });
      const data = Array.isArray(response.data) ? response.data : (response.data?.results || []);
      setFacultyList(data);
    } catch (err) {
      console.error('Error fetching faculty list:', err);
      setFacultyList([]);
    } finally {
      setLoadingFaculty(false);
    }
  };

  // Filter faculty based on search query
  const filteredFaculty = useMemo(() => {
    if (!searchQuery.trim()) return facultyList;
    const query = searchQuery.toLowerCase();
    return facultyList.filter(f => {
      const user = f.user_details || f.user;
      if (!user) return false;
      return (
        user.full_name.toLowerCase().includes(query) ||
        (user.email || '').toLowerCase().includes(query) ||
        (user.cnic || '').includes(query)
      );
    });
  }, [facultyList, searchQuery]);

  // Handle faculty selection
  const handleSelectFaculty = (faculty: FacultyMember) => {
    setSelectedFaculty(faculty);
    const user = faculty.user_details || faculty.user;
    if (user) {
      setFullName(user.full_name);
      setCnic(user.cnic || '');
      setEmail(user.email || '');
      // Default password (must satisfy min length requirement)
      setPassword('Cust12345');
    }
    setShowFacultyList(false);
    setManualMode(false);
  };

  // Handle manual mode toggle
  const handleManualMode = () => {
    setManualMode(true);
    setShowFacultyList(false);
    setSelectedFaculty(null);
    setFullName('');
    setCnic('');
    setEmail('');
    setPassword('');
  };

  // Handle back to list
  const handleBackToList = () => {
    setManualMode(false);
    setShowFacultyList(true);
    setSelectedFaculty(null);
    setFullName('');
    setCnic('');
    setEmail('');
    setPassword('');
    setSearchQuery('');
  };

  const canSubmit = useMemo(() => {
    return fullName.trim().length > 0 && cnic.trim().length === 13 && password.length >= 8;
  }, [fullName, cnic, password]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      // If a faculty member is selected, that user already exists (CNIC is unique).
      // In that case, convert the existing user to AUDIT_MEMBER instead of registering again.
      if (selectedFaculty) {
        const selectedUser = selectedFaculty.user_details || selectedFaculty.user;
        const selectedUserId = selectedUser?.id;
        if (selectedUserId) {
          const patched = await usersAPI.partialUpdate(selectedUserId, {
            role: 'AUDIT_MEMBER',
            department: departmentId,
          });
          const updatedUserId = patched.data?.id || selectedUserId;
          setSuccess('Existing faculty user assigned as Audit Member successfully');
          if (onCreated && updatedUserId) onCreated(updatedUserId);
        } else {
          throw new Error('Selected faculty user not found');
        }
      } else {
        const res = await authAPI.register({
          full_name: fullName.trim(),
          cnic: cnic.trim(),
          email: email || undefined,
          password,
          password_confirm: password,
          role: 'AUDIT_MEMBER',
          department: departmentId,
        });
        const newUserId = res.data?.user?.id;
        setSuccess('Audit member created successfully');
        if (onCreated && newUserId) onCreated(newUserId);
      }
      setTimeout(() => {
        setSuccess(null);
        onClose();
        setFullName(''); setCnic(''); setEmail(''); setPassword('');
        setSelectedFaculty(null);
        setShowFacultyList(true);
        setManualMode(false);
        setSearchQuery('');
        // Refresh faculty list after creation
        if (departmentId) {
          fetchFacultyList();
        }
      }, 1000);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.cnic?.[0] ||
        err?.response?.data?.email?.[0] ||
        err?.response?.data?.password?.[0] ||
        err?.message ||
        'Failed to create audit member';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] shadow-lg flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Create Audit Member</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {departmentId === undefined && (
            <div className="mb-4 p-3 rounded bg-amber-50 text-amber-800 border border-amber-200 text-sm">
              Note: Your profile has no department set. The member will be created without department.
            </div>
          )}

          {/* Faculty List View */}
          {showFacultyList && !manualMode && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                  Select a faculty member from the list to create an audit member, or add a new member manually.
                </p>
                <button
                  onClick={handleManualMode}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Add New Member
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search faculty by name, email, or CNIC..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Faculty List */}
              {loadingFaculty ? (
                <div className="text-center py-8 text-gray-500">Loading faculty members...</div>
              ) : filteredFaculty.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchQuery ? 'No faculty members found matching your search.' : 'No faculty members found in your department.'}
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredFaculty.map((faculty) => (
                    <div
                      key={faculty.id}
                      onClick={() => handleSelectFaculty(faculty)}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedFaculty?.id === faculty.id
                          ? 'bg-indigo-50 border-indigo-300'
                          : 'hover:bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          {(() => {
                            const user = faculty.user_details || faculty.user;
                            return user ? (
                              <>
                                <p className="font-medium text-gray-900">{user.full_name}</p>
                                <p className="text-sm text-gray-600">{user.email || 'No email'}</p>
                                <p className="text-xs text-gray-500">CNIC: {user.cnic || 'N/A'}</p>
                                <p className="text-xs text-gray-500">Designation: {faculty.designation || 'N/A'}</p>
                              </>
                            ) : null;
                          })()}
                        </div>
                        <button className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">
                          Select
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Manual Entry Form */}
          {(manualMode || selectedFaculty) && (
            <div className="space-y-4">
              {selectedFaculty && (() => {
                const user = selectedFaculty.user_details || selectedFaculty.user;
                return user ? (
                  <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <p className="text-sm text-indigo-800">
                      <strong>Selected:</strong> {user.full_name} ({user.email || 'No email'})
                    </p>
                    <p className="mt-1 text-xs text-indigo-700">
                      Note: CNIC is unique. Selecting a faculty member will assign their existing account as an Audit Member (no new user will be created).
                    </p>
                    <button
                      onClick={handleBackToList}
                      className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 underline"
                    >
                      Select different faculty member
                    </button>
                  </div>
                ) : null;
              })()}

              {manualMode && (
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-gray-600">Adding a new member manually</p>
                  <button
                    onClick={handleBackToList}
                    className="text-sm text-indigo-600 hover:text-indigo-800 underline"
                  >
                    ← Back to Faculty List
                  </button>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2"
                    placeholder="e.g., Ayesha Khan"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={!!selectedFaculty}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CNIC (13 digits)</label>
                  <input
                    type="text"
                    maxLength={13}
                    className="w-full border rounded px-3 py-2"
                    placeholder="3110223344556"
                    value={cnic}
                    onChange={(e) => setCnic(e.target.value.replace(/[^0-9]/g, ''))}
                    disabled={!!selectedFaculty}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email (optional)</label>
                  <input
                    type="email"
                    className="w-full border rounded px-3 py-2"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!!selectedFaculty}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    className="w-full border rounded px-3 py-2"
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  {selectedFaculty && (
                    <p className="mt-1 text-xs text-gray-500">Default password set (8+ chars). You can change it.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded">{error}</div>
          )}
          {success && (
            <div className="p-3 bg-green-100 border border-green-300 text-green-700 rounded">{success}</div>
          )}
        </div>

        {/* Footer with action buttons */}
        {(manualMode || selectedFaculty) && (
          <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
            <button 
              className="px-4 py-2 border rounded hover:bg-gray-50" 
              onClick={onClose} 
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded bg-purple-600 text-white disabled:opacity-50"
              disabled={!canSubmit || loading}
              onClick={handleSubmit}
            >
              {loading ? 'Creating…' : 'Create Member'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddAuditMemberModal;