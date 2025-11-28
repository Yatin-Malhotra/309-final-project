// Transactions management page
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { transactionAPI } from '../services/api';
import { Link, useSearchParams } from 'react-router-dom';

const Transactions = () => {
  const { user, hasRole } = useAuth();
  const isCashierOnly = hasRole('cashier') && !hasRole('manager');
  const [searchParams, setSearchParams] = useSearchParams();
  const [transactions, setTransactions] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: searchParams.get('type') || '',
    page: parseInt(searchParams.get('page')) || 1,
    limit: parseInt(searchParams.get('limit')) || 10,
    processed: searchParams.get('processed') || '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadTransactions();
  }, [filters, user]);

  const loadTransactions = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { ...filters };
      Object.keys(params).forEach((key) => {
        if (!params[key]) delete params[key];
      });

      let response;
      if (hasRole('manager')) {
        response = await transactionAPI.getTransactions(params);
      } else if (hasRole('cashier')) {
        // Cashiers only see redemption transactions
        response = await transactionAPI.getRedemptionTransactions(params);
      } else {
        response = await transactionAPI.getMyTransactions(params);
      }

      setTransactions(response.data.results || []);
      setCount(response.data.count || 0);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    // Only reset to page 1 if changing a non-page filter
    if (key !== 'page') {
      newFilters.page = 1;
    }
    setFilters(newFilters);
    setSearchParams(newFilters);
  };

  const handleProcessRedemption = async (transactionId) => {
    if (!confirm('Process this redemption?')) return;

    try {
      await transactionAPI.processRedemption(transactionId);
      loadTransactions();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to process redemption.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString();
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

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>{isCashierOnly ? 'Redemption Transactions' : 'Transactions'}</h1>
        <Link to="/transactions/create" className="btn btn-primary">
          Create Transaction
        </Link>
      </div>

      <div className="filters">
        {!isCashierOnly && (
          <div className="form-group">
            <label>Type</label>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
            >
              <option value="">All</option>
              <option value="purchase">Purchase</option>
              <option value="redemption">Redemption</option>
              <option value="adjustment">Adjustment</option>
              <option value="event">Event</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
        )}
        {isCashierOnly && (
          <div className="form-group">
            <label>Status</label>
            <select
              value={filters.processed}
              onChange={(e) => handleFilterChange('processed', e.target.value)}
            >
              <option value="">All</option>
              <option value="false">Pending</option>
              <option value="true">Processed</option>
            </select>
          </div>
        )}
        <div className="form-group">
          <label>Limit</label>
          <select
            value={filters.limit}
            onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
        <div className="filters-actions">
          <button onClick={loadTransactions} className="btn btn-secondary">
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">Loading transactions...</div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">No transactions found</div>
      ) : (
        <>
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  {!isCashierOnly && <th>Type</th>}
                  <th>Amount</th>
                  {(hasRole('manager') || isCashierOnly) && <th>User</th>}
                  <th>Date</th>
                  <th>Status</th>
                  {hasRole('cashier') && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{tx.id}</td>
                    {!isCashierOnly && (
                      <td>
                        <span className={`badge ${getTransactionTypeBadge(tx.type)}`}>
                          {tx.type}
                        </span>
                      </td>
                    )}
                    <td>
                      {isCashierOnly ? (tx.redeemed || Math.abs(tx.amount)) : tx.amount}
                    </td>
                    {(hasRole('manager') || isCashierOnly) && (
                      <td>{tx.userName || tx.utorid || tx.user?.utorid}</td>
                    )}
                    <td>{tx.createdAt ? formatDate(tx.createdAt) : 'N/A'}</td>
                    <td>
                      {tx.processed ? (
                        <span className="badge badge-success">Processed</span>
                      ) : (
                        <span className="badge badge-warning">Pending</span>
                      )}
                    </td>
                    {hasRole('cashier') && !tx.processed && (isCashierOnly || tx.type === 'redemption') && (
                      <td>
                        <button
                          onClick={() => handleProcessRedemption(tx.id)}
                          className="btn btn-success"
                          style={{ padding: '5px 10px', fontSize: '12px' }}
                        >
                          Process
                        </button>
                      </td>
                    )}
                    {hasRole('cashier') && tx.processed && <td>-</td>}
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

export default Transactions;

