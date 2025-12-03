// Dashboard page - main landing page after login
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { transactionAPI, eventAPI, promotionAPI, userAPI, analyticsAPI } from '../services/api';
import { Link, useNavigate } from 'react-router-dom';
import AnalyticsCard from '../components/AnalyticsCard';
import AnimatedNumber from '../components/AnimatedNumber';
import SimpleChart from '../components/SimpleChart';
import QRCodeModal from '../components/QRCodeModal';
import QRScannerModal from '../components/QRScannerModal';
import TransactionModal from '../components/TransactionModal';
import SortableTable from '../components/SortableTable';
import '../styles/pages/Dashboard.css';

const Dashboard = () => {
  const { user, hasRole, currentRole, updateLocalUser } = useAuth();
  const navigate = useNavigate();
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
  const [showQRCode, setShowQRCode] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionModalType, setTransactionModalType] = useState('redemption');
  const [collapsedSections, setCollapsedSections] = useState({
    userAnalytics: false,
    transactionAnalytics: false,
    eventAnalytics: false,
    promotionAnalytics: false,
  });

  const loadDashboard = useCallback(async () => {
    if (!user || !currentRole) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const userRole = currentRole;
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

            // Points trend (last 2 weeks)
            const formatDate = (date) => {
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              return `${months[date.getMonth()]} ${date.getDate()}`;
            };
            
            const pointsTrend = [];
            for (let i = 13; i >= 0; i--) {
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
                date: formatDate(date),
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
            // Count upcoming events that the user is registered for
            const upcomingEventsRegistered = allEvents.filter(
              event => new Date(event.startTime) > now && event.isRegistered === true
            );
            const activePromotions = await promotionAPI.getPromotions({ 
              utorid: user.utorid 
            });
            const activePromos = activePromotions.data.results || [];
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
              // Ensure manager stats are initialized
              totalEvents: 0,
              totalPromotions: 0,
              totalUsers: 0,
              totalTransactions: 0,
              recentEvents: [],
              recentPromotions: [],
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
                upcomingEvents: upcomingEventsRegistered.length,
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

            // Format dates in dailyVolume to match user dashboard format
            const formatDate = (date) => {
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              return `${months[date.getMonth()]} ${date.getDate()}`;
            };

            const formattedAnalytics = {
              ...cashierAnalytics.data,
              dailyVolume: cashierAnalytics.data.dailyVolume?.map(item => ({
                ...item,
                date: formatDate(new Date(item.date))
              })) || []
            };

            setStats({
              totalPoints: points,
              recentTransactions: txResponse.data.results || [],
              pendingRedemptions: pendingCount,
              // Ensure manager stats are initialized
              totalEvents: 0,
              totalPromotions: 0,
              totalUsers: 0,
              totalTransactions: 0,
              recentEvents: [],
              recentPromotions: [],
            });

            setAnalytics(formattedAnalytics);
          }
          // For managers and superusers: show overview of events, promotions, and users
          else if (userRole === 'manager' || userRole === 'superuser') {
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

            // Format dates for charts (same format as user dashboard)
            const formatDate = (date) => {
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              return `${months[date.getMonth()]} ${date.getDate()}`;
            };

            // Format overview dates
            const formattedOverview = {
              ...overview.data,
              userGrowthTrend: overview.data.userGrowthTrend?.map(item => ({
                ...item,
                date: formatDate(new Date(item.date))
              })) || []
            };

            // Format transaction dates
            const formattedTransactions = {
              ...transactionAnalytics.data,
              volumeTrend: transactionAnalytics.data.volumeTrend?.map(item => ({
                ...item,
                date: formatDate(new Date(item.date))
              })) || [],
              pointsFlow: transactionAnalytics.data.pointsFlow?.map(item => ({
                ...item,
                date: formatDate(new Date(item.date))
              })) || []
            };

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
              overview: formattedOverview,
              users: userAnalytics.data,
              transactions: formattedTransactions,
              events: eventAnalytics.data,
              promotions: promotionAnalytics.data,
              financial: financialAnalytics.data
            });
          }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [user, currentRole]);

  useEffect(() => {
    updateLocalUser();
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleQRScanSuccess = (scannedUtorid) => {
    // Close the scanner modal
    setShowQRScanner(false);
    
    // Navigate to create transaction page with UTORid in state
    navigate('/transactions/create', { 
      state: { utorid: scannedUtorid } 
    });
  };

  if (loading) {
    return <div className="dashboard-loading">Loading dashboard...</div>;
  }

  const userRole = currentRole;

  if (!user || !currentRole) {
    return <div className="dashboard-page"><h1>Loading dashboard...</h1></div>;
  }

  // Regular User Dashboard: Points balance and recent transactions
  if (userRole === 'regular') {
    return (
      <div className="dashboard-page">
        <div className="dashboard-header-with-badge">
          <h1>Welcome, {user?.name}!</h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {user?.verified ? (
              <span className="dashboard-badge dashboard-badge-success dashboard-header-badge">Verified</span>
            ) : (
              <span className="dashboard-badge dashboard-badge-warning dashboard-header-badge">Unverified</span>
            )}
            <button 
              onClick={() => setShowQRCode(true)} 
              className="dashboard-header-badge"
              style={{ 
                background: 'var(--primary)', 
                color: 'white', 
                border: 'none', 
                cursor: 'pointer',
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '6px',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => {
                e.target.style.opacity = '0.9';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.opacity = '1';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              <span>📱</span>
              <span>Scan QR Code</span>
            </button>
          </div>
        </div>
        <div className="dashboard-grid">
          <div className="dashboard-card dashboard-quick-access-card">
            <div className="dashboard-quick-access-value">
              <AnimatedNumber value={stats.totalPoints} />
            </div>
            <div className="dashboard-quick-access-content">
              <div className="dashboard-quick-access-title">Your Points Balance</div>
              <div className="dashboard-quick-access-description">Available points</div>
            </div>
          </div>
          <div 
            className="dashboard-card dashboard-quick-access-card" 
            style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
            onClick={() => {
              setTransactionModalType('transfer');
              setShowTransactionModal(true);
            }}
          >
            <div className="dashboard-quick-access-icon">↗</div>
            <div className="dashboard-quick-access-content">
              <div className="dashboard-quick-access-title">Transfer Points</div>
              <div className="dashboard-quick-access-description">Send points to other users</div>
            </div>
            <div className="dashboard-quick-access-arrow">→</div>
          </div>
          <div 
            className="dashboard-card dashboard-quick-access-card" 
            style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
            onClick={() => {
              setTransactionModalType('redemption');
              setShowTransactionModal(true);
            }}
          >
            <div className="dashboard-quick-access-icon">🎁</div>
            <div className="dashboard-quick-access-content">
              <div className="dashboard-quick-access-title">Redeem Points</div>
              <div className="dashboard-quick-access-description">Redeem your points for rewards</div>
            </div>
            <div className="dashboard-quick-access-arrow">→</div>
          </div>
          <Link to="/events" className="dashboard-card dashboard-quick-access-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="dashboard-quick-access-icon">📅</div>
            <div className="dashboard-quick-access-content">
              <div className="dashboard-quick-access-title">Browse Events</div>
              <div className="dashboard-quick-access-description">Discover and register for events</div>
            </div>
            <div className="dashboard-quick-access-arrow">→</div>
          </Link>
        </div>

        <QRCodeModal isOpen={showQRCode} onClose={() => setShowQRCode(false)} />
        <TransactionModal 
          isOpen={showTransactionModal} 
          onClose={() => setShowTransactionModal(false)} 
          defaultType={transactionModalType}
          onSuccess={loadDashboard}
        />

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
                <p className="analytics-chart-caption">
                  Daily Earnings vs Spendings
                </p>
              </div>
            )}
          </div>
        )}

        <div className="dashboard-section">
          <div className="dashboard-section-header">Recent Transactions</div>
          {stats.recentTransactions.length === 0 ? (
            <div className="dashboard-empty-state">No recent transactions</div>
          ) : (
            <>
              <SortableTable
                data={stats.recentTransactions}
                columns={[
                  { key: 'type', label: 'Type' },
                  { key: 'amount', label: 'Amount' },
                  { key: 'date', label: 'Date' },
                  { key: 'status', label: 'Status' },
                ]}
                config={{
                  type: { accessor: (tx) => tx.type },
                  amount: { sortFn: (a, b) => a.amount - b.amount },
                  date: { accessor: (tx) => tx.createdAt ? new Date(tx.createdAt).getTime() : 0 },
                  status: { sortFn: (a, b) => (a.processed ? 1 : 0) - (b.processed ? 1 : 0) },
                }}
                className="dashboard-table"
                renderRow={(tx) => (
                  <tr key={tx.id}>
                    <td>
                      <span className={`dashboard-badge ${
                        tx.type === 'purchase' ? 'dashboard-badge-blue' :
                        tx.type === 'redemption' ? 'dashboard-badge-danger' :
                        tx.type === 'event' ? 'dashboard-badge-success' :
                        tx.type === 'adjustment' ? 'dashboard-badge-warning' :
                        'dashboard-badge-secondary'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td>
                      {tx.amount} points
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
                )}
              />
              <div className="dashboard-section-actions">
                <Link to="/transactions" className="btn btn-secondary">
                  View All Transactions
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Transaction Insights and Engagement */}
        {(analytics?.transactionInsights || analytics?.engagement) && (
          <div className="dashboard-two-column">
            {analytics?.transactionInsights && (
              <div className="dashboard-section">
                <div className="dashboard-section-header">Transaction Insights</div>
                <div className="dashboard-grid dashboard-grid-vertical">
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
                    value={analytics.transactionInsights.mostCommonType ? 
                      analytics.transactionInsights.mostCommonType.charAt(0).toUpperCase() + 
                      analytics.transactionInsights.mostCommonType.slice(1).toLowerCase() : 
                      ''}
                  />
                </div>
              </div>
            )}

            {analytics?.engagement && (
              <div className="dashboard-section">
                <div className="dashboard-section-header">Engagement</div>
                <div className="dashboard-grid dashboard-grid-vertical">
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
          </div>
        )}
      </div>
    );
  }

  // Cashier Dashboard: Quick access to transaction creation and redemption processing
  if (userRole === 'cashier') {
    return (
      <div className="dashboard-page">
        <div className="dashboard-header-with-badge">
          <h1>Welcome, {user?.name}!</h1>
          <button 
            onClick={() => setShowQRScanner(true)} 
            className="dashboard-header-badge"
            style={{ 
              background: 'var(--primary)', 
              color: 'white', 
              border: 'none', 
              cursor: 'pointer',
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '6px',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onMouseEnter={(e) => {
              e.target.style.opacity = '0.9';
              e.target.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.opacity = '1';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            <span>📷</span>
            <span>Scan QR Code</span>
          </button>
        </div>
        <div className="dashboard-grid">
        <Link to="/transactions" className="dashboard-card dashboard-quick-access-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="dashboard-quick-access-value">
              <AnimatedNumber value={stats.pendingRedemptions} />
            </div>
            <div className="dashboard-quick-access-content">
              <div className="dashboard-quick-access-title">Pending Redemptions</div>
              <div className="dashboard-quick-access-description">Awaiting processing</div>
            </div>
            <div className="dashboard-quick-access-arrow">→</div>
          </Link>
          <Link to="/transactions/create" className="dashboard-card dashboard-quick-access-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="dashboard-quick-access-icon">➕</div>
            <div className="dashboard-quick-access-content">
              <div className="dashboard-quick-access-title">Create Transaction</div>
              <div className="dashboard-quick-access-description">Create a new transaction</div>
            </div>
            <div className="dashboard-quick-access-arrow">→</div>
          </Link>
          <Link to="/users/create" className="dashboard-card dashboard-quick-access-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="dashboard-quick-access-icon">👤</div>
            <div className="dashboard-quick-access-content">
              <div className="dashboard-quick-access-title">Create User</div>
              <div className="dashboard-quick-access-description">Register a new user</div>
            </div>
            <div className="dashboard-quick-access-arrow">→</div>
          </Link>
          <Link to="/events" className="dashboard-card dashboard-quick-access-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="dashboard-quick-access-icon">📅</div>
            <div className="dashboard-quick-access-content">
              <div className="dashboard-quick-access-title">Browse Events</div>
              <div className="dashboard-quick-access-description">Discover and register for events</div>
            </div>
            <div className="dashboard-quick-access-arrow">→</div>
          </Link>
        </div>

        <QRScannerModal 
          isOpen={showQRScanner} 
          onClose={() => setShowQRScanner(false)}
          onScanSuccess={handleQRScanSuccess}
        />

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
            </div>
          </div>
        )}

        {/* Performance Metrics */}
        {analytics && (
          <div className="dashboard-section">
            <div className="dashboard-section-header">Performance Metrics</div>
            <div className="transaction-analytics-layout">
              <div className="transaction-analytics-cards">
                <AnalyticsCard
                  title="Processing Rate"
                  value={`${analytics.processingRate || 0}%`}
                  description={`${analytics.pendingRedemptions || 0} pending redemptions`}
                />
                <AnalyticsCard
                  title="Total Redemptions Processed"
                  value={analytics.redemptions?.month || 0}
                  subtitle={`${analytics.redemptions?.week || 0} this week, ${analytics.redemptions?.today || 0} today`}
                />
              </div>
              {analytics.typeBreakdown && (
                <div className="transaction-analytics-chart">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                    <p className="analytics-chart-caption" style={{ marginTop: 0, marginBottom: '16px' }}>
                      Transaction Types Distribution
                    </p>
                    <SimpleChart
                      type="pie"
                      data={Object.entries(analytics.typeBreakdown)
                        .filter(([name]) => name === 'purchase' || name === 'redemption')
                        .map(([name, value]) => ({ name, value }))}
                      dataKey="value"
                      xKey="name"
                      height={300}
                    />
                  </div>
                </div>
              )}
            </div>
            {analytics.topUsers && analytics.topUsers.length > 0 && (
              <div className="dashboard-grid" style={{ marginTop: '24px' }}>
                <AnalyticsCard
                  title="Most Active Users"
                  className="analytics-card-wide"
                >
                  <SortableTable
                    data={analytics.topUsers.slice(0, 5)}
                    columns={[
                      { key: 'user', label: 'User' },
                      { key: 'utorid', label: 'UTORid' },
                      { key: 'transactions', label: 'Transactions' },
                    ]}
                    config={{
                      user: { accessor: (item) => (item.name || '').toLowerCase() },
                      utorid: { accessor: (item) => (item.utorid || '').toLowerCase() },
                      transactions: { sortFn: (a, b) => a.transactionCount - b.transactionCount },
                    }}
                    className="dashboard-table"
                    renderRow={(userItem) => (
                      <tr key={userItem.userId}>
                        <td>{userItem.name}</td>
                        <td>{userItem.utorid}</td>
                        <td>{userItem.transactionCount}</td>
                      </tr>
                    )}
                  />
                </AnalyticsCard>
              </div>
            )}
          </div>
        )}

        {/* Activity Trends */}
        {analytics?.dailyVolume && analytics.dailyVolume.length > 0 && (
          <div className="dashboard-section">
            <div className="dashboard-section-header">Daily Transaction Volume (Last 7 Days)</div>
            <div className="analytics-chart-container">
              <SimpleChart
                type="bar"
                data={analytics.dailyVolume}
                dataKey="count"
                xKey="date"
                height={300}
              />
              <p className="analytics-chart-caption">
                Daily transaction count over the last 7 days
              </p>
            </div>
          </div>
        )}

        {/* Transaction Types Breakdown */}
        {analytics?.typeBreakdown && (
          <div className="dashboard-section">
            <div className="dashboard-section-header">Transaction Types Breakdown</div>
            <div style={{ marginTop: '24px' }}>
              <SortableTable
                data={Object.entries(analytics.typeBreakdown)
                  .filter(([type]) => type === 'purchase' || type === 'redemption')
                  .map(([type, count]) => ({ type, count }))}
                columns={[
                  { key: 'type', label: 'Transaction Type' },
                  { key: 'count', label: 'Count' },
                ]}
                config={{
                  type: { accessor: (item) => item.type.toLowerCase() },
                  count: { sortFn: (a, b) => a.count - b.count },
                }}
                className="dashboard-table"
                renderRow={({ type, count }) => (
                  <tr key={type}>
                    <td>
                      <span className={`dashboard-badge ${
                        type === 'purchase' ? 'dashboard-badge-blue' :
                        type === 'redemption' ? 'dashboard-badge-danger' :
                        'dashboard-badge-secondary'
                      }`}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </span>
                    </td>
                    <td>{count}</td>
                  </tr>
                )}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Manager/Superuser Dashboard: Overview of events, promotions, and user management
  if (userRole === 'manager' || userRole === 'superuser') {
    const formatDate = (dateString) => {
      if (!dateString) return '';
      return new Date(dateString).toLocaleString();
    };

    return (
      <div className="dashboard-page">
        <div className="dashboard-header-with-badge">
          <h1>Welcome, {user?.name}!</h1>
          <button 
            onClick={() => setShowQRScanner(true)} 
            className="dashboard-header-badge"
            style={{ 
              background: 'var(--primary)', 
              color: 'white', 
              border: 'none', 
              cursor: 'pointer',
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '6px',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onMouseEnter={(e) => {
              e.target.style.opacity = '0.9';
              e.target.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.opacity = '1';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            <span>📷</span>
            <span>Scan QR Code</span>
          </button>
        </div>
        <div className="dashboard-grid">
          <Link to="/users" className="dashboard-card dashboard-quick-access-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="dashboard-quick-access-value">
              <AnimatedNumber value={stats.totalUsers} />
            </div>
            <div className="dashboard-quick-access-content">
              <div className="dashboard-quick-access-title">Total Users</div>
              <div className="dashboard-quick-access-description">Manage user accounts</div>
            </div>
            <div className="dashboard-quick-access-arrow">→</div>
          </Link>
          <Link to="/transactions" className="dashboard-card dashboard-quick-access-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="dashboard-quick-access-value">
              <AnimatedNumber value={stats.totalTransactions} />
            </div>
            <div className="dashboard-quick-access-content">
              <div className="dashboard-quick-access-title">Total Transactions</div>
              <div className="dashboard-quick-access-description">View all transactions</div>
            </div>
            <div className="dashboard-quick-access-arrow">→</div>
          </Link>
          <Link to="/events" className="dashboard-card dashboard-quick-access-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="dashboard-quick-access-value">
              <AnimatedNumber value={stats.totalEvents} />
            </div>
            <div className="dashboard-quick-access-content">
              <div className="dashboard-quick-access-title">Total Events</div>
              <div className="dashboard-quick-access-description">Manage events</div>
            </div>
            <div className="dashboard-quick-access-arrow">→</div>
          </Link>
          <Link to="/promotions" className="dashboard-card dashboard-quick-access-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="dashboard-quick-access-value">
              <AnimatedNumber value={stats.totalPromotions} />
            </div>
            <div className="dashboard-quick-access-content">
              <div className="dashboard-quick-access-title">Total Promotions</div>
              <div className="dashboard-quick-access-description">Manage promotions</div>
            </div>
            <div className="dashboard-quick-access-arrow">→</div>
          </Link>
        </div>

        <QRScannerModal 
          isOpen={showQRScanner} 
          onClose={() => setShowQRScanner(false)}
          onScanSuccess={handleQRScanSuccess}
        />

        {/* Financial Insights */}
        {analytics?.financial && (
          <div className="dashboard-section">
            <div className="dashboard-section-header">Financial Insights</div>
            <div className="dashboard-grid">
              <AnalyticsCard
                title="Total Earnings This Week"
                value={`$${(analytics.financial.totalSpent?.week || 0).toFixed(2)}`}
                subtitle={`Month: $${(analytics.financial.totalSpent?.month || 0).toFixed(2)}`}
              />
              <AnalyticsCard
                title="Average Earning per Transaction"
                value={`$${(analytics.financial.averageSpendingPerTransaction || 0).toFixed(2)}`}
              />
              <AnalyticsCard
                title="Points per Dollar Ratio"
                value={analytics.financial.pointsPerDollarRatio || 0}
              />
            </div>
          </div>
        )}

        {/* System Overview Analytics */}
        {analytics?.overview && (
          <div className="dashboard-section">
            <div className="dashboard-section-header">System Overview</div>
            <div className="system-overview-layout">
              <div className="system-overview-cards">
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
              </div>
              {analytics.overview.pointsDistribution && (
                <div className="system-overview-chart" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                  <p className="analytics-chart-caption" style={{ marginTop: 0, marginBottom: '16px', textAlign: 'center', width: '100%' }}>
                    Points Distribution by User Balance Range
                  </p>
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
                  Daily New User Registrations
                </p>
              </div>
            )}
          </div>
        )}

        <div className="dashboard-two-column">
          <div className="dashboard-section">
            <div className="dashboard-section-header">Recent Events</div>
            {!stats.recentEvents || stats.recentEvents.length === 0 ? (
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
            {!stats.recentPromotions || stats.recentPromotions.length === 0 ? (
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

        {/* User Analytics */}
        {analytics?.users && (
          <div className="dashboard-section">
            <div 
              className="dashboard-section-header dashboard-section-header-collapsible" 
              onClick={() => toggleSection('userAnalytics')}
              style={{ cursor: 'pointer', userSelect: 'none' }}
            >
              <span>User Analytics</span>
              <span style={{ float: 'right', transition: 'transform 0.3s ease', transform: collapsedSections.userAnalytics ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                ▼
              </span>
            </div>
            {!collapsedSections.userAnalytics && (
              <>
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
                <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>Top 5 Users by Points</h3>
                <SortableTable
                  data={analytics.users.topUsersByPoints.slice(0, 5)}
                  columns={[
                    { key: 'name', label: 'Name' },
                    { key: 'utorid', label: 'UTORid' },
                    { key: 'points', label: 'Points' },
                    { key: 'status', label: 'Status' },
                  ]}
                  config={{
                    name: { accessor: (u) => (u.name || '').toLowerCase() },
                    utorid: { accessor: (u) => (u.utorid || '').toLowerCase() },
                    points: { sortFn: (a, b) => a.points - b.points },
                    status: { sortFn: (a, b) => (a.verified ? 1 : 0) - (b.verified ? 1 : 0) },
                  }}
                  className="dashboard-table"
                  renderRow={(u) => (
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
                  )}
                />
              </div>
            )}
            {analytics.users.topUsersByTransactionCount && analytics.users.topUsersByTransactionCount.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>Top 5 Users by Transaction Count</h3>
                <SortableTable
                  data={analytics.users.topUsersByTransactionCount.slice(0, 5)}
                  columns={[
                    { key: 'name', label: 'Name' },
                    { key: 'utorid', label: 'UTORid' },
                    { key: 'transactions', label: 'Transactions' },
                    { key: 'points', label: 'Points' },
                  ]}
                  config={{
                    name: { accessor: (u) => (u.name || '').toLowerCase() },
                    utorid: { accessor: (u) => (u.utorid || '').toLowerCase() },
                    transactions: { sortFn: (a, b) => a.transactionCount - b.transactionCount },
                    points: { sortFn: (a, b) => a.points - b.points },
                  }}
                  className="dashboard-table"
                  renderRow={(u) => (
                    <tr key={u.userId}>
                      <td>{u.name}</td>
                      <td>{u.utorid}</td>
                      <td>{u.transactionCount}</td>
                      <td>{u.points}</td>
                    </tr>
                  )}
                />
              </div>
            )}
              </>
            )}
          </div>
        )}

        {/* Transaction Analytics */}
        {analytics?.transactions && (
          <div className="dashboard-section">
            <div 
              className="dashboard-section-header dashboard-section-header-collapsible" 
              onClick={() => toggleSection('transactionAnalytics')}
              style={{ cursor: 'pointer', userSelect: 'none' }}
            >
              <span>Transaction Analytics</span>
              <span style={{ float: 'right', transition: 'transform 0.3s ease', transform: collapsedSections.transactionAnalytics ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                ▼
              </span>
            </div>
            {!collapsedSections.transactionAnalytics && (
              <>
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
                    <div className="transaction-analytics-chart" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                      <p className="analytics-chart-caption" style={{ marginTop: 0, marginBottom: '16px', textAlign: 'center', width: '100%' }}>
                        Transaction Types Distribution
                      </p>
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
                      Daily Transaction Volume
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
                      Daily Earnings vs Spendings
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Event Analytics */}
        {analytics?.events && (
          <div className="dashboard-section">
            <div 
              className="dashboard-section-header dashboard-section-header-collapsible" 
              onClick={() => toggleSection('eventAnalytics')}
              style={{ cursor: 'pointer', userSelect: 'none' }}
            >
              <span>Event Analytics</span>
              <span style={{ float: 'right', transition: 'transform 0.3s ease', transform: collapsedSections.eventAnalytics ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                ▼
              </span>
            </div>
            {!collapsedSections.eventAnalytics && (
              <>
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
                <SortableTable
                  data={analytics.events.popularEvents}
                  columns={[
                    { key: 'name', label: 'Event Name' },
                    { key: 'guests', label: 'Guests' },
                    { key: 'capacity', label: 'Capacity' },
                  ]}
                  config={{
                    name: { accessor: (event) => (event.name || '').toLowerCase() },
                    guests: { sortFn: (a, b) => a.guestCount - b.guestCount },
                    capacity: { sortFn: (a, b) => {
                      const aCap = a.capacity || Infinity;
                      const bCap = b.capacity || Infinity;
                      return aCap - bCap;
                    }},
                  }}
                  className="dashboard-table"
                  renderRow={(event) => (
                    <tr key={event.eventId}>
                      <td>{event.name}</td>
                      <td>{event.guestCount}</td>
                      <td>{event.capacity || 'Unlimited'}</td>
                    </tr>
                  )}
                />
              </div>
            )}
              </>
            )}
          </div>
        )}

        {/* Promotion Analytics */}
        {analytics?.promotions && (
          <div className="dashboard-section">
            <div 
              className="dashboard-section-header dashboard-section-header-collapsible" 
              onClick={() => toggleSection('promotionAnalytics')}
              style={{ cursor: 'pointer', userSelect: 'none' }}
            >
              <span>Promotion Analytics</span>
              <span style={{ float: 'right', transition: 'transform 0.3s ease', transform: collapsedSections.promotionAnalytics ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                ▼
              </span>
            </div>
            {!collapsedSections.promotionAnalytics && (
              <>
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
                <SortableTable
                  data={analytics.promotions.effectivePromotions}
                  columns={[
                    { key: 'name', label: 'Promotion Name' },
                    { key: 'type', label: 'Type' },
                    { key: 'usageCount', label: 'Usage Count' },
                  ]}
                  config={{
                    name: { accessor: (promo) => (promo.name || '').toLowerCase() },
                    type: { accessor: (promo) => promo.type },
                    usageCount: { sortFn: (a, b) => a.usageCount - b.usageCount },
                  }}
                  className="dashboard-table"
                  renderRow={(promo) => (
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
                  )}
                />
              </div>
            )}
              </>
            )}
          </div>
        )}
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



