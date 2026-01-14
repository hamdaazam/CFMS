import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/common/Button';
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

export const EditTerm: React.FC = () => {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [term, setTerm] = useState<Term | null>(null);
  const [sessionTerm, setSessionTerm] = useState('');
  const [startingDate, setStartingDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (id) {
      fetchTerm();
    }
  }, [id]);

  const fetchTerm = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const response = await termsAPI.getById(parseInt(id));
      console.log('Term to edit:', response.data);
      const termData = response.data;
      setTerm(termData);
      setSessionTerm(termData.session_term);
      setStartingDate(termData.start_date);
      setEndDate(termData.end_date);
      setIsActive(termData.is_active);
    } catch (err) {
      setError('Failed to fetch term details');
      console.error('Error fetching term:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    setError('');
    setSuccessMessage('');
    setSaving(true);

    // Validation
    if (!sessionTerm || !startingDate || !endDate) {
      setError('All fields are required');
      setSaving(false);
      return;
    }

    if (new Date(startingDate) >= new Date(endDate)) {
      setError('End date must be after start date');
      setSaving(false);
      return;
    }

    try {
      await termsAPI.partialUpdate(parseInt(id!), {
        session_term: sessionTerm,
        start_date: startingDate,
        end_date: endDate,
        is_active: isActive,
      });
      
      setSuccessMessage('Term updated successfully!');
      setTimeout(() => {
        navigate('/terms/view');
      }, 1500);
    } catch (err: any) {
      console.error('Error updating term:', err.response);
      const errorMsg = err.response?.data?.detail 
        || err.response?.data?.non_field_errors?.[0]
        || err.response?.data?.session_term?.[0]
        || err.response?.data?.start_date?.[0]
        || err.response?.data?.end_date?.[0]
        || 'Failed to update term';
      setError(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout userName={user?.full_name || 'User'}>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="text-gray-500">Loading term details...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (error && !term) {
    return (
      <DashboardLayout 
        userName={user?.full_name || 'User'}
        userAvatar={user?.profile_picture || undefined}
      >
        <div className="p-6">
          <div className="bg-red-500/20 border border-red-500/50 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
          <Button onClick={() => navigate('/terms/view')}>
            Back to Terms
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout userName={user?.full_name || 'User'}>
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

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Edit Term</h1>
          <Button variant="secondary" onClick={() => navigate('/terms/view')}>
            Back to Terms
          </Button>
        </div>

        {/* Edit Form Card */}
        <div className="bg-white rounded-lg shadow-md p-8 max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">
            Edit Session Term: {term?.session_term}
          </h2>

          <div className="space-y-6">
            {/* Session Term */}
            <Input
              label="Session Term (e.g., 241, 242)"
              value={sessionTerm}
              onChange={(e) => setSessionTerm(e.target.value)}
              placeholder="Enter session term"
              required
            />

            {/* Dates */}
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

            {/* Active Status */}
            <div>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-5 h-5 text-primary focus:ring-2 focus:ring-primary border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                  Mark as Active Term
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-8">
                Only one term should be active at a time
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4 border-t border-gray-200">
              <Button
                variant="coral"
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex-1"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate('/terms/view')}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
