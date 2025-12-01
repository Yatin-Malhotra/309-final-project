// Create transaction form (for cashiers and above)
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { promotionAPI, transactionAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import PromotionSelector from './PromotionSelector';
import '../pages/CreateTransaction.css';

const CashierCreateTx = () => {
  const { hasRole } = useAuth();
  const isCashierOnly = hasRole('cashier') && !hasRole('manager');
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    utorid: '',
    type: 'purchase',
    spent: '',
    amount: '',
    remark: '',
    relatedId: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [promotions, setPromotions] = useState([]); 
  const [promotionIds, setPromotionIds] = useState([]); 

  // this uses manager id for now
  const getPromotions = async () => {
    const response = await promotionAPI.getPromotions()
    setPromotions(response.data.results)
  }

  useEffect(() => {
    getPromotions()
  }, [])

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
            promotions={promotions}
            value={promotionIds}
            onChange={setPromotionIds}
            formData={formData}
          />
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

