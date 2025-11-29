// Dashboard page - main landing page after login
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { transactionAPI, eventAPI, promotionAPI, userAPI } from '../services/api';
import { Link } from 'react-router-dom';

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
    return <div className="loading">Loading dashboard...</div>;
  }

  const userRole = user?.role;

  // Regular User Dashboard: Points balance and recent transactions
  if (userRole === 'regular') {
    return (
      <div className="container">
        <h1>Welcome, {user?.name}!</h1>
        <div className="dashboard-grid">
          <div className="dashboard-card">
            <div className="dashboard-card-title">Your Points Balance</div>
            <div className="dashboard-card-value">{stats.totalPoints}</div>
          </div>
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
                    <td>
                      <span className={`badge ${
                        tx.type === 'purchase' ? 'badge-primary' :
                        tx.type === 'redemption' ? 'badge-danger' :
                        tx.type === 'event' ? 'badge-success' :
                        'badge-secondary'
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
      </div>
    );
  }

  // Cashier Dashboard: Quick access to transaction creation and redemption processing
  if (userRole === 'cashier') {
    return (
      <div className="container">
        <h1>Welcome, {user?.name}!</h1>
        <div className="dashboard-grid">
          <div className="dashboard-card">
            <div className="dashboard-card-title">Pending Redemptions</div>
            <div className="dashboard-card-value">
              {stats.pendingRedemptions}
            </div>
            <div style={{ marginTop: '10px' }}>
              <Link 
                to="/transactions" 
                className="btn btn-primary"
                style={{ fontSize: '14px', padding: '8px 16px' }}
              >
                View Redemptions
              </Link>
            </div>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-card-title">Quick Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              <Link to="/transactions/create" className="btn btn-primary">
                Create Transaction
              </Link>
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
                    <td>
                      <span className={`badge ${
                        tx.type === 'purchase' ? 'badge-primary' :
                        tx.type === 'redemption' ? 'badge-danger' :
                        'badge-secondary'
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
      <div className="container">
        <h1>Welcome, {user?.name}!</h1>
        <div className="dashboard-grid">
          <div className="dashboard-card">
            <div className="dashboard-card-title">Total Events</div>
            <div className="dashboard-card-value">{stats.totalEvents}</div>
            <div style={{ marginTop: '10px' }}>
              <Link to="/events" className="btn btn-primary" style={{ fontSize: '14px', padding: '8px 16px' }}>
                Manage Events
              </Link>
            </div>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-card-title">Total Promotions</div>
            <div className="dashboard-card-value">{stats.totalPromotions}</div>
            <div style={{ marginTop: '10px' }}>
              <Link to="/promotions" className="btn btn-primary" style={{ fontSize: '14px', padding: '8px 16px' }}>
                Manage Promotions
              </Link>
            </div>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-card-title">Total Users</div>
            <div className="dashboard-card-value">{stats.totalUsers}</div>
            <div style={{ marginTop: '10px' }}>
              <Link to="/users" className="btn btn-primary" style={{ fontSize: '14px', padding: '8px 16px' }}>
                Manage Users
              </Link>
            </div>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-card-title">Total Transactions</div>
            <div className="dashboard-card-value">{stats.totalTransactions}</div>
            <div style={{ marginTop: '10px' }}>
              <Link to="/transactions" className="btn btn-primary" style={{ fontSize: '14px', padding: '8px 16px' }}>
                View Transactions
              </Link>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginTop: '20px' }}>
          <div className="card">
            <div className="card-header">Recent Events</div>
            {stats.recentEvents.length === 0 ? (
              <div className="empty-state">No events found</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {stats.recentEvents.map((event) => (
                  <div key={event.id} style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <Link to={`/events/${event.id}`} style={{ fontWeight: '600', color: '#007bff', textDecoration: 'none' }}>
                          {event.name}
                        </Link>
                        <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                          {formatDate(event.startTime)}
                        </p>
                        <div style={{ marginTop: '5px' }}>
                          <span className="badge badge-secondary" style={{ fontSize: '11px' }}>
                            {event.numGuests} / {event.capacity || '∞'} guests
                          </span>
                          {!event.published && (
                            <span className="badge badge-warning" style={{ marginLeft: '5px', fontSize: '11px' }}>
                              Unpublished
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: '15px' }}>
              <Link to="/events" className="btn btn-secondary">View All Events</Link>
              <Link to="/events/create" className="btn btn-primary" style={{ marginLeft: '10px' }}>Create Event</Link>
            </div>
          </div>

          <div className="card">
            <div className="card-header">Recent Promotions</div>
            {stats.recentPromotions.length === 0 ? (
              <div className="empty-state">No promotions found</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {stats.recentPromotions.map((promo) => {
                  const isActive = () => {
                    const now = new Date();
                    const start = new Date(promo.startTime);
                    const end = new Date(promo.endTime);
                    return now >= start && now <= end;
                  };
                  return (
                    <div key={promo.id} style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600' }}>{promo.name}</div>
                          <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                            {promo.description}
                          </p>
                          <div style={{ marginTop: '5px' }}>
                            <span className={`badge ${promo.type === 'automatic' ? 'badge-primary' : 'badge-secondary'}`} style={{ fontSize: '11px' }}>
                              {promo.type}
                            </span>
                            {isActive() ? (
                              <span className="badge badge-success" style={{ marginLeft: '5px', fontSize: '11px' }}>
                                Active
                              </span>
                            ) : (
                              <span className="badge badge-secondary" style={{ marginLeft: '5px', fontSize: '11px' }}>
                                {new Date(promo.startTime) > new Date() ? 'Upcoming' : 'Expired'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ marginTop: '15px' }}>
              <Link to="/promotions" className="btn btn-secondary">View All Promotions</Link>
              <Link to="/promotions/create" className="btn btn-primary" style={{ marginLeft: '10px' }}>Create Promotion</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback (shouldn't reach here)
  return (
    <div className="container">
      <h1>Welcome, {user?.name}!</h1>
      <p>Loading dashboard...</p>
    </div>
  );
};

export default Dashboard;

