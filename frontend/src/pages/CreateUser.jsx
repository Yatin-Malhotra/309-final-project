// Create user page (for cashiers)
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userAPI } from '../services/api';

const CreateUser = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    utorid: '',
    name: '',
    email: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await userAPI.createUser(formData);
      setSuccess(
        `User created successfully! Reset token: ${response.data.resetToken}`
      );
      setTimeout(() => navigate('/users'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Create User</h1>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="utorid">UTORid *</label>
            <input
              type="text"
              id="utorid"
              value={formData.utorid}
              onChange={(e) =>
                setFormData({ ...formData, utorid: e.target.value })
              }
              required
              pattern="[a-zA-Z0-9]{7,8}"
              title="UTORid must be 7-8 alphanumeric characters"
            />
          </div>
          <div className="form-group">
            <label htmlFor="name">Name *</label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
              maxLength={50}
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              required
              pattern="[^\s@]+@(mail\.)?utoronto\.ca"
              title="Must be a UofT email (@utoronto.ca or @mail.utoronto.ca)"
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate('/users')}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateUser;

