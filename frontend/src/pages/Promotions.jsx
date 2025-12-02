// Promotions page
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { promotionAPI } from '../services/api';
import { Link } from 'react-router-dom';
import './Promotions.css';

const Promotions = () => {
  const { hasRole } = useAuth();
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingPromotionId, setDeletingPromotionId] = useState(null);

  useEffect(() => {
    loadPromotions();
  }, []);

  const loadPromotions = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await promotionAPI.getPromotions();
      setPromotions(response.data.results || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load promotions.');
    } finally {
      setLoading(false);
    }
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

  const handleDeletePromotion = async (promotionId, promotionName) => {
    if (!confirm(`Are you sure you want to delete "${promotionName}"? This action cannot be undone.`)) return;
    
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
    }
  };

  return (
    <div className="promotions-page">
      <div className="promotions-page-header">
        <h1>Promotions</h1>
        {hasRole('manager') && (
          <Link to="/promotions/create" className="btn btn-primary promotions-create-btn">
            Create Promotion
          </Link>
        )}
      </div>


      {loading ? (
        <div className="promotions-loading">Loading promotions...</div>
      ) : promotions.length === 0 ? (
        <div className="promotions-empty-state">No promotions found</div>
      ) : (
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

            if (hasRole('manager') || hasRole('superuser')) {
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
                        handleDeletePromotion(promo.id, promo.name);
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
      )}
    </div>
  );
};

export default Promotions;

