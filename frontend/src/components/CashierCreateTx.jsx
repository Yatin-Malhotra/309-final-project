// Create transaction form (for cashiers and above)
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { promotionAPI, transactionAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/pages/CreateTransaction.css';

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

  // Calculate eligible promotions based on spent amount
  const getEligiblePromotions = () => {
    if (formData.type !== 'purchase' || !formData.spent) {
      return { automatic: [], oneTime: [] };
    }
    const spent = parseFloat(formData.spent);
    if (isNaN(spent) || spent <= 0) {
      return { automatic: [], oneTime: [] };
    }
    
    const eligible = {
      automatic: [],
      oneTime: []
    };
    
    allPromotions.forEach(promo => {
      // Check minimum spending requirement
      if (promo.minSpending && spent < promo.minSpending) {
        return;
      }
      
      if (promo.type === 'automatic') {
        eligible.automatic.push(promo);
      } else if (promo.type === 'onetime') {
        eligible.oneTime.push(promo);
      }
    });
    
    return eligible;
  };

  const eligiblePromotions = getEligiblePromotions();

  // Handle clicking on a one-time promotion to toggle it
  const handleToggleOneTimePromotion = (promoId) => {
    const promoIdStr = String(promoId);
    if (promotionIds.includes(promoIdStr)) {
      // Remove if already selected
      setPromotionIds(promotionIds.filter(id => id !== promoIdStr));
    } else {
      // Add if not selected
      setPromotionIds([...promotionIds, promoIdStr]);
    }
  };

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
      toast.success('Transaction created successfully!');
      navigate('/transactions');
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to create transaction.';
      setError(errorMessage);
      toast.error(errorMessage);
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
          {/* Display all eligible promotions */}
          {formData.type === 'purchase' && 
           (eligiblePromotions.automatic.length > 0 || eligiblePromotions.oneTime.length > 0) && (
            <div className="form-group">
              <label>Available Promotions</label>
              <div className="promotion-list">
                {/* Automatic promotions - read-only, will be applied automatically */}
                {eligiblePromotions.automatic.map((promo) => (
                  <div key={promo.id} className="promotion-item promotion-item-automatic">
                    <span className="promotion-name">{promo.name} (Automatic)</span>
                    <span className="promotion-checkmark">✓ Applied</span>
                  </div>
                ))}
                {/* One-time promotions - clickable to apply */}
                {eligiblePromotions.oneTime.map((promo) => {
                  const isSelected = promotionIds.includes(String(promo.id));
                  return (
                    <div 
                      key={promo.id} 
                      className={`promotion-item promotion-item-onetime ${isSelected ? 'promotion-item-selected' : ''}`}
                      onClick={() => handleToggleOneTimePromotion(promo.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <span className="promotion-name">
                        {promo.name} (One Time{isSelected ? '' : ' - click to apply'})
                      </span>
                      {isSelected && (
                        <span className="promotion-checkmark">✓ Applied</span>
                      )}
                    </div>
                  );
                })}
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

