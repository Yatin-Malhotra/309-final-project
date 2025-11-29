// Dashboard page - main landing page after login
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { transactionAPI, eventAPI, promotionAPI, userAPI, analyticsAPI } from '../services/api';
import { Link } from 'react-router-dom';
import AnalyticsCard from '../components/AnalyticsCard';
import SimpleChart from '../components/SimpleChart';
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
  const [analytics, setAnalytics] = useState(null);
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
              limit: 100, // Get more transactions for analytics
              page: 1,
            });

            const allTransactions = txResponse.data.results || [];
            const recentTransactions = allTransactions.slice(0, 5);

            // Calculate analytics from transactions
            const now = new Date();
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            const monthAgo = new Date(now);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const earnedTypes = ['purchase', 'event', 'adjustment'];
            const pointsEarnedWeek = allTransactions
              .filter(tx => earnedTypes.includes(tx.type) && new Date(tx.createdAt) >= weekAgo)
              .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
            const pointsEarnedMonth = allTransactions
              .filter(tx => earnedTypes.includes(tx.type) && new Date(tx.createdAt) >= monthAgo)
              .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
            const pointsSpentWeek = allTransactions
              .filter(tx => tx.type === 'redemption' && new Date(tx.createdAt) >= weekAgo)
              .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
            const pointsSpentMonth = allTransactions
              .filter(tx => tx.type === 'redemption' && new Date(tx.createdAt) >= monthAgo)
              .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

            // Points trend (last 30 days)
            const pointsTrend = [];
            for (let i = 29; i >= 0; i--) {
              const date = new Date(now);
              date.setDate(date.getDate() - i);
              const nextDate = new Date(date);
              nextDate.setDate(nextDate.getDate() + 1);
              
              const earned = allTransactions
                .filter(tx => {
                  const txDate = new Date(tx.createdAt);
                  return earnedTypes.includes(tx.type) && txDate >= date && txDate < nextDate;
                })
                .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
              const spent = allTransactions
                .filter(tx => {
                  const txDate = new Date(tx.createdAt);
                  return tx.type === 'redemption' && txDate >= date && txDate < nextDate;
                })
                .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
              
              pointsTrend.push({
                date: date.toISOString().split('T')[0],
                earned,
                spent
              });
            }

            // Transaction insights
            const totalTransactionsMonth = allTransactions.filter(
              tx => new Date(tx.createdAt) >= monthAgo
            ).length;
            const avgTransactionValue = allTransactions.length > 0
              ? Math.round(allTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) / allTransactions.length)
              : 0;
            const typeCounts = {};
            allTransactions.forEach(tx => {
              typeCounts[tx.type] = (typeCounts[tx.type] || 0) + 1;
            });
            const mostCommonType = Object.keys(typeCounts).reduce((a, b) => 
              typeCounts[a] > typeCounts[b] ? a : b, 'purchase'
            );

            // Engagement metrics
            const eventsResponse = await eventAPI.getEvents({ limit: 100 });
            const allEvents = eventsResponse.data.results || [];
            // Count upcoming events (user may or may not be registered)
            const upcomingEvents = allEvents.filter(
              event => new Date(event.startTime) > now
            );
            const activePromotions = await promotionAPI.getPromotions();
            const activePromos = (activePromotions.data.results || []).filter(promo => {
              const start = new Date(promo.startTime);
              const end = new Date(promo.endTime);
              return now >= start && now <= end;
            });
            // Count events attended this month based on event transactions
            const eventsAttendedMonth = allTransactions.filter(tx => {
              if (tx.type !== 'event') return false;
              const txDate = new Date(tx.createdAt);
              return txDate >= monthAgo && txDate < now;
            }).length;

            setStats({
              totalPoints: points,
              recentTransactions,
              pendingRedemptions: 0,
            });

            setAnalytics({
              pointsActivity: {
                earnedWeek: pointsEarnedWeek,
                earnedMonth: pointsEarnedMonth,
                spentWeek: pointsSpentWeek,
                spentMonth: pointsSpentMonth,
                netWeek: pointsEarnedWeek - pointsSpentWeek,
                netMonth: pointsEarnedMonth - pointsSpentMonth,
                trend: pointsTrend
              },
              transactionInsights: {
                totalMonth: totalTransactionsMonth,
                averageValue: avgTransactionValue,
                mostCommonType
              },
              engagement: {
                upcomingEvents: upcomingEvents.length,
                activePromotions: activePromos.length,
                eventsAttendedMonth
              }
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

            // Load cashier analytics
            const cashierAnalytics = await analyticsAPI.getCashierStats();

            setStats({
              totalPoints: points,
              recentTransactions: txResponse.data.results || [],
              pendingRedemptions: pendingCount,
            });

            setAnalytics(cashierAnalytics.data);
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

            // Load all analytics
            const [overview, userAnalytics, transactionAnalytics, eventAnalytics, promotionAnalytics, financialAnalytics] = await Promise.all([
              analyticsAPI.getOverview(),
              analyticsAPI.getUserAnalytics(),
              analyticsAPI.getTransactionAnalytics(),
              analyticsAPI.getEventAnalytics(),
              analyticsAPI.getPromotionAnalytics(),
              analyticsAPI.getFinancialAnalytics()
            ]);

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

            setAnalytics({
              overview: overview.data,
              users: userAnalytics.data,
              transactions: transactionAnalytics.data,
              events: eventAnalytics.data,
              promotions: promotionAnalytics.data,
              financial: financialAnalytics.data
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

        {/* Points Activity Analytics */}
        {analytics?.pointsActivity && (
          <div className="dashboard-section">
            <div className="dashboard-section-header">Points Activity</div>
            <div className="dashboard-grid">
              <AnalyticsCard
                title="Points Earned This Week"
                value={analytics.pointsActivity.earnedWeek}
                subtitle={`${analytics.pointsActivity.earnedMonth} this month`}
              />
              <AnalyticsCard
                title="Points Spent This Week"
                value={analytics.pointsActivity.spentWeek}
                subtitle={`${analytics.pointsActivity.spentMonth} this month`}
              />
              <AnalyticsCard
                title="Net Change This Week"
                value={analytics.pointsActivity.netWeek}
                subtitle={`${analytics.pointsActivity.netMonth >= 0 ? '+' : ''}${analytics.pointsActivity.netMonth} this month`}
              />
            </div>
            {analytics.pointsActivity.trend && analytics.pointsActivity.trend.length > 0 && (
              <div className="analytics-chart-container">
                <SimpleChart
                  type="line"
                  data={analytics.pointsActivity.trend}
                  dataKey={['earned', 'spent']}
                  xKey="date"
                  height={300}
                />
              </div>
            )}
          </div>
        )}

        {/* Transaction Insights */}
        {analytics?.transactionInsights && (
          <div className="dashboard-section">
            <div className="dashboard-section-header">Transaction Insights</div>
            <div className="dashboard-grid">
              <AnalyticsCard
                title="Total Transactions This Month"
                value={analytics.transactionInsights.totalMonth}
              />
              <AnalyticsCard
                title="Average Transaction Value"
                value={`${analytics.transactionInsights.averageValue} pts`}
              />
              <AnalyticsCard
                title="Most Common Type"
                value={analytics.transactionInsights.mostCommonType}
              />
            </div>
          </div>
        )}

        {/* Engagement Metrics */}
        {analytics?.engagement && (
          <div className="dashboard-section">
            <div className="dashboard-section-header">Engagement</div>
            <div className="dashboard-grid">
              <AnalyticsCard
                title="Upcoming Events Registered"
                value={analytics.engagement.upcomingEvents}
              />
              <AnalyticsCard
                title="Active Promotions Available"
                value={analytics.engagement.activePromotions}
              />
              <AnalyticsCard
                title="Events Attended This Month"
                value={analytics.engagement.eventsAttendedMonth}
              />
            </div>
          </div>
        )}

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

        {/* Transaction Processing Metrics */}
        {analytics?.transactions && (
          <div className="dashboard-section">
            <div className="dashboard-section-header">Transaction Processing</div>
            <div className="dashboard-grid">
              <AnalyticsCard
                title="Transactions Created Today"
                value={analytics.transactions.today}
                subtitle={`${analytics.transactions.week} this week, ${analytics.transactions.month} this month`}
              />
              <AnalyticsCard
                title="Redemptions Processed Today"
                value={analytics.redemptions?.today || 0}
                subtitle={`${analytics.redemptions?.week || 0} this week, ${analytics.redemptions?.month || 0} this month`}
              />
              <AnalyticsCard
                title="Average Transaction Value"
                value={`${analytics.averageTransactionValue || 0} pts`}
              />
              <AnalyticsCard
                title="Points Issued Today"
                value={analytics.pointsIssued?.today || 0}
                subtitle={`${analytics.pointsIssued?.week || 0} this week`}
              />
            </div>
          </div>
        )}

        {/* Performance Metrics */}
        {analytics && (
          <div className="dashboard-section">
            <div className="dashboard-section-header">Performance Metrics</div>
            <div className="dashboard-grid">
              <AnalyticsCard
                title="Processing Rate"
                value={`${analytics.processingRate || 0}%`}
                description={`${analytics.pendingRedemptions || 0} pending redemptions`}
              />
              {analytics.topUsers && analytics.topUsers.length > 0 && (
                <AnalyticsCard
                  title="Most Active Users"
                  className="analytics-card-wide"
                >
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>UTORid</th>
                        <th>Transactions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.topUsers.slice(0, 5).map((userItem) => (
                        <tr key={userItem.userId}>
                          <td>{userItem.name}</td>
                          <td>{userItem.utorid}</td>
                          <td>{userItem.transactionCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </AnalyticsCard>
              )}
            </div>
          </div>
        )}

        {/* Activity Trends */}
        {analytics?.dailyVolume && analytics.dailyVolume.length > 0 && (
          <div className="dashboard-section">
            <div className="dashboard-section-header">Daily Transaction Volume (Last 7 Days)</div>
            <SimpleChart
              type="bar"
              data={analytics.dailyVolume}
              dataKey="count"
              xKey="date"
              height={300}
            />
          </div>
        )}

        {/* Transaction Types Breakdown */}
        {analytics?.typeBreakdown && (
          <div className="dashboard-section">
            <div className="dashboard-section-header">Transaction Types Breakdown</div>
            <div style={{ marginTop: '24px' }}>
              <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>Transaction Types</h3>
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Transaction Type</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(analytics.typeBreakdown).map(([type, count]) => (
                    <tr key={type}>
                      <td>
                        <span className={`dashboard-badge ${
                          type === 'purchase' ? 'dashboard-badge-primary' :
                          type === 'redemption' ? 'dashboard-badge-danger' :
                          type === 'event' ? 'dashboard-badge-success' :
                          'dashboard-badge-secondary'
                        }`}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </span>
                      </td>
                      <td>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="analytics-chart-container" style={{ marginTop: '24px' }}>
              <SimpleChart
                type="pie"
                data={Object.entries(analytics.typeBreakdown).map(([name, value]) => ({ name, value }))}
                dataKey="value"
                xKey="name"
                height={300}
              />
            </div>
          </div>
        )}

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

        {/* System Overview Analytics */}
        {analytics?.overview && (
          <div className="dashboard-section">
            <div className="dashboard-section-header">System Overview</div>
            <div className="system-overview-layout">
              <div className="system-overview-cards">
                <AnalyticsCard
                  title="Total Points in Circulation"
                  value={analytics.overview.totalPointsInCirculation || 0}
                />
                <AnalyticsCard
                  title="Points Earned This Week"
                  value={analytics.overview.pointsFlow?.week?.earned || 0}
                  subtitle={`Spent: ${analytics.overview.pointsFlow?.week?.spent || 0}`}
                />
                <AnalyticsCard
                  title="Net Points Flow (Week)"
                  value={analytics.overview.pointsFlow?.week?.net || 0}
                  subtitle={`Month: ${analytics.overview.pointsFlow?.month?.net || 0}`}
                />
                <AnalyticsCard
                  title="New Users This Week"
                  value={analytics.overview.userGrowth?.week || 0}
                  subtitle={`${analytics.overview.userGrowth?.month || 0} this month`}
                />
              </div>
              {analytics.overview.pointsDistribution && (
                <div className="system-overview-chart">
                  <SimpleChart
                    type="pie"
                    data={[
                      { name: '0-100 Points', value: analytics.overview.pointsDistribution['0-100'] || 0 },
                      { name: '100-500 Points', value: analytics.overview.pointsDistribution['100-500'] || 0 },
                      { name: '500-1000 Points', value: analytics.overview.pointsDistribution['500-1000'] || 0 },
                      { name: '1000+ Points', value: analytics.overview.pointsDistribution['1000+'] || 0 }
                    ]}
                    dataKey="value"
                    xKey="name"
                    height={300}
                  />
                </div>
              )}
            </div>
            {analytics.overview.userGrowthTrend && analytics.overview.userGrowthTrend.length > 0 && (
              <div className="analytics-chart-container" style={{ marginTop: '24px' }}>
                <SimpleChart
                  type="line"
                  data={analytics.overview.userGrowthTrend}
                  dataKey="count"
                  xKey="date"
                  height={300}
                />
                <p className="analytics-chart-caption">
                  Daily new user registrations over the last 14 days
                </p>
              </div>
            )}
          </div>
        )}

        {/* User Analytics */}
        {analytics?.users && (
          <div className="dashboard-section">
            <div className="dashboard-section-header">User Analytics</div>
            <div className="dashboard-grid">
              <AnalyticsCard
                title="Verified Users"
                value={analytics.users.verified?.verified || 0}
                subtitle={`Unverified: ${analytics.users.verified?.unverified || 0}`}
              />
              <AnalyticsCard
                title="Suspicious Users"
                value={analytics.users.suspicious || 0}
              />
              <AnalyticsCard
                title="New Users This Month"
                value={analytics.users.newUsers?.month || 0}
                subtitle={`Week: ${analytics.users.newUsers?.week || 0}`}
              />
            </div>
            {analytics.users.topUsersByPoints && analytics.users.topUsersByPoints.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>Top 10 Users by Points</h3>
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>UTORid</th>
                      <th>Points</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.users.topUsersByPoints.map((u) => (
                      <tr key={u.id}>
                        <td>{u.name}</td>
                        <td>{u.utorid}</td>
                        <td>{u.points}</td>
                        <td>
                          {u.verified ? (
                            <span className="dashboard-badge dashboard-badge-success">Verified</span>
                          ) : (
                            <span className="dashboard-badge dashboard-badge-warning">Unverified</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {analytics.users.topUsersByTransactionCount && analytics.users.topUsersByTransactionCount.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>Top 10 Users by Transaction Count</h3>
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>UTORid</th>
                      <th>Transactions</th>
                      <th>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.users.topUsersByTransactionCount.map((u) => (
                      <tr key={u.userId}>
                        <td>{u.name}</td>
                        <td>{u.utorid}</td>
                        <td>{u.transactionCount}</td>
                        <td>{u.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Transaction Analytics */}
        {analytics?.transactions && (
          <div className="dashboard-section">
            <div className="dashboard-section-header">Transaction Analytics</div>
            <div className="transaction-analytics-layout">
              <div className="transaction-analytics-cards">
                <AnalyticsCard
                  title="Transactions Today"
                  value={analytics.transactions.volume?.today || 0}
                  subtitle={`${analytics.transactions.volume?.week || 0} this week, ${analytics.transactions.volume?.month || 0} this month`}
                />
                <AnalyticsCard
                  title="Suspicious Transactions"
                  value={analytics.transactions.suspicious || 0}
                />
                <AnalyticsCard
                  title="Average Transaction Value"
                  value={`${analytics.transactions.averageTransactionValue || 0} pts`}
                />
              </div>
              {analytics.transactions.typeBreakdown && (
                <div className="transaction-analytics-chart">
                  <SimpleChart
                    type="pie"
                    data={Object.entries(analytics.transactions.typeBreakdown).map(([name, value]) => ({ name, value }))}
                    dataKey="value"
                    xKey="name"
                    height={300}
                  />
                </div>
              )}
            </div>
            {analytics.transactions.volumeTrend && analytics.transactions.volumeTrend.length > 0 && (
              <div className="analytics-chart-container">
                <SimpleChart
                  type="line"
                  data={analytics.transactions.volumeTrend}
                  dataKey="count"
                  xKey="date"
                  height={300}
                />
                <p className="analytics-chart-caption">
                  Daily transaction volume over the last 14 days
                </p>
              </div>
            )}
            {analytics.transactions.pointsFlow && analytics.transactions.pointsFlow.length > 0 && (
              <div className="analytics-chart-container" style={{ marginTop: '24px' }}>
                <SimpleChart
                  type="line"
                  data={analytics.transactions.pointsFlow}
                  dataKey={['earned', 'spent']}
                  xKey="date"
                  height={300}
                />
                <p className="analytics-chart-caption">
                  Daily points earned vs spent over the last 14 days
                </p>
              </div>
            )}
          </div>
        )}

        {/* Event Analytics */}
        {analytics?.events && (
          <div className="dashboard-section">
            <div className="dashboard-section-header">Event Analytics</div>
            <div className="dashboard-grid">
              <AnalyticsCard
                title="Published Events"
                value={analytics.events.published || 0}
                subtitle={`Unpublished: ${analytics.events.unpublished || 0}`}
              />
              <AnalyticsCard
                title="Upcoming Events"
                value={analytics.events.upcoming || 0}
              />
              <AnalyticsCard
                title="Total Points Allocated"
                value={analytics.events.totalPointsAllocated || 0}
                subtitle={`Remaining: ${analytics.events.totalPointsRemaining || 0}`}
              />
            </div>
            {analytics.events.popularEvents && analytics.events.popularEvents.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>Most Popular Events</h3>
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Event Name</th>
                      <th>Guests</th>
                      <th>Capacity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.events.popularEvents.map((event) => (
                      <tr key={event.eventId}>
                        <td>{event.name}</td>
                        <td>{event.guestCount}</td>
                        <td>{event.capacity || 'Unlimited'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Promotion Analytics */}
        {analytics?.promotions && (
          <div className="dashboard-section">
            <div className="dashboard-section-header">Promotion Analytics</div>
            <div className="dashboard-grid">
              <AnalyticsCard
                title="Active Promotions"
                value={analytics.promotions.active || 0}
                subtitle={`Total: ${analytics.promotions.total || 0}`}
              />
              <AnalyticsCard
                title="Automatic Promotions"
                value={analytics.promotions.typeBreakdown?.automatic || 0}
                subtitle={`One-time: ${analytics.promotions.typeBreakdown?.onetime || 0}`}
              />
              <AnalyticsCard
                title="Total Points Awarded"
                value={analytics.promotions.totalPointsAwarded || 0}
              />
            </div>
            {analytics.promotions.effectivePromotions && analytics.promotions.effectivePromotions.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>Most Effective Promotions</h3>
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Promotion Name</th>
                      <th>Type</th>
                      <th>Usage Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.promotions.effectivePromotions.map((promo) => (
                      <tr key={promo.promotionId}>
                        <td>{promo.name}</td>
                        <td>
                          <span className={`dashboard-badge ${
                            promo.type === 'automatic' ? 'dashboard-badge-primary' : 'dashboard-badge-secondary'
                          }`}>
                            {promo.type}
                          </span>
                        </td>
                        <td>{promo.usageCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Financial Insights */}
        {analytics?.financial && (
          <div className="dashboard-section">
            <div className="dashboard-section-header">Financial Insights</div>
            <div className="dashboard-grid">
              <AnalyticsCard
                title="Total Spent This Week"
                value={`$${(analytics.financial.totalSpent?.week || 0).toFixed(2)}`}
                subtitle={`Month: $${(analytics.financial.totalSpent?.month || 0).toFixed(2)}`}
              />
              <AnalyticsCard
                title="Average Spending per Transaction"
                value={`$${(analytics.financial.averageSpendingPerTransaction || 0).toFixed(2)}`}
              />
              <AnalyticsCard
                title="Points per Dollar Ratio"
                value={analytics.financial.pointsPerDollarRatio || 0}
              />
            </div>
          </div>
        )}

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

