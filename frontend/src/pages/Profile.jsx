// User profile page
import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { userAPI, getAvatarUrl } from '../services/api';
import '../styles/pages/Profile.css';

const Profile = () => {
  const { user, updateLocalUser } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    birthday: '',
    avatar: null,
  });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const fileInputRef = useRef(null);
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
    updateLocalUser();
  }, []);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        birthday: user.birthday || '',
        avatar: null,
      });
      setAvatarPreview(getAvatarUrl(user.avatarUrl) || null);
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
      if (response.data.avatarUrl) {
        setAvatarPreview(getAvatarUrl(response.data.avatarUrl));
      }
      if (formData.avatar) {
        setFormData({ ...formData, avatar: null });
      }
      updateLocalUser();
      setSuccess('Profile updated successfully!');
      toast.success('Profile updated successfully!');
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to update profile.';
      setError(errorMessage);
      toast.error(errorMessage);
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
      toast.success('Password changed successfully!');
      setPasswordData({ old: '', new: '', confirm: '' });
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to change password.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role) => {
    const colors = {
      regular: 'profile-badge-secondary',
      cashier: 'profile-badge-blue',
      manager: 'profile-badge-success',
      superuser: 'profile-badge-warning',
    };
    return colors[role] || 'profile-badge-secondary';
  };

  return (
    <div className="profile-page">
      <div className="profile-page-header">
        <h1>My Profile</h1>
      </div>
      <div className="profile-tabs">
        <button
          className={`profile-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          Profile
        </button>
        <button
          className={`profile-tab ${activeTab === 'password' ? 'active' : ''}`}
          onClick={() => setActiveTab('password')}
        >
          Change Password
        </button>
      </div>

      {activeTab === 'profile' && (
        <div className="profile-section">
          <div className="profile-section-header">Profile Information</div>
          <form onSubmit={handleProfileUpdate}>
          <div className="form-group">
              <label>Avatar</label>
              <div className="profile-avatar-container">
                <div 
                  className="profile-avatar-wrapper"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarPreview ? (
                    <img 
                      key={avatarPreview} 
                      src={avatarPreview} 
                      alt="Avatar" 
                      className="profile-avatar-image"
                    />
                  ) : (
                    <div className="profile-avatar-placeholder">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </div>
                  )}
                  <div className="profile-avatar-overlay">
                    <span>Click to change</span>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  id="avatar"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setFormData({ ...formData, avatar: file });
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setAvatarPreview(reader.result);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </div>
            </div>
            
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
        <div className="profile-section">
          <div className="profile-section-header">Change Password</div>
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
              <small>
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

      <div className="profile-section">
        <div className="profile-section-header">Account Information</div>
        <table className="profile-info-table">
          <tbody>
            <tr>
              <td><strong>UTORid</strong></td>
              <td>{user?.utorid}</td>
            </tr>
            <tr>
              <td><strong>Role</strong></td>
              <td>
                <span className={`profile-badge ${getRoleBadge(user?.role)}`}>
                  {user?.role}
                </span>
              </td>
            </tr>
            <tr>
              <td><strong>Points</strong></td>
              <td>{user?.points || 0}</td>
            </tr>
            <tr>
              <td><strong>Verified</strong></td>
              <td>
                {user?.verified ? (
                  <span className="profile-badge profile-badge-success">Yes</span>
                ) : (
                  <span className="profile-badge profile-badge-warning">No</span>
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

