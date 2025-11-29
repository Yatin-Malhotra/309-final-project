// Create transaction form (for users)
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { transactionAPI } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import '../pages/CreateTransaction.css';

const UserCreateTx = () => {
  const { user, updateLocalUser } = useAuth()
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
      userId: '',
      type: 'redemption',
      amount: '',
      remark: ''
  })
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const amount = parseInt(formData.amount)

    try {
      if (formData.type === 'redemption') {
        await transactionAPI.createRedemption(amount, formData.remark || undefined)
      } else {
        await transactionAPI.createTransfer(formData.userId, amount, formData.remark || undefined)
      }
      
      updateLocalUser()
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
            <label htmlFor="type">Type *</label>
            <select
              id="type"
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value })
              }
              required
            >
              <option value="redemption">Redemption</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>
          {formData.type === 'transfer' && (
            <div className="form-group">
              <label htmlFor="userId">Recipient Id *</label>
              <input
                type="number"
                min="0"
                id="userId"
                value={formData.userId}
                onChange={(e) =>
                  setFormData({ ...formData, userId: e.target.value })
                }
                required
                />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="amount">Points Amount</label>
            <input
              type="number"
              id="amount"
              min="0"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
            />
          </div>
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
  )
}

export default UserCreateTx;
