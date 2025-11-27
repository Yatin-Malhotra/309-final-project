// Dashboard page - main landing page after login
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { transactionAPI } from '../services/api';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { user, hasRole } = useAuth();
  const [stats, setStats] = useState({
    totalPoints: 0,
    recentTransactions: [],
    pendingRedemptions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        if (user) {
          // Get user's current points
          const points = user.points || 0;

          // Get recent transactions
          const txResponse = await transactionAPI.getMyTransactions({
            limit: 5,
            page: 1,
          });

          // Count pending redemptions (for cashiers/managers)
          let pendingCount = 0;
          if (hasRole('cashier')) {
            const response = await transactionAPI.getRedemptionTransactions({
              processed: 'false',
              limit: 1,
            });
            pendingCount = response.data.count;
          }

          setStats({
            totalPoints: points,
            recentTransactions: txResponse.data.results || [],
            pendingRedemptions: pendingCount,
          });
        }
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [user, hasRole]);

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="container">
      <h1>Welcome, {user?.name}!</h1>
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="dashboard-card-title">Your Points</div>
          <div className="dashboard-card-value">{stats.totalPoints}</div>
        </div>
        {hasRole('cashier') && (
          <div className="dashboard-card">
            <div className="dashboard-card-title">Pending Redemptions</div>
            <div className="dashboard-card-value">
              {stats.pendingRedemptions}
            </div>
            <Link to="/transactions">
              View All
            </Link>
          </div>
        )}
        <div className="dashboard-card">
          <div className="dashboard-card-title">Account Status</div>
          <div className="dashboard-card-value">
            {user?.verified ? (
              <span className="badge badge-success">Verified</span>
            ) : (
              <span className="badge badge-warning">Unverified</span>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">Recent Transactions</div>
        {stats.recentTransactions.length === 0 ? (
          <div className="empty-state">No recent transactions</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentTransactions.map((tx) => (
                <tr key={tx.id}>
                  <td>{tx.type}</td>
                  <td>
                    {tx.type === 'redemption' ? '-' : '+'}
                    {Math.abs(tx.amount)}
                  </td>
                  <td>{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : 'N/A'}</td>
                  <td>
                    {tx.processed ? (
                      <span className="badge badge-success">Processed</span>
                    ) : (
                      <span className="badge badge-warning">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: '15px' }}>
          <Link to="/transactions" className="btn btn-secondary">
            View All Transactions
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="card-header">Quick Actions</div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link to="/profile" className="btn btn-primary">
            Update Profile
          </Link>
          {hasRole('cashier') && (
            <Link to="/transactions/create" className="btn btn-primary">
              Create Transaction
            </Link>
          )}
          {hasRole('manager') && (
            <>
              <Link to="/events/create" className="btn btn-primary">
                Create Event
              </Link>
              <Link to="/promotions/create" className="btn btn-primary">
                Create Promotion
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

