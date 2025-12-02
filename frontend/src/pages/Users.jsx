// Users management page (for managers)
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { userAPI, savedFilterAPI } from '../services/api';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import useTableSort from '../hooks/useTableSort';
import SortableTableHeader from '../components/SortableTableHeader';
import SaveFilterModal from '../components/SaveFilterModal';
import SavedFiltersModal from '../components/SavedFiltersModal';
import './Users.css';

const Users = () => {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSaveFilterOpen, setIsSaveFilterOpen] = useState(false);
  const [isLoadFilterOpen, setIsLoadFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    name: searchParams.get('name') || '',
    role: searchParams.get('role') || '',
    verified: searchParams.get('verified') || '',
    page: parseInt(searchParams.get('page')) || 1,
    limit: parseInt(searchParams.get('limit')) || 10,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsers();
  }, [filters]);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { ...filters };
      Object.keys(params).forEach((key) => {
        if (!params[key]) delete params[key];
      });

      const response = await userAPI.getUsers(params);
      setUsers(response.data.results || []);
      setCount(response.data.count || 0);
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to load users.';
      toast.error(errorMessage);
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

  const getRoleBadge = (role) => {
    const colors = {
      regular: 'users-badge-secondary',
      cashier: 'users-badge-blue',
      manager: 'users-badge-success',
      superuser: 'users-badge-danger',
    };
    return colors[role] || 'users-badge-secondary';
  };

  // Table sorting configuration
  const sortConfig = {
    id: { sortFn: (a, b) => a.id - b.id },
    utorid: { accessor: (user) => (user.utorid || '').toLowerCase() },
    name: { accessor: (user) => (user.name || '').toLowerCase() },
    email: { accessor: (user) => (user.email || '').toLowerCase() },
    role: { accessor: (user) => user.role },
    points: { sortFn: (a, b) => (a.points || 0) - (b.points || 0) },
    verified: { sortFn: (a, b) => (a.verified ? 1 : 0) - (b.verified ? 1 : 0) },
  };

  const { sortedData, sortConfig: currentSort, handleSort } = useTableSort(users, sortConfig);

  const handleSaveFilter = async (name) => {
    try {
      const filtersToSave = { ...filters };
      delete filtersToSave.page;
      await savedFilterAPI.createSavedFilter(name, 'users', filtersToSave);
      toast.success('Filter saved successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save filter');
    }
  };

  const handleLoadFilter = (savedFilters) => {
    const newFilters = { ...savedFilters, page: 1 };
    setFilters(newFilters);
    setSearchParams(newFilters);
    toast.success('Filters loaded');
  };

  return (
    <div className="users-page">
      <SaveFilterModal 
        isOpen={isSaveFilterOpen} 
        onClose={() => setIsSaveFilterOpen(false)} 
        onSave={handleSaveFilter} 
      />
      
      <SavedFiltersModal 
        isOpen={isLoadFilterOpen} 
        onClose={() => setIsLoadFilterOpen(false)} 
        onSelect={handleLoadFilter} 
        page="users" 
      />
      
      <div className="users-page-header">
        <h1>Users</h1>
        {hasRole('cashier') && (
          <Link to="/users/create" className="btn btn-primary users-create-btn">
            Create User
          </Link>
        )}
      </div>

      <div className="users-filters">
        <div className="form-group">
          <label>Search</label>
          <input
            type="text"
            value={filters.name}
            onChange={(e) => handleFilterChange('name', e.target.value)}
            placeholder="Name or UTORid..."
          />
        </div>
        <div className="form-group">
          <label>Role</label>
          <select
            value={filters.role}
            onChange={(e) => handleFilterChange('role', e.target.value)}
          >
            <option value="">All</option>
            <option value="regular">Regular</option>
            <option value="cashier">Cashier</option>
            <option value="manager">Manager</option>
            <option value="superuser">Superuser</option>
          </select>
        </div>
        <div className="form-group">
          <label>Verified</label>
          <select
            value={filters.verified}
            onChange={(e) => handleFilterChange('verified', e.target.value)}
          >
            <option value="">All</option>
            <option value="true">Verified</option>
            <option value="false">Unverified</option>
          </select>
        </div>
        <div className="form-group">
          <label>Limit</label>
          <select
            value={filters.limit}
            onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
        </div>
        <div className="users-filters-actions">
          <button onClick={() => setIsSaveFilterOpen(true)} className="btn btn-outline-secondary" title="Save current filters">
            Save
          </button>
          <button onClick={() => setIsLoadFilterOpen(true)} className="btn btn-outline-secondary" title="Load saved filters">
            Load
          </button>
        </div>
      </div>


      {loading ? (
        <div className="users-loading">Loading users...</div>
      ) : users.length === 0 ? (
        <div className="users-empty-state">No users found</div>
      ) : (
        <>
          <div className="users-section">
            <table className="users-table">
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
                  <SortableTableHeader 
                    sortKey="utorid" 
                    currentSortKey={currentSort.key} 
                    sortDirection={currentSort.direction}
                    onSort={handleSort}
                  >
                    UTORid
                  </SortableTableHeader>
                  <SortableTableHeader 
                    sortKey="name" 
                    currentSortKey={currentSort.key} 
                    sortDirection={currentSort.direction}
                    onSort={handleSort}
                  >
                    Name
                  </SortableTableHeader>
                  <SortableTableHeader 
                    sortKey="email" 
                    currentSortKey={currentSort.key} 
                    sortDirection={currentSort.direction}
                    onSort={handleSort}
                  >
                    Email
                  </SortableTableHeader>
                  <SortableTableHeader 
                    sortKey="role" 
                    currentSortKey={currentSort.key} 
                    sortDirection={currentSort.direction}
                    onSort={handleSort}
                  >
                    Role
                  </SortableTableHeader>
                  <SortableTableHeader 
                    sortKey="points" 
                    currentSortKey={currentSort.key} 
                    sortDirection={currentSort.direction}
                    onSort={handleSort}
                  >
                    Points
                  </SortableTableHeader>
                  <SortableTableHeader 
                    sortKey="verified" 
                    currentSortKey={currentSort.key} 
                    sortDirection={currentSort.direction}
                    onSort={handleSort}
                  >
                    Verified
                  </SortableTableHeader>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((user) => (
                  <tr 
                    key={user.id}
                    onClick={() => navigate(`/users/${user.id}`)}
                    className="users-table-row-clickable"
                  >
                    <td>{user.id}</td>
                    <td>{user.utorid}</td>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`users-badge ${getRoleBadge(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td>{user.points || 0}</td>
                    <td>
                      {user.verified ? (
                        <span className="users-badge users-badge-success">Yes</span>
                      ) : (
                        <span className="users-badge users-badge-warning">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="users-pagination">
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

export default Users;

