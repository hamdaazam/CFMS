import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateCNIC, sanitizeCNIC, validateEmail } from '../utils/validation';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loginMethod, setLoginMethod] = useState<'email' | 'cnic'>('email');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [identifierError, setIdentifierError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIdentifierError('');
    setLoading(true);

    // Validate Identifier
    if (loginMethod === 'cnic') {
      const validation = validateCNIC(identifier);
      if (!validation.isValid) {
        setIdentifierError(validation.error || 'Invalid CNIC');
        setLoading(false);
        return;
      }
    } else {
      const validation = validateEmail(identifier);
      if (!validation.isValid) {
        setIdentifierError(validation.error || 'Invalid Email');
        setLoading(false);
        return;
      }
    }

    // Clean CNIC for API call if method is CNIC
    let finalIdentifier = identifier;
    if (loginMethod === 'cnic') {
      finalIdentifier = identifier.replace(/[-\s]/g, '');
    }

    try {
      await login(finalIdentifier, password, loginMethod);

      // Get user from localStorage to determine role
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);

        // Navigate based on role
        switch (user.role) {
          case 'ADMIN':
            navigate('/admin/dashboard');
            break;
          case 'CONVENER':
            navigate('/convener/dashboard');
            break;
          case 'COORDINATOR':
            navigate('/coordinator/dashboard');
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
            navigate('/dashboard');
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      if (!err?.response) {
        setError('Cannot reach the server. Please make sure the backend is running on 127.0.0.1:8000.');
      } else {
        setError(err.response?.data?.detail || 'Invalid credentials. Please check your inputs and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMethod = () => {
    setLoginMethod(prev => prev === 'email' ? 'cnic' : 'email');
    setIdentifier('');
    setIdentifierError('');
    setError('');
  };

  return (
    <div
      className="min-h-screen flex items-end relative pl-8 pr-32"
      style={{
        backgroundImage: 'url(/background-image.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Blue Overlay on background image */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to right, rgba(77, 72, 140, 0.7) 0%, rgba(105, 101, 162, 0.7) 100%)',
        }}
      />

      {/* Login Container - Merged with bottom, more gap on right */}
      <div
        className="relative z-10 w-full rounded-t-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(to right, rgba(62, 56, 140, 1) 0%, rgba(91, 87, 150, 0.65) 50%, rgba(105, 101, 162, 0.5) 100%)',
          backdropFilter: 'blur(3px)',
        }}
      >
        <div className="flex items-center px-8 lg:px-16 py-10">
          {/* Left Side - Login Form */}
          <div className="w-full lg:w-1/2">
            {/* Logo and Title */}
            <div className="flex items-center mb-6">
              <img
                src="/cust-logo.png"
                alt="CUST Logo"
                className="w-14 h-14 mr-3"
              />
              <div className="text-white text-sm">
                <p className="font-semibold">Capital University of Science & Technology</p>
              </div>
            </div>

            <p className="text-white/90 text-sm mb-2">Welcome to C.U.S.T Course folder management system</p>
            <h1 className="text-white text-4xl font-bold mb-8">Login</h1>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-white px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="text-white/90 text-sm mb-2 block font-medium">
                  {loginMethod === 'email' ? 'Email Address' : 'CNIC (13 digits)'}
                </label>
                <input
                  type={loginMethod === 'email' ? 'email' : 'text'}
                  value={identifier}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (loginMethod === 'cnic') {
                      val = sanitizeCNIC(val);
                    }
                    setIdentifier(val);
                    setIdentifierError('');
                  }}
                  onBlur={() => {
                    if (identifier) {
                      if (loginMethod === 'cnic') {
                        const validation = validateCNIC(identifier);
                        if (!validation.isValid) {
                          setIdentifierError(validation.error || '');
                        }
                      } else {
                        const validation = validateEmail(identifier);
                        if (!validation.isValid) {
                          setIdentifierError(validation.error || '');
                        }
                      }
                    }
                  }}
                  placeholder={loginMethod === 'email' ? 'name@example.com' : '12345-1234567-1'}
                  maxLength={loginMethod === 'cnic' ? 15 : undefined}
                  required
                  disabled={loading}
                  className="w-full px-4 py-3 rounded-lg text-black placeholder-black/50 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50"
                  style={{
                    backgroundColor: 'rgb(81, 75, 150)',
                    border: 'none'
                  }}
                />
                {identifierError && <p className="text-red-300 text-xs mt-1">{identifierError}</p>}
              </div>

              <div>
                <label className="text-white/90 text-sm mb-2 block">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••••••••"
                  required
                  disabled={loading}
                  className="w-full px-4 py-3 rounded-lg text-white placeholder-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50"
                  style={{
                    backgroundColor: 'rgb(81, 75, 150)',
                    border: 'none'
                  }}
                />
              </div>

              <div className="flex items-center gap-4 pt-4">
                <button
                  type="button"
                  onClick={toggleMethod}
                  className="flex-1 px-6 py-2.5 rounded-sm text-white text-sm font-medium transition-colors hover:opacity-80"
                  style={{ backgroundColor: 'rgb(69, 64, 129)' }}
                  disabled={loading}
                >
                  {loginMethod === 'email' ? 'Login with CNIC' : 'Login with Email'}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-2.5 rounded-sm text-white text-sm font-medium transition-colors hover:opacity-80 disabled:opacity-50"
                  style={{ backgroundColor: '#FF7A59' }}
                >
                  {loading ? 'Logging in...' : 'Login'}
                </button>
              </div>
            </form>
          </div>

          {/* Right Side - Large Logo */}
          <div className="hidden lg:flex w-2/5 items-center justify-center">
            <img
              src="/cust-logo.png"
              alt="CUST Logo Large"
              className="w-96 h-96 object-contain drop-shadow-2xl"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
