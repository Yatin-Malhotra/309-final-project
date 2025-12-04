// Promotions page
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { promotionAPI, savedFilterAPI } from '../services/api';
import { Link, useSearchParams } from 'react-router-dom';
import SaveFilterModal from '../components/SaveFilterModal';
import SavedFiltersModal from '../components/SavedFiltersModal';
import ConfirmationModal from '../components/ConfirmationModal';
import '../styles/pages/Promotions.css';

const Promotions = () => {
  const { hasRole, currentRole, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [promotions, setPromotions] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingPromotionId, setDeletingPromotionId] = useState(null);
  const [isSaveFilterOpen, setIsSaveFilterOpen] = useState(false);
  const [isLoadFilterOpen, setIsLoadFilterOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    promotionId: null,
    promotionName: ''
  });
  const [filters, setFilters] = useState({
    name: searchParams.get('name') || '',
    type: searchParams.get('type') || '',
    // For managers to filter active/expired
    started: searchParams.get('started') || '', 
    ended: searchParams.get('ended') || '',
    page: parseInt(searchParams.get('page')) || 1,
    limit: parseInt(searchParams.get('limit')) || 10,
  });

  useEffect(() => {
    loadPromotions();
  }, [filters]);

  const loadPromotions = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { ...filters };
      Object.keys(params).forEach((key) => {
        if (!params[key]) delete params[key];
      });
      
      if ((currentRole === 'regular' || currentRole === 'cashier') && user?.utorid) {
        params.utorid = user.utorid;
      }
      
      const response = await promotionAPI.getPromotions(params);
      let fetchedPromotions = response.data.results || [];
      
      setPromotions(fetchedPromotions);
      setCount(response.data.count || 0);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load promotions.');
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
    // If mutually exclusive filters are set (started/ended), handle them?
    // Backend says: "if (started && ended) return res.status(400)"
    // So we should prevent setting both.
    
    if (key === 'started' && value !== '') {
      newFilters.ended = '';
    }
    if (key === 'ended' && value !== '') {
      newFilters.started = '';
    }

    setFilters(newFilters);
    setSearchParams(newFilters);
  };

  const handleSaveFilter = async (name) => {
    try {
      await savedFilterAPI.createSavedFilter(name, 'promotions', filters);
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

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString();
  };

  const isActive = (promotion) => {
    // If startTime is not provided (for non-managers), assume promotion is active
    // since backend already filters to only show active promotions for non-managers
    if (!promotion.startTime) {
      return true;
    }
    const now = new Date();
    const start = new Date(promotion.startTime);
    const end = new Date(promotion.endTime);
    return now >= start && now <= end;
  };

  const canDeletePromotion = (promotion) => {
    if (!promotion.startTime) return false; // Can't delete if we don't know start time
    const now = new Date();
    const start = new Date(promotion.startTime);
    return now < start; // Can only delete if promotion hasn't started
  };

  const handleDeleteClick = (promotionId, promotionName) => {
    setDeleteModal({
      isOpen: true,
      promotionId,
      promotionName
    });
  };

  const handleConfirmDelete = async () => {
    const { promotionId } = deleteModal;
    setDeletingPromotionId(promotionId);
    try {
      await promotionAPI.deletePromotion(promotionId);
      toast.success('Promotion deleted successfully!');
      loadPromotions(); // Reload the list
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to delete promotion.';
      toast.error(errorMessage);
    } finally {
      setDeletingPromotionId(null);
      setDeleteModal({ isOpen: false, promotionId: null, promotionName: '' });
    }
  };

  return (
    <div className="promotions-page">
      <SaveFilterModal 
        isOpen={isSaveFilterOpen} 
        onClose={() => setIsSaveFilterOpen(false)} 
        onSave={handleSaveFilter} 
      />
      
      <SavedFiltersModal 
        isOpen={isLoadFilterOpen} 
        onClose={() => setIsLoadFilterOpen(false)} 
        onSelect={handleLoadFilter} 
        page="promotions" 
      />

      <div className="promotions-page-header">
        <h1>Promotions</h1>
        {hasRole('manager') && (
          <Link to="/promotions/create" className="btn btn-primary promotions-create-btn">
            Create Promotion
          </Link>
        )}
      </div>

      <div className="promotions-filters">
        <div className="form-group">
          <label>Search</label>
          <input
            type="text"
            value={filters.name}
            onChange={(e) => handleFilterChange('name', e.target.value)}
            placeholder="Search by name..."
          />
        </div>
        <div className="form-group">
          <label>Type</label>
          <select
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
          >
            <option value="">All</option>
            <option value="automatic">Automatic</option>
            <option value="onetime">One-time</option>
          </select>
        </div>
        {((hasRole('manager') || hasRole('superuser')) && (currentRole === 'manager' || currentRole === 'superuser')) && (
          <>
            <div className="form-group">
              <label>Status</label>
              <select
                value={filters.started === 'true' ? 'active' : filters.started === 'false' ? 'upcoming' : filters.ended === 'true' ? 'ended' : ''}
                onChange={(e) => {
                   const val = e.target.value;
                   if (val === 'active') {
                     handleFilterChange('started', 'true');
                   } else if (val === 'upcoming') {
                     handleFilterChange('started', 'false');
                   } else if (val === 'ended') {
                     handleFilterChange('ended', 'true');
                   } else {
                     // Clear both
                     const newFilters = { ...filters, started: '', ended: '', page: 1 };
                     setFilters(newFilters);
                     setSearchParams(newFilters);
                   }
                }}
              >
                <option value="">All</option>
                <option value="active">Active / Past Start</option>
                <option value="upcoming">Upcoming</option>
                <option value="ended">Ended</option>
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
        <div className="promotions-filters-actions">
          <button onClick={() => setIsSaveFilterOpen(true)} className="btn btn-outline-secondary" title="Save current filters">
            Save
          </button>
          <button onClick={() => setIsLoadFilterOpen(true)} className="btn btn-outline-secondary" title="Load saved filters">
            Load
          </button>
        </div>
      </div>


      {loading ? (
        <div className="promotions-loading">Loading promotions...</div>
      ) : promotions.length === 0 ? (
        <div className="promotions-empty-state">No promotions found</div>
      ) : (
        <>
          <div className="promotions-grid">
            {promotions.map((promo) => {
            const CardContent = () => (
              <div className="promotions-card-content">
                <div className="promotions-card-main">
                  <h3 className="promotions-card-title">{promo.name}</h3>
                  <p className="promotions-card-description">
                    {promo.description}
                  </p>
                  <div className="promotions-card-badges">
                    <span className={`promotions-badge ${promo.type === 'automatic' ? 'promotions-badge-primary' : 'promotions-badge-secondary'}`}>
                      {promo.type}
                    </span>
                    {isActive(promo) ? (
                      <span className="promotions-badge promotions-badge-success">
                        Active
                      </span>
                    ) : (
                      <span className={`promotions-badge ${promo.startTime && new Date(promo.startTime) > new Date() ? 'promotions-badge-secondary' : 'promotions-badge-danger'}`}>
                        {promo.startTime && new Date(promo.startTime) > new Date() ? 'Upcoming' : 'Expired'}
                      </span>
                    )}
                  </div>
                  <div className="promotions-card-details">
                    <p className="promotions-card-detail">
                      {promo.startTime ? (
                        `Valid: ${formatDate(promo.startTime)} - ${formatDate(promo.endTime)}`
                      ) : (
                        `Valid until: ${formatDate(promo.endTime)}`
                      )}
                    </p>
                    {promo.minSpending && (
                      <p className="promotions-card-detail">
                        Minimum spending: ${promo.minSpending}
                      </p>
                    )}
                    {promo.rate && (
                      <p className="promotions-card-detail">
                        Rate: {promo.rate}x points
                      </p>
                    )}
                    {promo.points !== undefined && promo.points !== null && (
                      <p className="promotions-card-detail">
                        Points: {promo.points}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );

            if ((hasRole('manager') || hasRole('superuser')) && (currentRole === 'manager' || currentRole === 'superuser')) {
              return (
                <div key={promo.id} className="promotions-card" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Link
                    to={`/promotions/${promo.id}/edit`}
                    style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flex: 1 }}
                  >
                    <CardContent />
                  </Link>
                  {canDeletePromotion(promo) && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteClick(promo.id, promo.name);
                      }}
                      className="btn btn-danger"
                      disabled={deletingPromotionId === promo.id}
                      style={{
                        padding: '12px 24px',
                        fontSize: '15px',
                        fontWeight: '600',
                        borderRadius: '8px',
                        marginLeft: '16px',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {deletingPromotionId === promo.id ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div key={promo.id} className="promotions-card">
                <CardContent />
              </div>
            );
          })}
          </div>

          <div className="promotions-pagination">
            <button
              onClick={() => handleFilterChange('page', filters.page - 1)}
              disabled={filters.page <= 1}
            >
              Previous
            </button>
            <span>
              Page {filters.page} of {Math.ceil(count / filters.limit) || 1}
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
      
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={handleConfirmDelete}
        title="Delete Promotion"
        message={`Are you sure you want to delete "${deleteModal.promotionName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        isDangerous={true}
      />
    </div>
  );
};

export default Promotions;

