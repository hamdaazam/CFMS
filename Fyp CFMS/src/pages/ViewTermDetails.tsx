import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/common/Button';
import { termsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Term {
  id: number;
  session_term: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export const ViewTermDetails: React.FC = () => {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [term, setTerm] = useState<Term | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTerm();
  }, [id]);

  const fetchTerm = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const response = await termsAPI.getById(parseInt(id));
      console.log('Term details:', response.data);
      setTerm(response.data);
    } catch (err) {
      setError('Failed to fetch term details');
      console.error('Error fetching term:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <DashboardLayout 
        userName={user?.full_name || 'User'}
        userAvatar={user?.profile_picture || undefined}
      >
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="text-gray-500">Loading term details...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !term) {
    return (
      <DashboardLayout 
        userName={user?.full_name || 'User'}
        userAvatar={user?.profile_picture || undefined}
      >
        <div className="p-6">
          <div className="bg-red-500/20 border border-red-500/50 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error || 'Term not found'}
          </div>
          <Button onClick={() => navigate('/terms')}>
            Back to Terms
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      userName={user?.full_name || 'User'}
      userAvatar={user?.profile_picture || undefined}
    >
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Term Details</h1>
          <Button variant="secondary" onClick={() => navigate('/terms')}>
            Back to Terms
          </Button>
        </div>

        {/* Term Details Card */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-primary-dark px-6 py-4">
            <h2 className="text-xl font-semibold text-white">
              Session Term: {term.session_term}
            </h2>
          </div>

          <div className="p-6 space-y-6">
            {/* Status Badge */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Status</label>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  term.is_active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {term.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            {/* Dates Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Starting Date
                </label>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-gray-900 font-medium">
                    {formatDate(term.start_date)}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  End Date
                </label>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-gray-900 font-medium">
                    {formatDate(term.end_date)}
                  </p>
                </div>
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Duration
              </label>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-gray-900 font-medium">
                  {Math.ceil(
                    (new Date(term.end_date).getTime() - new Date(term.start_date).getTime()) /
                      (1000 * 60 * 60 * 24)
                  )}{' '}
                  days
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4 border-t border-gray-200">
              <Button
                variant="primary"
                onClick={() => navigate(`/terms/edit/${term.id}`)}
              >
                Edit Term
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate('/terms/view')}
              >
                View All Terms
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
