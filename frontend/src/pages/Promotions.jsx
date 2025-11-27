// Promotions page
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { promotionAPI } from '../services/api';
import { Link } from 'react-router-dom';

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
    const now = new Date();
    const start = new Date(promotion.startTime);
    const end = new Date(promotion.endTime);
    return now >= start && now <= end;
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Promotions</h1>
        {hasRole('manager') && (
          <Link to="/promotions/create" className="btn btn-primary">
            Create Promotion
          </Link>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">Loading promotions...</div>
      ) : promotions.length === 0 ? (
        <div className="empty-state">No promotions found</div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {promotions.map((promo) => (
            <div key={promo.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ marginBottom: '10px' }}>{promo.name}</h3>
                  <p style={{ color: '#666', marginBottom: '10px' }}>
                    {promo.description}
                  </p>
                  <div style={{ marginTop: '10px' }}>
                    <span className={`badge ${promo.type === 'automatic' ? 'badge-primary' : 'badge-secondary'}`}>
                      {promo.type}
                    </span>
                    {isActive(promo) ? (
                      <span className="badge badge-success" style={{ marginLeft: '10px' }}>
                        Active
                      </span>
                    ) : (
                      <span className="badge badge-secondary" style={{ marginLeft: '10px' }}>
                        {new Date(promo.startTime) > new Date() ? 'Upcoming' : 'Expired'}
                      </span>
                    )}
                  </div>
                  <p style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
                    Valid: {formatDate(promo.startTime)} - {formatDate(promo.endTime)}
                  </p>
                  {promo.minSpending && (
                    <p style={{ fontSize: '14px', color: '#666' }}>
                      Minimum spending: ${promo.minSpending}
                    </p>
                  )}
                  {promo.rate && (
                    <p style={{ fontSize: '14px', color: '#666' }}>
                      Rate: {promo.rate}x points
                    </p>
                  )}
                  {promo.points !== undefined && promo.points !== null && (
                    <p style={{ fontSize: '14px', color: '#666' }}>
                      Points: {promo.points}
                    </p>
                  )}
                </div>
                {hasRole('manager') && (
                  <div>
                    <Link
                      to={`/promotions/${promo.id}/edit`}
                      className="btn btn-primary"
                      style={{ padding: '8px 16px', marginRight: '10px' }}
                    >
                      Edit
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Promotions;

