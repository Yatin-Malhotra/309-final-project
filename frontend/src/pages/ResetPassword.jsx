// Password reset page component
import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { authAPI } from '../services/api';
import './ResetPassword.css';

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
      toast.success('Password reset request sent! Check your email for further instructions.');
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to request password reset.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');

    if (!validatePassword(password)) {
      toast.error('Password must be 8-20 characters and contain uppercase, lowercase, digit, and special character.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await authAPI.resetPassword(resetToken, utorid, password);
      setSuccess(true);
      toast.success('Password reset successful! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to reset password.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (resetToken) {
    // Reset password form
    return (
      <div className="reset-password-container">
        <div className="reset-password-stripes"></div>
        <div className="reset-password-welcome">
          <h2>Reset Password</h2>
        </div>
        <div className="reset-password-card">
          <div className="reset-password-header">
            <h1>Reset Password</h1>
            <p>Enter your UTORid and new password</p>
          </div>
          {success ? (
            <div className="reset-password-success-message">
              Password reset successful! Redirecting to login...
            </div>
          ) : (
            <form onSubmit={handleReset}>
              <div className="reset-password-form-group">
                <label htmlFor="utorid">UTORid</label>
                <input
                  type="text"
                  id="utorid"
                  value={utorid}
                  onChange={(e) => setUtorid(e.target.value)}
                  required
                />
              </div>
              <div className="reset-password-form-group">
                <label htmlFor="password">New Password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <small>
                  8-20 characters, must include uppercase, lowercase, digit, and special character
                </small>
              </div>
              <div className="reset-password-form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <div className="reset-password-form-actions">
                <button type="submit" className="reset-password-btn-primary" disabled={loading}>
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
    <div className="reset-password-container">
      <div className="reset-password-stripes"></div>
      <div className="reset-password-card">
        <div className="reset-password-header">
          <h1>Reset Password</h1>
          <p>Enter your UTORid to receive a reset link</p>
        </div>
        {success ? (
          <div className="reset-password-success-message">
            Check email for further instructions
          </div>
        ) : (
          <form onSubmit={handleRequestReset}>
            <div className="reset-password-form-group">
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
            <div className="reset-password-form-actions">
              <button type="submit" className="reset-password-btn-primary" disabled={loading}>
                {loading ? 'Sending...' : 'Request Reset'}
              </button>
            </div>
            <div className="reset-password-link-container">
              <Link to="/login" className="reset-password-link">
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

