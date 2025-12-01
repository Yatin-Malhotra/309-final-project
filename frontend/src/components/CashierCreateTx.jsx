// Create transaction form (for cashiers and above)
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { promotionAPI, transactionAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import PromotionSelector from './PromotionSelector';
import '../pages/CreateTransaction.css';

const CashierCreateTx = () => {
  const { hasRole } = useAuth();
  const isCashierOnly = hasRole('cashier') && !hasRole('manager');
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get UTORid from navigation state (from QR scan)
  const scannedUtorid = location.state?.utorid || '';
  
  const [formData, setFormData] = useState({
    utorid: scannedUtorid,
    type: 'purchase',
    spent: '',
    amount: '',
    remark: '',
    relatedId: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [allPromotions, setAllPromotions] = useState([]); // All promotions (one-time + automatic)
  const [promotionIds, setPromotionIds] = useState([]); // Manually selected one-time promotions

  // Fetch promotions based on the UTORid entered (for purchase transactions)
  const getPromotions = async (utorid, type) => {
    try {
      const params = {};
      // If UTORid is provided and transaction type is purchase, fetch promotions for that user
      if (utorid && type === 'purchase') {
        params.utorid = utorid;
      }
      const response = await promotionAPI.getPromotions(params);
      setAllPromotions(response.data.results || []);
    } catch (err) {
      // If user not found, just set empty promotions
      if (err.response?.status === 404) {
        setAllPromotions([]);
      } else {
        console.error('Failed to load promotions:', err);
        setAllPromotions([]);
      }
    }
  }

  useEffect(() => {
    getPromotions(formData.utorid, formData.type);
    // Clear selected promotions when UTORid or type changes, as available promotions may differ
    setPromotionIds([]);
  }, [formData.utorid, formData.type])

  // Filter to only show one-time promotions in the dropdown
  const oneTimePromotions = allPromotions.filter(p => p.type === 'onetime');

  // Calculate applicable automatic promotions based on spent amount
  const getApplicableAutomaticPromotions = () => {
    if (formData.type !== 'purchase' || !formData.spent) {
      return [];
    }
    const spent = parseFloat(formData.spent);
    if (isNaN(spent) || spent <= 0) {
      return [];
    }
    
    return allPromotions.filter(promo => {
      if (promo.type !== 'automatic') return false;
      // Check minimum spending requirement
      if (promo.minSpending && spent < promo.minSpending) {
        return false;
      }
      return true;
    });
  };

  const applicableAutomaticPromotions = getApplicableAutomaticPromotions();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = {
        utorid: formData.utorid,
        type: formData.type,
        remark: formData.remark || undefined,
        promotionIds: promotionIds.map((id) => parseInt(id))
      };

      if (formData.spent) {
        data.spent = parseFloat(formData.spent);
      }
      if (formData.amount) {
        data.amount = parseInt(formData.amount);
      }
      if (formData.relatedId) {
        data.relatedId = parseInt(formData.relatedId)
      }
      

      await transactionAPI.createTransaction(data);
      navigate('/transactions');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create transaction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-transaction-page">
      <div className="create-transaction-page-header">
        <h1>Create Transaction</h1>
      </div>
      <div className="create-transaction-card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="utorid">UTORid *</label>
            <input
              type="text"
              id="utorid"
              value={formData.utorid}
              onChange={(e) =>
                setFormData({ ...formData, utorid: e.target.value })
              }
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="type">Type *</label>
            <select
              id="type"
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value })
              }
              required
              disabled={isCashierOnly}
              style={isCashierOnly ? {
                backgroundColor: 'var(--bg-secondary)',
                opacity: 0.6,
                cursor: 'not-allowed',
                color: 'var(--text-secondary)'
              } : {}}
            >
              <option value="purchase">Purchase</option>
              {hasRole('manager') && (<option value="adjustment">Adjustment</option>)}
            </select>
          </div>
          {formData.type === 'purchase' && (
            <div className="form-group">
              <label htmlFor="spent">Amount Spent ($)</label>
              <input
                type="number"
                id="spent"
                step="0.01"
                min="0"
                value={formData.spent}
                onChange={(e) =>
                  setFormData({ ...formData, spent: e.target.value })
                }
              />
            </div>
          )}
          {formData.type === 'adjustment' && (
            <>
              <div className="form-group">
                <label htmlFor="amount">Points Amount</label>
                <input
                  type="number"
                  id="amount"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label htmlFor="amount">Related Id</label>
                <input
                  type="number"
                  id="relatedId"
                  min="0"
                  value={formData.relatedId}
                  onChange={(e) =>
                    setFormData({ ...formData, relatedId: e.target.value })
                  }
                />
              </div>
            </>
          )}
          <PromotionSelector
            promotions={oneTimePromotions}
            value={promotionIds}
            onChange={setPromotionIds}
            formData={formData}
          />
          
          {/* Display automatic promotions that will be applied */}
          {formData.type === 'purchase' && applicableAutomaticPromotions.length > 0 && (
            <div className="form-group">
              <label>Automatic Promotions (will be applied)</label>
              <div className="promotion-list">
                {applicableAutomaticPromotions.map((promo) => (
                  <div key={promo.id} className="promotion-item">
                    <span className="promotion-name">{promo.name} (Automatic)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="form-group">
            <label htmlFor="remark">Remark</label>
            <textarea
              id="remark"
              value={formData.remark}
              onChange={(e) =>
                setFormData({ ...formData, remark: e.target.value })
              }
              rows="3"
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate('/transactions')}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CashierCreateTx;

