import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Unauthorized: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleGoBack = () => {
    // Redirect to appropriate dashboard based on role
    switch (user?.role) {
      case 'ADMIN':
      case 'CONVENER':
        navigate('/admin/dashboard');
        break;
      case 'COORDINATOR':
        navigate('/coordinator/dashboard');
        break;
      case 'FACULTY':
        navigate('/faculty/dashboard');
        break;
      case 'SUPERVISOR':
        navigate('/supervisor/dashboard');
        break;
      case 'EVALUATOR':
        navigate('/evaluator/dashboard');
        break;
      case 'STUDENT':
        navigate('/student/dashboard');
        break;
      default:
        navigate('/login');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-100">
            <svg
              className="h-10 w-10 text-red-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Access Denied
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            You don't have permission to access this page.
          </p>
          {user && (
            <div className="mt-4 p-4 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Logged in as:</span> {user.full_name}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Role:</span> {user.role}
              </p>
            </div>
          )}
        </div>
        <div className="mt-8 space-y-3">
          <button
            onClick={handleGoBack}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Go to Dashboard
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};
