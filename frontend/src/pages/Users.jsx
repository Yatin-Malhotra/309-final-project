// Users management page (for managers)
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userAPI } from '../services/api';
import { Link, useSearchParams } from 'react-router-dom';

const Users = () => {
  const { hasRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    name: searchParams.get('name') || '',
    role: searchParams.get('role') || '',
    verified: searchParams.get('verified') || '',
    page: parseInt(searchParams.get('page')) || 1,
    limit: parseInt(searchParams.get('limit')) || 10,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsers();
  }, [filters]);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { ...filters };
      Object.keys(params).forEach((key) => {
        if (!params[key]) delete params[key];
      });

      const response = await userAPI.getUsers(params);
      setUsers(response.data.results || []);
      setCount(response.data.count || 0);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value, page: 1 };
    setFilters(newFilters);
    setSearchParams(newFilters);
  };

  const getRoleBadge = (role) => {
    const colors = {
      regular: 'badge-secondary',
      cashier: 'badge-primary',
      manager: 'badge-success',
      superuser: 'badge-danger',
    };
    return colors[role] || 'badge-secondary';
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Users</h1>
        {hasRole('cashier') && (
          <Link to="/users/create" className="btn btn-primary">
            Create User
          </Link>
        )}
      </div>

      <div className="filters">
        <div className="form-group">
          <label>Search</label>
          <input
            type="text"
            value={filters.name}
            onChange={(e) => handleFilterChange('name', e.target.value)}
            placeholder="Name or UTORid..."
          />
        </div>
        <div className="form-group">
          <label>Role</label>
          <select
            value={filters.role}
            onChange={(e) => handleFilterChange('role', e.target.value)}
          >
            <option value="">All</option>
            <option value="regular">Regular</option>
            <option value="cashier">Cashier</option>
            <option value="manager">Manager</option>
            <option value="superuser">Superuser</option>
          </select>
        </div>
        <div className="form-group">
          <label>Verified</label>
          <select
            value={filters.verified}
            onChange={(e) => handleFilterChange('verified', e.target.value)}
          >
            <option value="">All</option>
            <option value="true">Verified</option>
            <option value="false">Unverified</option>
          </select>
        </div>
        <div className="form-group">
          <label>Limit</label>
          <select
            value={filters.limit}
            onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">Loading users...</div>
      ) : users.length === 0 ? (
        <div className="empty-state">No users found</div>
      ) : (
        <>
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>UTORid</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Points</th>
                  <th>Verified</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.utorid}</td>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`badge ${getRoleBadge(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>{user.points || 0}</td>
                    <td>
                      {user.verified ? (
                        <span className="badge badge-success">Yes</span>
                      ) : (
                        <span className="badge badge-warning">No</span>
                      )}
                    </td>
                    <td>
                      <Link
                        to={`/users/${user.id}`}
                        className="btn btn-primary"
                        style={{ padding: '5px 10px', fontSize: '12px' }}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <button
              onClick={() => handleFilterChange('page', filters.page - 1)}
              disabled={filters.page <= 1}
            >
              Previous
            </button>
            <span>
              Page {filters.page} of {Math.ceil(count / filters.limit)}
            </span>
            <button
              onClick={() => handleFilterChange('page', filters.page + 1)}
              disabled={filters.page >= Math.ceil(count / filters.limit)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Users;

