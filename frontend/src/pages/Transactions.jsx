// Transactions management page
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { transactionAPI } from '../services/api';
import { Link, useSearchParams } from 'react-router-dom';
import useTableSort from '../hooks/useTableSort';
import SortableTableHeader from '../components/SortableTableHeader';
import TransactionDetailPanel from '../components/TransactionDetailPanel';
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
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

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
      toast.success('Redemption processed successfully!');
      loadTransactions();
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to process redemption.';
      toast.error(errorMessage);
    }
  };

  const handleToggleSuspicious = async (transactionId, currentSuspicious) => {
    const action = currentSuspicious ? 'unmark' : 'mark';
    if (!confirm(`Are you sure you want to ${action} this transaction as suspicious?`)) return;

    try {
      await transactionAPI.markSuspicious(transactionId, !currentSuspicious);
      const actionMessage = currentSuspicious ? 'cleared' : 'marked';
      toast.success(`Transaction ${actionMessage} as suspicious successfully!`);
      loadTransactions();
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to update suspicious status.';
      toast.error(errorMessage);
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

  // Table sorting configuration
  const sortConfig = {
    id: { sortFn: (a, b) => a.id - b.id },
    user: { 
      accessor: (tx) => (tx.userName || tx.utorid || tx.user?.utorid || '').toLowerCase() 
    },
    type: { 
      accessor: (tx) => tx.type 
    },
    amount: { 
      sortFn: (a, b) => {
        const aVal = isCashierOnly ? (a.redeemed || Math.abs(a.amount)) : a.amount;
        const bVal = isCashierOnly ? (b.redeemed || Math.abs(b.amount)) : b.amount;
        return aVal - bVal;
      }
    },
    date: { 
      accessor: (tx) => tx.createdAt ? new Date(tx.createdAt).getTime() : 0 
    },
    status: { 
      sortFn: (a, b) => {
        // Processed = 1, Pending = 0
        return (a.processed ? 1 : 0) - (b.processed ? 1 : 0);
      }
    },
    suspicious: {
      sortFn: (a, b) => {
        // Suspicious = 1, Not suspicious = 0, Undefined = -1
        const aVal = a.suspicious === true ? 1 : a.suspicious === false ? 0 : -1;
        const bVal = b.suspicious === true ? 1 : b.suspicious === false ? 0 : -1;
        return aVal - bVal;
      }
    },
  };

  const { sortedData, sortConfig: currentSort, handleSort } = useTableSort(transactions, sortConfig);

  return (
    <div className="transactions-page">
      <div className="transactions-page-header">
        <h1>{isCashierOnly ? 'Redemption Transactions' : 'Transactions'}</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {hasRole('manager') && (
            <button
              type="button"
              onClick={() => {
                if (managerFilters.idUtoridSearch === user?.utorid) {
                  // If already searching for own utorid, clear the search
                  setManagerFilters({ ...managerFilters, idUtoridSearch: '' });
                } else {
                  // Otherwise, set search to own utorid
                  setManagerFilters({ ...managerFilters, idUtoridSearch: user?.utorid || '' });
                }
              }}
              className={managerFilters.idUtoridSearch === user?.utorid ? "btn btn-secondary" : "btn btn-outline-secondary"}
              title={managerFilters.idUtoridSearch === user?.utorid ? "Clear filter and show all transactions" : "Show only my transactions"}
            >
              My Transactions
            </button>
          )}
          <Link to="/transactions/create" className="btn btn-primary">
            Create Transaction
          </Link>
        </div>
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
              <label htmlFor="transaction-type">Type</label>
              <select
                id="transaction-type"
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
                  <SortableTableHeader 
                    sortKey="id" 
                    currentSortKey={currentSort.key} 
                    sortDirection={currentSort.direction}
                    onSort={handleSort}
                  >
                    ID
                  </SortableTableHeader>
                  {(hasRole('manager') || isCashierOnly) && (
                    <SortableTableHeader 
                      sortKey="user" 
                      currentSortKey={currentSort.key} 
                      sortDirection={currentSort.direction}
                      onSort={handleSort}
                    >
                      User
                    </SortableTableHeader>
                  )}
                  {!isCashierOnly && (
                    <SortableTableHeader 
                      sortKey="type" 
                      currentSortKey={currentSort.key} 
                      sortDirection={currentSort.direction}
                      onSort={handleSort}
                    >
                      Type
                    </SortableTableHeader>
                  )}
                  <SortableTableHeader 
                    sortKey="amount" 
                    currentSortKey={currentSort.key} 
                    sortDirection={currentSort.direction}
                    onSort={handleSort}
                  >
                    Amount
                  </SortableTableHeader>
                  <SortableTableHeader 
                    sortKey="date" 
                    currentSortKey={currentSort.key} 
                    sortDirection={currentSort.direction}
                    onSort={handleSort}
                  >
                    Date
                  </SortableTableHeader>
                  <SortableTableHeader 
                    sortKey="status" 
                    currentSortKey={currentSort.key} 
                    sortDirection={currentSort.direction}
                    onSort={handleSort}
                  >
                    Status
                  </SortableTableHeader>
                  {(hasRole('manager') || hasRole('superuser')) && (
                    <SortableTableHeader 
                      sortKey="suspicious" 
                      currentSortKey={currentSort.key} 
                      sortDirection={currentSort.direction}
                      onSort={handleSort}
                    >
                      Suspicious
                    </SortableTableHeader>
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedData.map((tx) => (
                  <tr 
                    key={tx.id}
                    onClick={() => {
                      setSelectedTransaction(tx);
                      setIsPanelOpen(true);
                    }}
                    className="transactions-row-clickable"
                  >
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
                    {(hasRole('manager') || hasRole('superuser')) && (
                      <td>
                        {tx.suspicious !== undefined ? (
                          tx.suspicious ? (
                            <span className="transactions-badge transactions-badge-danger">Yes</span>
                          ) : (
                            <span className="transactions-badge transactions-badge-success">No</span>
                          )
                        ) : (
                          <span className="transactions-badge transactions-badge-secondary">N/A</span>
                        )}
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

      <TransactionDetailPanel
        transaction={selectedTransaction}
        isOpen={isPanelOpen}
        onClose={() => {
          setIsPanelOpen(false);
          setSelectedTransaction(null);
        }}
        onUpdate={() => {
          loadTransactions();
        }}
        hasRole={hasRole}
      />

    </div>
  );
};

export default Transactions;

