import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/common/Button';
import { ChevronUp } from 'lucide-react';
import { termsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Term {
  id: number;
  session_term: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export const ViewCreatedTerms: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sessionTerms, setSessionTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Initialize filter from query param synchronously to avoid double-fetch race
  const initialFilter = useMemo(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('active') === 'true') return 'active' as const;
    if (params.get('inactive') === 'true') return 'inactive' as const;
    return 'all' as const;
  }, [location.search]);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>(initialFilter);
  const requestIdRef = useRef(0);

  useEffect(() => {
    // When the URL query changes, sync the filter from it
    setFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    fetchTerms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const fetchTerms = async () => {
    try {
      const currentId = ++requestIdRef.current;
      setLoading(true);
      const params: any = {};
      if (filter !== 'all') {
        params.is_active = filter === 'active';
      }
      const response = await termsAPI.getAll(params);
      console.log('Terms API response:', response.data);
      // Handle both array and paginated response
      const termsData = Array.isArray(response.data) ? response.data : response.data.results || [];
      if (currentId === requestIdRef.current) {
        setSessionTerms(termsData);
        setError('');
      }
    } catch (err) {
      // Only set error if this request is the latest
      if (requestIdRef.current) {
        setError('Failed to fetch terms');
      }
      console.error('Error fetching terms:', err);
    } finally {
      // Only clear loading if this request is the latest
      if (requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleDelete = async (termId: number) => {
    if (!window.confirm('Are you sure you want to delete this term?')) {
      return;
    }

    try {
      await termsAPI.delete(termId);
      setSuccessMessage('Term deleted successfully!');
      fetchTerms(); // Refresh the list
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete term');
      setTimeout(() => setError(''), 3000);
    }
  };

  const filteredTerms = sessionTerms.filter(term =>
    term.session_term.toLowerCase().includes(searchQuery.toLowerCase()) ||
    new Date(term.start_date).toLocaleDateString().includes(searchQuery) ||
    new Date(term.end_date).toLocaleDateString().includes(searchQuery)
  );

  return (
    <DashboardLayout 
      userName={user?.full_name || 'User'}
      userAvatar={user?.profile_picture || undefined}
    >
      <div className="p-6 space-y-6">
        {/* Success/Error Messages */}
        {successMessage && (
          <div className="bg-green-500/20 border border-green-500/50 text-green-700 px-4 py-3 rounded-lg">
            {successMessage}
          </div>
        )}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Create Session Term Card */}
        <div className="bg-gradient-to-r from-primary to-primary-dark rounded-lg p-6 text-white">
          <h2 className="text-lg font-bold mb-3">Create Session Term</h2>
          <Button variant="coral" onClick={() => navigate('/terms/create')} className="px-6 py-2 text-sm">
            Create
          </Button>
        </div>

        {/* Session Term Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-primary px-6 py-4 flex items-center justify-between text-white">
            <h3 className="font-semibold">Session Term</h3>
            <div className="flex items-center gap-3">
              <select
                className="text-sm text-gray-900 bg-white rounded px-2 py-1"
                value={filter}
                onChange={(e) => setFilter(e.target.value as 'all' | 'active' | 'inactive')}
                aria-label="Filter terms"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <button
                onClick={() => setCollapsed((c) => !c)}
                className="hover:bg-primary-dark p-1 rounded transition-colors"
                aria-label={collapsed ? 'Expand' : 'Collapse'}
              >
                <ChevronUp className={`w-5 h-5 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          {!collapsed && (
          <div className="p-4 border-b border-gray-200">
            <div className="relative max-w-md">
              <input
                type="text"
                placeholder="Search terms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <svg
                className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          )}

          {!collapsed && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Sr. No</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Session Term</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                      Loading terms...
                    </td>
                  </tr>
                ) : filteredTerms.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                      {searchQuery ? 'No terms found matching your search.' : 'No terms found. Create your first term!'}
                    </td>
                  </tr>
                ) : (
                  filteredTerms.map((term, index) => (
                    <tr key={term.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{index + 1}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                        <div>
                          <div>{term.session_term}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(term.start_date).toLocaleDateString()} - {new Date(term.end_date).toLocaleDateString()}
                          </div>
                          <span className={`inline-block mt-1 px-2 py-1 text-xs rounded-full ${
                            term.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {term.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-3">
                          <button
                            onClick={() => navigate(`/terms/edit/${term.id}`)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(term.id)}
                            className="text-red-600 hover:text-red-800 font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};
