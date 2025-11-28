// User detail page
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { userAPI } from '../services/api';

const UserDetail = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [suspicious, setSuspicious] = useState(false);
  const [verified, setVerified] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [transactionCount, setTransactionCount] = useState(0);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionFilters, setTransactionFilters] = useState({
    page: 1,
    limit: 10,
  });

  const [editingEmail, setEditingEmail] = useState(false);
  const [email, setEmail] = useState();

  useEffect(() => {
    loadUser();
  }, [userId]);

  useEffect(() => {
    if (user && hasRole('manager')) {
      loadTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, transactionFilters, user]);

  const loadUser = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await userAPI.getUser(userId);
      setUser(response.data);
      // Suspicious and verified fields may not be in GET response, so we'll update it when we toggle
      setSuspicious(response.data.suspicious ?? false);
      setVerified(response.data.verified ?? false);
      setEmail(response.data.email)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load user.');
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    if (!hasRole('manager')) return;
    
    setTransactionsLoading(true);
    try {
      const params = { ...transactionFilters };
      const response = await userAPI.getUserTransactions(userId, params);
      setTransactions(response.data.results || []);
      setTransactionCount(response.data.count || 0);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const cancelEditingEmail = () => {
    setEditingEmail(false);
    setEmail(user.email);
  };

  const handleSaveEmail = async () => {
    setEditingEmail(false);

    if (!confirm(`Are you sure you want to change the user's mail?`)) {
        return;
    }

    setActionLoading(true)

    try {
        const _ = await userAPI.updateUser(user.id, { email } )
        setUser({...user, email})
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to modify email.');
    } finally {
       setActionLoading(false)
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    if (!confirm(`Are you sure you want to change the user's role to ${newRole}`)) {
        return;
    }

    setActionLoading(true)

    try {
      const _ = await userAPI.updateUser(user.id, { role : newRole })
      setUser({...user, role : newRole})
    } catch (err) {
        alert(err.response?.data?.error || 'Failed to modify email.');
    } finally {
       setActionLoading(false)
    }
  };

  const handleTransactionFilterChange = (key, value) => {
    const newFilters = { ...transactionFilters, [key]: value };
    // Only reset to page 1 if changing a non-page filter
    if (key !== 'page') {
      newFilters.page = 1;
    }
    setTransactionFilters(newFilters);
  };

  const handleToggleSuspicious = async () => {
    const newSuspiciousValue = !suspicious;
    if (!confirm(`Are you sure you want to ${suspicious ? 'clear' : 'set'} the suspicious flag for this user?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await userAPI.updateUser(userId, { suspicious: newSuspiciousValue });
      // Update both state and user object
      const updatedSuspicious = response.data.suspicious ?? newSuspiciousValue;
      setSuspicious(updatedSuspicious);
      setUser({ ...user, suspicious: updatedSuspicious });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update suspicious status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleVerified = async () => {
    if (verified) return;
    
    if (!confirm('Are you sure you want to verify this user? This action cannot be undone.')) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await userAPI.updateUser(userId, { verified: true });
      setVerified(true);
      setUser({ ...user, verified: true });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to verify user.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
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

  const getTransactionTypeBadge = (type) => {
    const colors = {
      purchase: 'badge-primary',
      redemption: 'badge-danger',
      adjustment: 'badge-warning',
      event: 'badge-success',
      transfer: 'badge-secondary',
    };
    return colors[type] || 'badge-secondary';
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading user...</div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="container">
        <div className="error-message">{error || 'User not found'}</div>
        <Link to="/users" className="btn btn-secondary" style={{ marginTop: '20px' }}>
          Back to Users
        </Link>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>User Profile</h1>
        <Link to="/users" className="btn btn-secondary">
          Back to Users
        </Link>
      </div>

      <div className="card">
        <div className="card-header">User Information</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            {user.avatarUrl && (
              <div style={{ marginBottom: '20px' }}>
                <img
                  src={user.avatarUrl}
                  alt={`${user.name}'s avatar`}
                  style={{ width: '150px', height: '150px', borderRadius: '50%', objectFit: 'cover' }}
                />
              </div>
            )}
            <table className="table">
              <tbody>
                <tr>
                  <td><strong>ID</strong></td>
                  <td>{user.id}</td>
                </tr>
                <tr>
                  <td><strong>UTORid</strong></td>
                  <td>{user.utorid}</td>
                </tr>
                <tr>
                  <td><strong>Name</strong></td>
                  <td>{user.name}</td>
                </tr>
                {user.email && (
                  <tr>
                    <td><strong>Email</strong></td>
                    <td>
                      {editingEmail ? (
                      <>
                        <input
                          type="text"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={loading}
                        />

                        <button
                          onClick={handleSaveEmail}
                          disabled={loading}
                        >
                          Save
                        </button>

                        <button
                          onClick={cancelEditingEmail}
                          disabled={loading}
                        >
                          Cancel
                        </button>
                      </>
                      ) : (
                        <>
                          {user.email}
                          <button onClick={() => setEditingEmail(true)}>Edit</button>
                        </>
                      )}
                    </td>
                  </tr>
                )}
                {user.birthday && (
                  <tr>
                    <td><strong>Birthday</strong></td>
                    <td>{user.birthday}</td>
                  </tr>
                )}
                <tr>
                  <td><strong>Role</strong></td>
                  <td>
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className={`badge ${getRoleBadge(user.role)}`}
                      style={{border:'none'}}
                    >
                      <option value="regular">Regular</option>
                      <option value="cashier">Cashier</option>
                      {hasRole('superuser') &&  (
                        <>
                        <option value="manager">Manager</option>
                        <option value="superuser">Superuser</option>
                        </>
                      )}
                    </select>
                  </td>
                </tr>
                <tr>
                  <td><strong>Points</strong></td>
                  <td>{user.points || 0}</td>
                </tr>
                <tr>
                  <td><strong>Verified</strong></td>
                  <td>
                    {hasRole('manager') ? (
                      <label className={`switch ${verified ? 'disabled' : ''}`}>
                        <input
                          type="checkbox"
                          checked={verified}
                          onChange={handleToggleVerified}
                          disabled={verified || actionLoading}
                        />
                        <span className="slider round"></span>
                      </label>
                    ) : (
                      user.verified ? (
                        <span className="badge badge-success">Yes</span>
                      ) : (
                        <span className="badge badge-warning">No</span>
                      )
                    )}
                  </td>
                </tr>
                <tr>
                  <td><strong>Suspicious</strong></td>
                  <td>
                    {hasRole('manager') ? (
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={suspicious}
                          onChange={handleToggleSuspicious}
                          disabled={actionLoading}
                        />
                        <span className="slider round"></span>
                      </label>
                    ) : (
                      user.suspicious ? (
                        <span className="badge badge-danger">Yes</span>
                      ) : (
                        <span className="badge badge-success">No</span>
                      )
                    )}
                  </td>
                </tr>
                {user.createdAt && (
                  <tr>
                    <td><strong>Created At</strong></td>
                    <td>{formatDate(user.createdAt)}</td>
                  </tr>
                )}
                {user.lastLogin && (
                  <tr>
                    <td><strong>Last Login</strong></td>
                    <td>{formatDate(user.lastLogin)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {user.promotions && user.promotions.length > 0 && (
        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-header">Active Promotions</div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {user.promotions.map((promotion) => (
              <div key={promotion.id} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                <strong>{promotion.name}</strong>
                {promotion.minSpending && (
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    Min Spending: ${promotion.minSpending}
                  </div>
                )}
                {promotion.rate && (
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    Rate: {promotion.rate}x
                  </div>
                )}
                {promotion.points && (
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    Points: {promotion.points}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {hasRole('manager') && (
        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-header">User Transactions</div>
          
          <div className="filters" style={{ marginBottom: '20px' }}>
            <div className="form-group">
              <label>Limit</label>
              <select
                value={transactionFilters.limit}
                onChange={(e) => handleTransactionFilterChange('limit', parseInt(e.target.value))}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>

          {transactionsLoading ? (
            <div className="loading">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="empty-state">No transactions found</div>
          ) : (
            <>
              <table className="table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Created By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td>{tx.id}</td>
                        <td>
                          <span className={`badge ${getTransactionTypeBadge(tx.type)}`}>
                            {tx.type}
                          </span>
                        </td>
                        <td>
                          {tx.amount}
                        </td>
                        <td>{tx.createdAt ? formatDate(tx.createdAt) : 'N/A'}</td>
                        <td>
                          {tx.type === 'redemption' ? (
                            tx.processed ? (
                              <span className="badge badge-success">Processed</span>
                            ) : (
                              <span className="badge badge-warning">Pending</span>
                            )
                          ) : tx.suspicious ? (
                            <span className="badge badge-danger">Suspicious</span>
                          ) : (
                            <span className="badge badge-success">Normal</span>
                          )}
                        </td>
                        <td>{tx.createdBy || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

              <div className="pagination" style={{ marginTop: '20px' }}>
                <button
                  onClick={() => handleTransactionFilterChange('page', transactionFilters.page - 1)}
                  disabled={transactionFilters.page <= 1}
                >
                  Previous
                </button>
                <span>
                  Page {transactionFilters.page} of {Math.ceil(transactionCount / transactionFilters.limit)}
                </span>
                <button
                  onClick={() => handleTransactionFilterChange('page', transactionFilters.page + 1)}
                  disabled={transactionFilters.page >= Math.ceil(transactionCount / transactionFilters.limit)}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default UserDetail;

