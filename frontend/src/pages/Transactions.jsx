// Transactions management page
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { transactionAPI } from '../services/api';
import { Link, useSearchParams } from 'react-router-dom';
import './Transactions.css';

const Transactions = () => {
  const { user, hasRole } = useAuth();
  const isCashierOnly = hasRole('cashier') && !hasRole('manager');
  const [searchParams, setSearchParams] = useSearchParams();
  const [transactions, setTransactions] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: searchParams.get('type') || '',
    page: parseInt(searchParams.get('page')) || 1,
    limit: parseInt(searchParams.get('limit')) || 10,
    processed: searchParams.get('processed') || '',
  });
  const [clientFilters, setClientFilters] = useState({
    idNameSearch: '',
    status: '',
  });
  const [managerFilters, setManagerFilters] = useState({
    idUtoridSearch: '',
    status: '',
  });
  const [error, setError] = useState('');

  // Check if client-side filtering is active
  const hasClientSideFilters = () => {
    if (isCashierOnly) {
      return clientFilters.idNameSearch !== '' || clientFilters.status !== '';
    } else if (hasRole('manager')) {
      return managerFilters.idUtoridSearch !== '' || managerFilters.status !== '';
    }
    return false;
  };

  useEffect(() => {
    loadTransactions();
  }, [filters, user]);

  // Reset to page 1 and reload when client-side filters change
  useEffect(() => {
    const hasFilters = hasClientSideFilters();
    
    // Reset to page 1 if filters are active and we're not already on page 1
    if (hasFilters && filters.page !== 1) {
      const newFilters = { ...filters, page: 1 };
      setFilters(newFilters);
      setSearchParams(newFilters);
      // Don't reload here - the filters change will trigger the first useEffect
    } else {
      // Reload immediately if page is already 1 or filters were cleared
      loadTransactions();
    }
  }, [clientFilters.idNameSearch, clientFilters.status, managerFilters.idUtoridSearch, managerFilters.status]);

  // Client-side filtering
  useEffect(() => {
    let filtered = [...allTransactions];

    if (isCashierOnly) {
      // Filter by id/name search for cashiers
      if (clientFilters.idNameSearch) {
        const searchTerm = clientFilters.idNameSearch.toLowerCase();
        filtered = filtered.filter((tx) => {
          const idMatch = tx.id.toString().includes(searchTerm);
          const nameMatch = (tx.userName || tx.utorid || tx.user?.utorid || '')
            .toLowerCase()
            .includes(searchTerm);
          return idMatch || nameMatch;
        });
      }

      // Filter by status for cashiers
      if (clientFilters.status !== '') {
        const statusFilter = clientFilters.status === 'true';
        filtered = filtered.filter((tx) => tx.processed === statusFilter);
      }
    } else if (hasRole('manager')) {
      // Filter by id/utorid search for managers
      if (managerFilters.idUtoridSearch) {
        const searchTerm = managerFilters.idUtoridSearch.toLowerCase();
        filtered = filtered.filter((tx) => {
          const idMatch = tx.id.toString().includes(searchTerm);
          const utoridMatch = (tx.utorid || tx.user?.utorid || '')
            .toLowerCase()
            .includes(searchTerm);
          return idMatch || utoridMatch;
        });
      }

      // Filter by status for managers
      if (managerFilters.status !== '') {
        const statusFilter = managerFilters.status === 'true';
        filtered = filtered.filter((tx) => tx.processed === statusFilter);
      }
    }

    setFilteredTransactions(filtered);

    // Apply client-side pagination if filters are active
    if (hasClientSideFilters()) {
      const startIndex = (filters.page - 1) * filters.limit;
      const endIndex = startIndex + filters.limit;
      setTransactions(filtered.slice(startIndex, endIndex));
    } else {
      // Use server-side paginated results
      setTransactions(filtered);
    }
  }, [clientFilters, managerFilters, allTransactions, isCashierOnly, hasRole, filters.page, filters.limit]);

  const loadTransactions = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { ...filters };
      
      // If client-side filters are active, fetch maximum results for client-side filtering
      if (hasClientSideFilters()) {
        // Remove page parameter and set limit to maximum (100) to get more results for client-side filtering
        delete params.page;
        params.limit = 100; // Maximum allowed by backend
      } else {
        // Keep server-side pagination when no client-side filters
        Object.keys(params).forEach((key) => {
          if (!params[key]) delete params[key];
        });
      }

      let response;
      if (hasRole('manager')) {
        response = await transactionAPI.getTransactions(params);
      } else if (hasRole('cashier')) {
        // Cashiers only see redemption transactions
        response = await transactionAPI.getRedemptionTransactions(params);
      } else {
        response = await transactionAPI.getMyTransactions(params);
      }

      const fetchedTransactions = response.data.results || [];
      setAllTransactions(fetchedTransactions);
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

  const handleToggleSuspicious = async (transactionId, currentSuspicious) => {
    const action = currentSuspicious ? 'unmark' : 'mark';
    if (!confirm(`Are you sure you want to ${action} this transaction as suspicious?`)) return;

    try {
      await transactionAPI.markSuspicious(transactionId, !currentSuspicious);
      loadTransactions();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update suspicious status.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString();
  };

  const getTransactionTypeBadge = (type) => {
    const colors = {
      purchase: 'transactions-badge-primary',
      redemption: 'transactions-badge-danger',
      adjustment: 'transactions-badge-warning',
      event: 'transactions-badge-success',
      transfer: 'transactions-badge-secondary',
    };
    return colors[type] || 'transactions-badge-secondary';
  };

  return (
    <div className="transactions-page">
      <div className="transactions-page-header">
        <h1>{isCashierOnly ? 'Redemption Transactions' : 'Transactions'}</h1>
        <Link to="/transactions/create" className="btn btn-primary">
          Create Transaction
        </Link>
      </div>

      <div className="transactions-filters">
        {!isCashierOnly && (
          <>
            {hasRole('manager') && (
              <div className="form-group">
                <label>Search</label>
                <input
                  type="text"
                  placeholder="ID or UTORid"
                  value={managerFilters.idUtoridSearch}
                  onChange={(e) =>
                    setManagerFilters({ ...managerFilters, idUtoridSearch: e.target.value })
                  }
                  className="transactions-search-input"
                />
              </div>
            )}
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
            {hasRole('manager') && (
              <div className="form-group">
                <label>Status</label>
                <select
                  value={managerFilters.status}
                  onChange={(e) =>
                    setManagerFilters({ ...managerFilters, status: e.target.value })
                  }
                >
                  <option value="">All</option>
                  <option value="false">Pending</option>
                  <option value="true">Processed</option>
                </select>
              </div>
            )}
          </>
        )}
        {isCashierOnly && (
          <>
            <div className="form-group">
              <label>Search</label>
              <input
                type="text"
                placeholder="Name or ID"
                value={clientFilters.idNameSearch}
                onChange={(e) =>
                  setClientFilters({ ...clientFilters, idNameSearch: e.target.value })
                }
                className="transactions-search-input"
              />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select
                value={clientFilters.status}
                onChange={(e) =>
                  setClientFilters({ ...clientFilters, status: e.target.value })
                }
              >
                <option value="">All</option>
                <option value="false">Pending</option>
                <option value="true">Processed</option>
              </select>
            </div>
          </>
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
        <div className="transactions-filters-actions">
          <button onClick={loadTransactions} className="btn btn-secondary transactions-refresh-btn" title="Refresh">
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="transactions-error-message">{error}</div>}

      {loading ? (
        <div className="transactions-loading">Loading transactions...</div>
      ) : transactions.length === 0 ? (
        <div className="transactions-empty-state">No transactions found</div>
      ) : (
        <>
          <div className="transactions-section">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>ID</th>
                  {(hasRole('manager') || isCashierOnly) && <th>User</th>}
                  {!isCashierOnly && <th>Type</th>}
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Status</th>
                  {(hasRole('manager') || hasRole('cashier')) && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{tx.id}</td>
                    {(hasRole('manager') || isCashierOnly) && (
                      <td>{tx.userName || tx.utorid || tx.user?.utorid}</td>
                    )}
                    {!isCashierOnly && (
                      <td>
                        <span className={`transactions-badge ${getTransactionTypeBadge(tx.type)}`}>
                          {tx.type}
                        </span>
                      </td>
                    )}
                    <td>
                      {isCashierOnly ? (tx.redeemed || Math.abs(tx.amount)) : tx.amount}
                    </td>
                    <td>{tx.createdAt ? formatDate(tx.createdAt) : 'N/A'}</td>
                    <td>
                      {tx.processed ? (
                        <span className="transactions-badge transactions-badge-success">Processed</span>
                      ) : (
                        <span className="transactions-badge transactions-badge-warning">Pending</span>
                      )}
                    </td>
                    {(hasRole('manager') || hasRole('cashier')) && (
                      <td>
                        <div className="transactions-actions-container">
                          {hasRole('cashier') && !tx.processed && (isCashierOnly || tx.type === 'redemption') && (
                            <button
                              onClick={() => handleProcessRedemption(tx.id)}
                              className="btn btn-success transactions-action-btn"
                            >
                              Process
                            </button>
                          )}
                          {hasRole('manager') && (tx.type === 'purchase' || tx.type === 'adjustment') && (
                            <>
                              {tx.suspicious ? (
                                <>
                                  <span className="transactions-badge transactions-badge-danger">Suspicious</span>
                                  <button
                                    onClick={() => handleToggleSuspicious(tx.id, true)}
                                    className="btn btn-outline-secondary transactions-suspicious-btn"
                                    title="Unmark as suspicious"
                                  >
                                    Clear
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleToggleSuspicious(tx.id, false)}
                                  className="btn btn-outline-danger transactions-suspicious-btn"
                                  title="Mark as suspicious"
                                >
                                  Mark Suspicious
                                </button>
                              )}
                            </>
                          )}
                          {!(hasRole('cashier') && !tx.processed && (isCashierOnly || tx.type === 'redemption')) && 
                           !(hasRole('manager') && (tx.type === 'purchase' || tx.type === 'adjustment')) && (
                            <span>-</span>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="transactions-pagination">
            {(() => {
              const isClientFiltering = hasClientSideFilters();
              const totalCount = isClientFiltering ? filteredTransactions.length : count;
              const totalPages = Math.ceil(totalCount / filters.limit);
              
              return (
                <>
                  <button
                    onClick={() => handleFilterChange('page', filters.page - 1)}
                    disabled={filters.page <= 1}
                  >
                    Previous
                  </button>
                  <span>
                    Page {filters.page} of {totalPages || 1}
                  </span>
                  <button
                    onClick={() => handleFilterChange('page', filters.page + 1)}
                    disabled={filters.page >= totalPages}
                  >
                    Next
                  </button>
                </>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
};

export default Transactions;

