// Password reset page component
import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { authAPI } from '../services/api';

const ResetPassword = () => {
  const { resetToken } = useParams();
  const [utorid, setUtorid] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validatePassword = (pwd) => {
    // Password must be 8-20 chars, contain uppercase, lowercase, digit, and special char
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,20}$/;
    return regex.test(pwd);
  };

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authAPI.requestReset(utorid);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to request password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');

    if (!validatePassword(password)) {
      setError(
        'Password must be 8-20 characters and contain uppercase, lowercase, digit, and special character.'
      );
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await authAPI.resetPassword(resetToken, utorid, password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  if (resetToken) {
    // Reset password form
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Reset Password</h1>
            <p>Enter your UTORid and new password</p>
          </div>
          {success ? (
            <div className="success-message">
              Password reset successful! Redirecting to login...
            </div>
          ) : (
            <form onSubmit={handleReset}>
              <div className="form-group">
                <label htmlFor="utorid">UTORid</label>
                <input
                  type="text"
                  id="utorid"
                  value={utorid}
                  onChange={(e) => setUtorid(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">New Password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <small style={{ color: '#666', fontSize: '12px' }}>
                  8-20 characters, must include uppercase, lowercase, digit, and special character
                </small>
              </div>
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              {error && <div className="error-message">{error}</div>}
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Request reset form
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Reset Password</h1>
          <p>Enter your UTORid to receive a reset link</p>
        </div>
        {success ? (
          <div className="success-message">
            Reset token has been sent. Please check your email or contact support.
          </div>
        ) : (
          <form onSubmit={handleRequestReset}>
            <div className="form-group">
              <label htmlFor="utorid">UTORid</label>
              <input
                type="text"
                id="utorid"
                value={utorid}
                onChange={(e) => setUtorid(e.target.value)}
                required
                autoFocus
              />
            </div>
            {error && <div className="error-message">{error}</div>}
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Sending...' : 'Request Reset'}
              </button>
            </div>
            <div style={{ marginTop: '15px', textAlign: 'center' }}>
              <Link to="/login" style={{ color: '#007bff', textDecoration: 'none' }}>
                Back to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;

