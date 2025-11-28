// User profile page
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userAPI } from '../services/api';

const Profile = () => {
  const { user, updateLocalUser } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    birthday: '',
    avatar: null,
  });
  const [passwordData, setPasswordData] = useState({
    old: '',
    new: '',
    confirm: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        birthday: user.birthday || '',
        avatar: null,
      });
    }
  }, [user]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const data = new FormData();
      if (formData.name !== user.name) data.append('name', formData.name);
      if (formData.email !== user.email) data.append('email', formData.email);
      if (formData.birthday !== user.birthday)
        data.append('birthday', formData.birthday);
      if (formData.avatar) data.append('avatar', formData.avatar);

      const response = await userAPI.updateMe(data);
      updateLocalUser();
      setSuccess('Profile updated successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordData.new !== passwordData.confirm) {
      setError('New passwords do not match.');
      return;
    }

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,20}$/;
    if (!passwordRegex.test(passwordData.new)) {
      setError(
        'Password must be 8-20 characters and contain uppercase, lowercase, digit, and special character.'
      );
      return;
    }

    setLoading(true);

    try {
      await userAPI.changePassword(passwordData.old, passwordData.new);
      setSuccess('Password changed successfully!');
      setPasswordData({ old: '', new: '', confirm: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>My Profile</h1>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          className={`btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('profile')}
        >
          Profile
        </button>
        <button
          className={`btn ${activeTab === 'password' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('password')}
        >
          Change Password
        </button>
      </div>

      {activeTab === 'profile' && (
        <div className="card">
          <div className="card-header">Profile Information</div>
          <form onSubmit={handleProfileUpdate}>
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="birthday">Birthday (YYYY-MM-DD)</label>
              <input
                type="date"
                id="birthday"
                value={formData.birthday}
                onChange={(e) =>
                  setFormData({ ...formData, birthday: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label htmlFor="avatar">Avatar</label>
              <input
                type="file"
                id="avatar"
                accept="image/*"
                onChange={(e) =>
                  setFormData({ ...formData, avatar: e.target.files[0] })
                }
              />
            </div>
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}
            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Update Profile'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'password' && (
        <div className="card">
          <div className="card-header">Change Password</div>
          <form onSubmit={handlePasswordChange}>
            <div className="form-group">
              <label htmlFor="oldPassword">Current Password</label>
              <input
                type="password"
                id="oldPassword"
                value={passwordData.old}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, old: e.target.value })
                }
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                value={passwordData.new}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, new: e.target.value })
                }
                required
              />
              <small style={{ color: '#666', fontSize: '12px' }}>
                8-20 characters, must include uppercase, lowercase, digit, and
                special character
              </small>
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                type="password"
                id="confirmPassword"
                value={passwordData.confirm}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, confirm: e.target.value })
                }
                required
              />
            </div>
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}
            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-header">Account Information</div>
        <table className="table">
          <tbody>
            <tr>
              <td><strong>UTORid</strong></td>
              <td>{user?.utorid}</td>
            </tr>
            <tr>
              <td><strong>Role</strong></td>
              <td>{user?.role}</td>
            </tr>
            <tr>
              <td><strong>Points</strong></td>
              <td>{user?.points || 0}</td>
            </tr>
            <tr>
              <td><strong>Verified</strong></td>
              <td>
                {user?.verified ? (
                  <span className="badge badge-success">Yes</span>
                ) : (
                  <span className="badge badge-warning">No</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Profile;

