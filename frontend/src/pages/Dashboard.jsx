// Dashboard page - main landing page after login
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { transactionAPI, eventAPI, promotionAPI, userAPI } from '../services/api';
import { Link } from 'react-router-dom';
import './Dashboard.css';

const Dashboard = () => {
  const { user, hasRole } = useAuth();
  const [stats, setStats] = useState({
    totalPoints: 0,
    recentTransactions: [],
    pendingRedemptions: 0,
    // Manager/Superuser stats
    totalEvents: 0,
    totalPromotions: 0,
    totalUsers: 0,
    totalTransactions: 0,
    recentEvents: [],
    recentPromotions: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        if (user) {
          const userRole = user.role;

          // For regular users: show points and transactions
          if (userRole === 'regular') {
            const points = user.points || 0;
            const txResponse = await transactionAPI.getMyTransactions({
              limit: 5,
              page: 1,
            });

            setStats({
              totalPoints: points,
              recentTransactions: txResponse.data.results || [],
              pendingRedemptions: 0,
            });
          }
          // For cashiers: show transaction creation and redemption processing
          else if (userRole === 'cashier') {
            const points = user.points || 0;
            const txResponse = await transactionAPI.getMyTransactions({
              limit: 5,
              page: 1,
            });

            // Get pending redemptions
            const allTxResponse = await transactionAPI.getRedemptionTransactions({
              processed: false,
              limit: 1,
              page: 1,
            });
            const pendingCount = allTxResponse.data.count || 0;

            setStats({
              totalPoints: points,
              recentTransactions: txResponse.data.results || [],
              pendingRedemptions: pendingCount,
            });
          }
          // For managers and superusers: show overview of events, promotions, and users
          else if (hasRole('manager')) {
            // Get events overview
            const eventsResponse = await eventAPI.getEvents({ limit: 5, page: 1 });
            const allEventsResponse = await eventAPI.getEvents({ limit: 1 });
            
            // Get promotions overview
            const promotionsResponse = await promotionAPI.getPromotions();
            
            // Get users overview
            const usersResponse = await userAPI.getUsers({ limit: 1 });
            
            // Get transactions overview
            const transactionsResponse = await transactionAPI.getTransactions({ limit: 1 });

            setStats({
              totalPoints: user.points || 0,
              recentTransactions: [],
              pendingRedemptions: 0,
              totalEvents: allEventsResponse.data.count || 0,
              totalPromotions: promotionsResponse.data.results?.length || 0,
              totalUsers: usersResponse.data.count || 0,
              totalTransactions: transactionsResponse.data.count || 0,
              recentEvents: eventsResponse.data.results || [],
              recentPromotions: promotionsResponse.data.results?.slice(0, 5) || [],
            });
          }
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
    return <div className="dashboard-loading">Loading dashboard...</div>;
  }

  const userRole = user?.role;

  // Regular User Dashboard: Points balance and recent transactions
  if (userRole === 'regular') {
    return (
      <div className="dashboard-page">
        <div className="dashboard-header-with-badge">
          <h1>Welcome, {user?.name}!</h1>
          {user?.verified ? (
            <span className="dashboard-badge dashboard-badge-success dashboard-header-badge">Verified</span>
          ) : (
            <span className="dashboard-badge dashboard-badge-warning dashboard-header-badge">Unverified</span>
          )}
        </div>
        <div className="dashboard-grid dashboard-grid-single">
          <div className="dashboard-card dashboard-card-narrow">
            <div className="dashboard-card-title">Your Points Balance</div>
            <div className="dashboard-card-value">{stats.totalPoints}</div>
          </div>
        </div>

        <div className="dashboard-section">
          <div className="dashboard-section-header">Recent Transactions</div>
          {stats.recentTransactions.length === 0 ? (
            <div className="dashboard-empty-state">No recent transactions</div>
          ) : (
            <>
              <table className="dashboard-table">
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
                      <td>
                        <span className={`dashboard-badge ${
                          tx.type === 'purchase' ? 'dashboard-badge-primary' :
                          tx.type === 'redemption' ? 'dashboard-badge-danger' :
                          tx.type === 'event' ? 'dashboard-badge-success' :
                          'dashboard-badge-secondary'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td>
                        {tx.type === 'redemption' ? '-' : '+'}
                        {Math.abs(tx.amount)} points
                      </td>
                      <td>{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : 'N/A'}</td>
                      <td>
                        {tx.processed ? (
                          <span className="dashboard-badge dashboard-badge-success">Processed</span>
                        ) : (
                          <span className="dashboard-badge dashboard-badge-warning">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="dashboard-section-actions">
                <Link to="/transactions" className="btn btn-secondary">
                  View All Transactions
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Cashier Dashboard: Quick access to transaction creation and redemption processing
  if (userRole === 'cashier') {
    return (
      <div className="dashboard-page">
        <div className="dashboard-header-with-action">
          <h1>Welcome, {user?.name}!</h1>
          <Link to="/transactions/create" className="btn btn-primary dashboard-create-btn">
            Create Transaction
          </Link>
        </div>
        <div className="dashboard-grid dashboard-grid-single">
          <div className="dashboard-card dashboard-card-narrow">
            <div className="dashboard-card-title">Pending Redemptions</div>
            <div className="dashboard-card-value">
              {stats.pendingRedemptions}
            </div>
            <div className="dashboard-card-actions">
              <Link to="/transactions" className="btn btn-primary">
                View Redemptions
              </Link>
            </div>
          </div>
        </div>

        <div className="dashboard-section">
          <div className="dashboard-section-header">Recent Transactions</div>
          {stats.recentTransactions.length === 0 ? (
            <div className="dashboard-empty-state">No recent transactions</div>
          ) : (
            <>
              <table className="dashboard-table">
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
                      <td>
                        <span className={`dashboard-badge ${
                          tx.type === 'purchase' ? 'dashboard-badge-primary' :
                          tx.type === 'redemption' ? 'dashboard-badge-danger' :
                          'dashboard-badge-secondary'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td>
                        {tx.type === 'redemption' ? '-' : '+'}
                        {Math.abs(tx.amount)} points
                      </td>
                      <td>{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : 'N/A'}</td>
                      <td>
                        {tx.processed ? (
                          <span className="dashboard-badge dashboard-badge-success">Processed</span>
                        ) : (
                          <span className="dashboard-badge dashboard-badge-warning">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="dashboard-section-actions">
                <Link to="/transactions" className="btn btn-secondary">
                  View All Transactions
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Manager/Superuser Dashboard: Overview of events, promotions, and user management
  if (hasRole('manager')) {
    const formatDate = (dateString) => {
      if (!dateString) return '';
      return new Date(dateString).toLocaleString();
    };

    return (
      <div className="dashboard-page">
        <h1>Welcome, {user?.name}!</h1>
        <div className="dashboard-grid">
          <div className="dashboard-card">
            <div className="dashboard-card-title">Total Users</div>
            <div className="dashboard-card-value">{stats.totalUsers}</div>
            <div className="dashboard-card-actions">
              <Link to="/users" className="btn btn-primary">
                Manage Users
              </Link>
            </div>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-card-title">Total Transactions</div>
            <div className="dashboard-card-value">{stats.totalTransactions}</div>
            <div className="dashboard-card-actions">
              <Link to="/transactions" className="btn btn-primary">
                View Transactions
              </Link>
            </div>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-card-title">Total Events</div>
            <div className="dashboard-card-value">{stats.totalEvents}</div>
            <div className="dashboard-card-actions">
              <Link to="/events" className="btn btn-primary">
                Manage Events
              </Link>
            </div>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-card-title">Total Promotions</div>
            <div className="dashboard-card-value">{stats.totalPromotions}</div>
            <div className="dashboard-card-actions">
              <Link to="/promotions" className="btn btn-primary">
                Manage Promotions
              </Link>
            </div>
          </div>
        </div>

        <div className="dashboard-two-column">
          <div className="dashboard-section">
            <div className="dashboard-section-header">Recent Events</div>
            {stats.recentEvents.length === 0 ? (
              <div className="dashboard-empty-state">No events found</div>
            ) : (
              <>
                <div>
                  {stats.recentEvents.map((event) => (
                    <div key={event.id} className="dashboard-list-item">
                      <div className="dashboard-list-item-title">
                        <Link to={`/events/${event.id}`}>
                          {event.name}
                        </Link>
                      </div>
                      <div className="dashboard-list-item-meta">
                        {formatDate(event.startTime)}
                      </div>
                      <div className="dashboard-list-item-badges">
                        {!event.published && (
                          <span className="dashboard-badge dashboard-badge-warning">
                            Unpublished
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="dashboard-section-actions">
                  <Link to="/events" className="btn btn-secondary">View All Events</Link>
                  <Link to="/events/create" className="btn btn-primary">Create Event</Link>
                </div>
              </>
            )}
          </div>

          <div className="dashboard-section">
            <div className="dashboard-section-header">Recent Promotions</div>
            {stats.recentPromotions.length === 0 ? (
              <div className="dashboard-empty-state">No promotions found</div>
            ) : (
              <>
                <div>
                  {stats.recentPromotions.map((promo) => {
                    const isActive = () => {
                      const now = new Date();
                      const start = new Date(promo.startTime);
                      const end = new Date(promo.endTime);
                      return now >= start && now <= end;
                    };
                    return (
                      <div key={promo.id} className="dashboard-list-item">
                        <div className="dashboard-list-item-title">{promo.name}</div>
                        <div className="dashboard-list-item-description">{promo.description}</div>
                        <div className="dashboard-list-item-badges">
                          <span className={`dashboard-badge ${promo.type === 'automatic' ? 'dashboard-badge-primary' : 'dashboard-badge-secondary'}`}>
                            {promo.type}
                          </span>
                            {isActive() ? (
                              <span className="dashboard-badge dashboard-badge-success">
                                Active
                              </span>
                            ) : (
                              <span className={`dashboard-badge ${new Date(promo.startTime) > new Date() ? 'dashboard-badge-secondary' : 'dashboard-badge-danger'}`}>
                                {new Date(promo.startTime) > new Date() ? 'Upcoming' : 'Expired'}
                              </span>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="dashboard-section-actions">
                  <Link to="/promotions" className="btn btn-secondary">View All Promotions</Link>
                  <Link to="/promotions/create" className="btn btn-primary">Create Promotion</Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Fallback (shouldn't reach here)
  return (
    <div className="dashboard-page">
      <h1>Welcome, {user?.name}!</h1>
      <p>Loading dashboard...</p>
    </div>
  );
};

export default Dashboard;

