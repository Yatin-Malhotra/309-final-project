// Login page component
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI, userAPI } from '../services/api';

const Login = () => {
  const [utorid, setUtorid] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login(utorid, password);
      const { token } = response.data;
      
      // Fetch user data using the API service
      localStorage.setItem('token', token);
      const userResponse = await userAPI.getMe();
      const userData = userResponse.data;
      
      login(token, userData);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Login</h1>
          <p>Sign in to your CSSU Rewards account</p>
        </div>
        <form onSubmit={handleSubmit}>
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
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </div>
          <div style={{ marginTop: '15px', textAlign: 'center' }}>
            <Link to="/reset-password" style={{ color: '#007bff', textDecoration: 'none' }}>
              Forgot password?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;

