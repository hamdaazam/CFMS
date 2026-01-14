import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { termsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Term {
  id: number;
  session_term: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export const CreateTerm: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sessionTerm, setSessionTerm] = useState('');
  const [startingDate, setStartingDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [previousTerms, setPreviousTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPrevious, setShowPrevious] = useState(true);
  const [sessionTermError, setSessionTermError] = useState<string | undefined>();
  const titlePattern = useMemo(() => /^[A-Za-z0-9][A-Za-z0-9 _.-]*$/, []);

  useEffect(() => {
    fetchTerms();
  }, []);

  const fetchTerms = async () => {
    try {
      const response = await termsAPI.getAll({ is_active: false });
      console.log('Terms API response:', response.data);
      // Handle both array and paginated response
      const termsData = Array.isArray(response.data) ? response.data : response.data.results || [];
      setPreviousTerms(termsData);
    } catch (err) {
      console.error('Error fetching terms:', err);
    }
  };

  const handleCreateTerm = async () => {
    setError('');
    setSuccessMessage('');
    setLoading(true);

    // Validation
    const sanitizedSession = sessionTerm.replace(/\s{2,}/g, ' ').trim();
    if (!sanitizedSession || !startingDate || !endDate) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    if (!titlePattern.test(sanitizedSession)) {
      setError('Session term can only contain letters, numbers, spaces, dash, underscore and dot (must start with a letter/number).');
      setLoading(false);
      return;
    }

    if (new Date(startingDate) >= new Date(endDate)) {
      setError('End date must be after start date');
      setLoading(false);
      return;
    }

    try {
      await termsAPI.create({
        session_term: sanitizedSession,
        start_date: startingDate,
        end_date: endDate,
        is_active: true,
      });
      
      setSuccessMessage('Term created successfully!');
  setSessionTerm('');
      setStartingDate('');
      setEndDate('');
      setIsModalOpen(false);
      fetchTerms(); // Refresh the list
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error('Error creating term:', err.response);
      const errorMsg = err.response?.data?.detail 
        || err.response?.data?.non_field_errors?.[0]
        || err.response?.data?.session_term?.[0]
        || err.response?.data?.start_date?.[0]
        || err.response?.data?.end_date?.[0]
        || 'Failed to create term';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout 
      userName={user?.full_name || 'User'}
      userAvatar={user?.profile_picture || undefined}
    >
      <div className="p-6 space-y-6">
        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-500/20 border border-green-500/50 text-green-700 px-4 py-3 rounded-lg">
            {successMessage}
          </div>
        )}

        {/* Create Term Card */}
        <div className="bg-gradient-to-r from-primary to-primary-dark rounded-lg p-8 text-white">
          <h2 className="text-2xl font-bold mb-4">Create Term</h2>
          <div className="flex gap-4">
            <Button 
              variant="coral"
              onClick={() => setIsModalOpen(true)}
            >
              Create
            </Button>
            <Button 
              variant="secondary"
              onClick={() => navigate('/terms/view')}
            >
              View All Terms
            </Button>
          </div>
        </div>

        {/* Previous Terms Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-header px-6 py-3 flex items-center justify-between">
            <h3 className="text-white font-semibold">Previous Terms</h3>
            <button
              onClick={() => setShowPrevious((s) => !s)}
              className="text-white hover:text-white/80"
              aria-label={showPrevious ? 'Collapse' : 'Expand'}
            >
              <svg className={`w-5 h-5 transition-transform ${showPrevious ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          
          {showPrevious && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Sr. No</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Session Term</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {previousTerms.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                      No previous terms found
                    </td>
                  </tr>
                ) : (
                  previousTerms.map((term, index) => (
                    <tr key={term.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{index + 1}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{term.session_term}</td>
                      <td className="px-6 py-4 text-sm">
                        <button 
                          onClick={() => navigate(`/terms/${term.id}`)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View
                        </button>
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

      {/* Create Term Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setError('');
        }}
        title="Create Term"
        maxWidth="md"
      >
        <div className="space-y-4">
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-700 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <Input
              label="Session Term (e.g., 241, Fall 2024)"
              value={sessionTerm}
              onChange={(e) => {
                const raw = e.target.value;
                // Sanitize: allow letters, numbers, spaces, dash, underscore and dot
                const sanitized = raw.replace(/[^A-Za-z0-9 _.-]/g, '').replace(/\s{2,}/g, ' ');
                setSessionTerm(sanitized);
                if (sanitized && !titlePattern.test(sanitized.trim())) {
                  setSessionTermError('Only letters, numbers, spaces, dash, underscore and dot. Must start with a letter/number.');
                } else {
                  setSessionTermError(undefined);
                }
              }}
              placeholder="Enter session term"
              required
            />
            {sessionTermError && (
              <p className="mt-1 text-xs text-red-600">{sessionTermError}</p>
            )}
            {!sessionTermError && sessionTerm && (
              <p className="mt-1 text-[11px] text-gray-500">Allowed: letters, numbers, spaces, - _ . (start with a letter/number)</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Starting date"
              type="date"
              value={startingDate}
              onChange={(e) => setStartingDate(e.target.value)}
              required
            />
            <Input
              label="End date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-center pt-4">
            <Button 
              variant="coral" 
              onClick={handleCreateTerm}
              disabled={loading || Boolean(sessionTermError) || !sessionTerm || !startingDate || !endDate}
            >
              {loading ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
};
