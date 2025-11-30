// Promotions page
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { promotionAPI } from '../services/api';
import { Link } from 'react-router-dom';
import './Promotions.css';

const Promotions = () => {
  const { hasRole } = useAuth();
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

      {error && <div className="promotions-error-message">{error}</div>}

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
                <Link
                  key={promo.id}
                  to={`/promotions/${promo.id}/edit`}
                  className="promotions-card promotions-card-clickable"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <CardContent />
                </Link>
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

