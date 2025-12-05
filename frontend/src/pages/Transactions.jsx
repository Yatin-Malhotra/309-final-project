// Transactions management page
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { transactionAPI } from '../services/api';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import useTableSort from '../hooks/useTableSort';
import SortableTableHeader from '../components/SortableTableHeader';
import TransactionDetailPanel from '../components/TransactionDetailPanel';
import SaveFilterModal from '../components/SaveFilterModal';
import SavedFiltersModal from '../components/SavedFiltersModal';
import { savedFilterAPI } from '../services/api';
import { jsPDF } from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';
import '../styles/pages/Transactions.css';

// Apply the autoTable plugin to jsPDF
applyPlugin(jsPDF);

const Transactions = () => {
  const { user, hasRole } = useAuth();
  const isCashierOnly = hasRole('cashier') && !hasRole('manager');
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
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
  const [isSaveFilterOpen, setIsSaveFilterOpen] = useState(false);
  const [isLoadFilterOpen, setIsLoadFilterOpen] = useState(false);

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

  const { sortedData, sortConfig: currentSort, handleSort } = useTableSort(transactions, sortConfig, { manualSort: true });

  // Handle pre-filled filters from navigation state (e.g., from QR scan)
  useEffect(() => {
    if (location.state) {
      const { utorid, name, type, status } = location.state;
      
      if (utorid || name) {
        if (hasRole('manager')) {
          // For managers: set UTORid search, type, and status filters
          setManagerFilters({
            idUtoridSearch: utorid || '',
            status: status === 'pending' ? 'false' : ''
          });
          if (type) {
            setFilters(prev => {
              const newFilters = { ...prev, type, page: 1 };
              setSearchParams(newFilters);
              return newFilters;
            });
          }
        } else if (isCashierOnly) {
          // For cashiers: set name search and status filter
          // Cashiers already only see redemption transactions
          // Use name if provided (from QR scan), otherwise fallback to utorid
          setClientFilters({
            idNameSearch: name || utorid || '',
            status: status === 'pending' ? 'false' : ''
          });
        }
        
        // Clear location state to prevent re-applying on re-renders
        window.history.replaceState({}, document.title);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Check if client-side filtering is active
  const hasClientSideFilters = () => {
    if (isCashierOnly) {
      return clientFilters.idNameSearch !== '' || clientFilters.status !== '';
    } else if (hasRole('manager')) {
      return managerFilters.idUtoridSearch !== '' || managerFilters.status !== '';
    }
    return false;
  };

  // Check if we need to fetch all data for client-side operations (filtering or sorting)
  const needsClientSideData = () => {
    // If client-side filters are active, we need all data
    if (hasClientSideFilters()) return true;
    // If sorting is active (any column), we need all data to sort across all pages
    if (currentSort.key) return true;
    return false;
  };

  useEffect(() => {
    loadTransactions();
  }, [filters, user]);

  // Reset to page 1 and reload when client-side filters or sorting changes
  useEffect(() => {
    const needsClientData = needsClientSideData();
    
    // Reset to page 1 if client-side operations are active and we're not already on page 1
    if (needsClientData && filters.page !== 1) {
      const newFilters = { ...filters, page: 1 };
      setFilters(newFilters);
      setSearchParams(newFilters);
      // Don't reload here - the filters change will trigger the first useEffect
    } else if (needsClientData) {
      // If we need client-side data (sorting active) and we're on page 1, reload to fetch all data
      loadTransactions();
    } else if (!needsClientData) {
      // Reload immediately if client-side operations were cleared
      loadTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientFilters.idNameSearch, clientFilters.status, managerFilters.idUtoridSearch, managerFilters.status, currentSort.key, currentSort.direction]);

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

    // Apply sorting whenever a sort key is selected (works for all columns including status and suspicious)
    if (currentSort.key) {
      filtered.sort((a, b) => {
        const sortKey = currentSort.key;
        const direction = currentSort.direction;
        
        // Custom sort function from config
        if (sortConfig[sortKey]?.sortFn) {
          const result = sortConfig[sortKey].sortFn(a, b);
          return direction === 'asc' ? result : -result;
        }
        
        let aVal = a[sortKey];
        let bVal = b[sortKey];
        
        // Accessor
        if (sortConfig[sortKey]?.accessor) {
          aVal = sortConfig[sortKey].accessor(a);
          bVal = sortConfig[sortKey].accessor(b);
        }
        
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        // Strings
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          const aStr = aVal.toLowerCase();
          const bStr = bVal.toLowerCase();
          if (aStr < bStr) return direction === 'asc' ? -1 : 1;
          if (aStr > bStr) return direction === 'asc' ? 1 : -1;
          return 0;
        }
        
        // Numbers/Others
        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setFilteredTransactions(filtered);

    // Apply client-side pagination if filters or sorting are active
    if (needsClientSideData()) {
      const startIndex = (filters.page - 1) * filters.limit;
      const endIndex = startIndex + filters.limit;
      setTransactions(filtered.slice(startIndex, endIndex));
    } else {
      // Use server-side paginated results
      setTransactions(filtered);
    }
  }, [clientFilters, managerFilters, allTransactions, isCashierOnly, hasRole, filters.page, filters.limit, currentSort]);

  const loadTransactions = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { ...filters };

      Object.keys(params).forEach((key) => {
        if (params[key] === '' || params[key] === null || params[key] === undefined) {
          delete params[key];
        }
      });
      
      // If client-side operations (filtering or sorting) are active, fetch maximum results
      if (needsClientSideData()) {
        // Remove page parameter and set limit to maximum (100) to get more results for client-side operations
        delete params.page;
        params.limit = 100; // Maximum allowed by backend
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

  // Server-side sorting sync
  useEffect(() => {
    // If client-side operations are active, we sort locally, so don't update server filters
    if (needsClientSideData()) return;

    // Always do client-side sorting for status and suspicious columns
    // (they may not be supported server-side, and we have custom sort functions for them)
    if (currentSort.key === 'status' || currentSort.key === 'suspicious') {
      return; // Skip server-side sync, use client-side sorting
    }

    if (currentSort.key) {
      setFilters(prev => {
        if (prev.sortBy === currentSort.key && prev.order === currentSort.direction) return prev;
        return { ...prev, sortBy: currentSort.key, order: currentSort.direction };
      });
    }
  }, [currentSort, clientFilters.idNameSearch, clientFilters.status, managerFilters.idUtoridSearch, managerFilters.status]);

  const handleSaveFilter = async (name) => {
    try {
      const filtersToSave = {
        ...filters,
        clientFilters: isCashierOnly ? clientFilters : undefined,
        managerFilters: hasRole('manager') ? managerFilters : undefined
      };
      delete filtersToSave.page;
      
      await savedFilterAPI.createSavedFilter(name, 'transactions', filtersToSave);
      toast.success('Filter saved successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save filter');
    }
  };

  const handleLoadFilter = (savedFilters) => {
    const { clientFilters: savedClient, managerFilters: savedManager, ...serverFilters } = savedFilters;
    
    if (savedClient) setClientFilters(savedClient);
    if (savedManager) setManagerFilters(savedManager);
    
    const newFilters = { ...serverFilters, page: 1 };
    setFilters(newFilters);
    setSearchParams(newFilters);
    
    toast.success('Filters loaded');
  };

  const handleExportPDF = async () => {
    try {
      // Fetch all data for export if not already available or if currently paginated
      let exportData = sortedData;
      
      if (!hasClientSideFilters() && count > transactions.length) {
         // fetch all records matching current filters in batches of 100 (backend maximum)
         const params = { ...filters };
         delete params.page;
         delete params.limit;

         params.limit = 100; // Backend maximum limit
         exportData = [];
         
         // Fetch all pages if count > 100
         const totalPages = Math.ceil(count / 100);
         for (let page = 1; page <= totalPages; page++) {
           params.page = page;
           
           let response;
           if (hasRole('manager')) {
             response = await transactionAPI.getTransactions(params);
           } else if (hasRole('cashier')) {
             response = await transactionAPI.getRedemptionTransactions(params);
           } else {
             response = await transactionAPI.getMyTransactions(params);
           }
           
           exportData = [...exportData, ...(response.data.results || [])];
         }
      } else if (hasClientSideFilters()) {          
          exportData = [...filteredTransactions];
          if (currentSort.key) {
             exportData.sort((a, b) => {
                 // Reuse logic from useTableSort or simplified version
                 let aVal = a[currentSort.key];
                 let bVal = b[currentSort.key];
                 
                 // Quick recreation of sort logic
                 if (sortConfig[currentSort.key]?.accessor) {
                    aVal = sortConfig[currentSort.key].accessor(a);
                    bVal = sortConfig[currentSort.key].accessor(b);
                 }
                  
                  if (sortConfig[currentSort.key]?.sortFn) {
                     const result = sortConfig[currentSort.key].sortFn(a, b);
                     return currentSort.direction === 'asc' ? result : -result;
                  }
                  
                 if (typeof aVal === 'string') {
                     aVal = aVal.toLowerCase();
                     bVal = bVal.toLowerCase();
                 }
                 
                 if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
                 if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
                 return 0;
             });
          }
      }

      const doc = new jsPDF();

      // Add title and metadata
      doc.setFontSize(18);
      doc.setTextColor(0);
      doc.text('CSSU Rewards Transaction History', 14, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.text(`Generated by: ${user?.utorid || 'Unknown'}`, 14, 28);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 34);
      
      // Build and display active filters
      const activeFilters = [];
      
      if (isCashierOnly) {
        if (clientFilters.idNameSearch) {
          activeFilters.push(`Search: ${clientFilters.idNameSearch}`);
        }
        if (clientFilters.status !== '') {
          activeFilters.push(`Status: ${clientFilters.status === 'true' ? 'Processed' : 'Pending'}`);
        }
      } else if (hasRole('manager')) {
        if (managerFilters.idUtoridSearch) {
          activeFilters.push(`Search: ${managerFilters.idUtoridSearch}`);
        }
        if (filters.type) {
          activeFilters.push(`Type: ${filters.type.charAt(0).toUpperCase() + filters.type.slice(1)}`);
        }
        if (managerFilters.status !== '') {
          activeFilters.push(`Status: ${managerFilters.status === 'true' ? 'Processed' : 'Pending'}`);
        }
      } else {
        // Regular users
        if (filters.type) {
          activeFilters.push(`Type: ${filters.type.charAt(0).toUpperCase() + filters.type.slice(1)}`);
        }
        if (filters.processed) {
          activeFilters.push(`Processed: ${filters.processed === 'true' ? 'Yes' : 'No'}`);
        }
      }
      
      let yPosition = 40;
      if (activeFilters.length > 0) {
        doc.setFontSize(10);
        doc.text('Filters Applied:', 14, yPosition);
        yPosition += 6;
        activeFilters.forEach((filter, index) => {
          doc.text(`  • ${filter}`, 14, yPosition);
          yPosition += 6;
        });
        yPosition += 4; // Add some spacing before the table
      }
      
      doc.setFontSize(11);
      doc.setTextColor(0);

      // Define columns based on roles
      const columns = [
        { header: 'ID', dataKey: 'id' },
      ];

      if (hasRole('manager') || isCashierOnly) {
        columns.push({ header: 'User', dataKey: 'user' });
      }
      if (!isCashierOnly) {
        columns.push({ header: 'Type', dataKey: 'type' });
      }
      columns.push({ header: 'Amount', dataKey: 'amount' });
      columns.push({ header: 'Date', dataKey: 'date' });
      columns.push({ header: 'Status', dataKey: 'status' });

      if (hasRole('manager') || hasRole('superuser')) {
        columns.push({ header: 'Suspicious', dataKey: 'suspicious' });
      }

      // Map data
      const tableData = exportData.map(tx => {
        const row = {
          id: tx.id,
          amount: isCashierOnly ? (tx.redeemed || Math.abs(tx.amount)) : tx.amount,
          date: tx.createdAt ? formatDate(tx.createdAt) : 'N/A',
          status: tx.processed ? 'Processed' : 'Pending',
        };

        if (hasRole('manager') || isCashierOnly) {
          row.user = tx.userName || tx.utorid || tx.user?.utorid || '';
        }
        if (!isCashierOnly) {
          row.type = tx.type;
        }
        if (hasRole('manager') || hasRole('superuser')) {
          row.suspicious = tx.suspicious !== undefined ? (tx.suspicious ? 'Yes' : 'No') : 'N/A';
        }
        return row;
      });

      doc.autoTable({
        columns: columns,
        body: tableData,
        startY: yPosition, // Start table below title, metadata, and filters
        headStyles: { fillColor: [44, 62, 80], textColor: 255 }, // Keep header text white
        bodyStyles: { textColor: 0 }, // Ensure body text is black
      });

      doc.save('transactions.pdf');
      toast.success('PDF exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export PDF');
    }
  };

  return (
    <div className="transactions-page">
      <div className="transactions-page-header">
        <h1>{isCashierOnly ? 'Redemption Transactions' : 'Transactions'}</h1>
        <div className="transactions-header-actions">
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
            {hasRole('manager') ? (
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
            ) : (
              <div className="form-group">
                <label htmlFor="transaction-status">Status</label>
                <select
                  id="transaction-status"
                  value={filters.processed}
                  onChange={(e) => handleFilterChange('processed', e.target.value)}
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
          <button onClick={() => setIsSaveFilterOpen(true)} className="btn btn-outline-secondary" title="Save current filters">
            Save
          </button>
          <button onClick={() => setIsLoadFilterOpen(true)} className="btn btn-outline-secondary" title="Load saved filters">
            Load
          </button>
          <button onClick={handleExportPDF} className="btn btn-outline-secondary" title="Export to PDF">
            Export PDF
          </button>
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
          {/* Desktop Table View */}
          <div className="transactions-section transactions-table-container">
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

          {/* Mobile Card View */}
          <div className="transactions-cards-container">
            {sortedData.map((tx) => (
              <div
                key={tx.id}
                onClick={() => {
                  setSelectedTransaction(tx);
                  setIsPanelOpen(true);
                }}
                className="transactions-card"
              >
                <div className="transactions-card-header">
                  <div className="transactions-card-id">#{tx.id}</div>
                  <div className="transactions-card-status">
                    {tx.processed ? (
                      <span className="transactions-badge transactions-badge-success">Processed</span>
                    ) : (
                      <span className="transactions-badge transactions-badge-warning">Pending</span>
                    )}
                  </div>
                </div>
                <div className="transactions-card-body">
                  {(hasRole('manager') || isCashierOnly) && (
                    <div className="transactions-card-row">
                      <span className="transactions-card-label">User:</span>
                      <span className="transactions-card-value">{tx.userName || tx.utorid || tx.user?.utorid}</span>
                    </div>
                  )}
                  {!isCashierOnly && (
                    <div className="transactions-card-row">
                      <span className="transactions-card-label">Type:</span>
                      <span className={`transactions-badge ${getTransactionTypeBadge(tx.type)}`}>
                        {tx.type}
                      </span>
                    </div>
                  )}
                  <div className="transactions-card-row">
                    <span className="transactions-card-label">Amount:</span>
                    <span className="transactions-card-value transactions-card-amount">
                      {isCashierOnly ? (tx.redeemed || Math.abs(tx.amount)) : tx.amount}
                    </span>
                  </div>
                  <div className="transactions-card-row">
                    <span className="transactions-card-label">Date:</span>
                    <span className="transactions-card-value">{tx.createdAt ? formatDate(tx.createdAt) : 'N/A'}</span>
                  </div>
                  {(hasRole('manager') || hasRole('superuser')) && (
                    <div className="transactions-card-row">
                      <span className="transactions-card-label">Suspicious:</span>
                      {tx.suspicious !== undefined ? (
                        tx.suspicious ? (
                          <span className="transactions-badge transactions-badge-danger">Yes</span>
                        ) : (
                          <span className="transactions-badge transactions-badge-success">No</span>
                        )
                      ) : (
                        <span className="transactions-badge transactions-badge-secondary">N/A</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="transactions-pagination">
            {(() => {
              const isClientOperation = needsClientSideData();
              const totalCount = isClientOperation ? filteredTransactions.length : count;
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

      <SaveFilterModal 
        isOpen={isSaveFilterOpen} 
        onClose={() => setIsSaveFilterOpen(false)} 
        onSave={handleSaveFilter} 
      />
      
      <SavedFiltersModal 
        isOpen={isLoadFilterOpen} 
        onClose={() => setIsLoadFilterOpen(false)} 
        onSelect={handleLoadFilter} 
        page="transactions" 
      />

    </div>
  );
};

export default Transactions;

