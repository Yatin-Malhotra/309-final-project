// Transaction Modal Component (for transfer and redemption)
import { useState, useEffect } from "react";
import { toast } from 'react-toastify';
import { transactionAPI } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import './TransactionModal.css';

const TransactionModal = ({ isOpen, onClose, defaultType = 'redemption', onSuccess }) => {
  const { user, updateLocalUser } = useAuth();
  const [formData, setFormData] = useState({
    utorid: '',
    type: defaultType,
    amount: '',
    remark: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Reset form when modal opens/closes or type changes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        utorid: '',
        type: defaultType,
        amount: '',
        remark: ''
      });
      setError('');
    }
  }, [isOpen, defaultType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const amount = parseInt(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      const errorMessage = 'Please enter a valid amount';
      setError(errorMessage);
      toast.error(errorMessage);
      setLoading(false);
      return;
    }

    try {
      if (formData.type === 'redemption') {
        await transactionAPI.createRedemption(amount, formData.remark || undefined);
        toast.success('Redemption request created successfully!');
      } else {
        if (!formData.utorid.trim()) {
          const errorMessage = 'Please enter recipient UTORid';
          setError(errorMessage);
          toast.error(errorMessage);
          setLoading(false);
          return;
        }
        // Prevent self-transfers
        if (formData.utorid.trim().toLowerCase() === user?.utorid?.toLowerCase()) {
          const errorMessage = 'Cannot transfer points to yourself';
          setError(errorMessage);
          toast.error(errorMessage);
          setLoading(false);
          return;
        }
        await transactionAPI.createTransfer(formData.utorid.trim(), amount, formData.remark || undefined);
        toast.success('Points transferred successfully!');
      }
      
      updateLocalUser();
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to create transaction.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="transaction-modal-overlay" onClick={onClose}>
      <div className="transaction-modal-content" onClick={(e) => e.stopPropagation()}>
        {formData.type === 'redemption' && (
          <a 
            href="https://www.youtube.com/shorts/csy5RHcXT6Y" 
            target="_blank" 
            rel="noopener noreferrer"
            className="transaction-modal-easter-egg"
            onClick={(e) => e.stopPropagation()}
          >
            Easter Egg
          </a>
        )}
        <button className="transaction-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="transaction-modal-header">
          <h2>{formData.type === 'transfer' ? 'Transfer Points' : 'Redeem Points'}</h2>
        </div>
        <form onSubmit={handleSubmit}>
          {formData.type === 'transfer' && (
            <div className="form-group">
              <label htmlFor="utorid">Recipient UTORid *</label>
              <input
                type="text"
                id="utorid"
                placeholder="Enter recipient UTORid"
                value={formData.utorid}
                onChange={(e) =>
                  setFormData({ ...formData, utorid: e.target.value })
                }
                required
                disabled={loading}
              />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="amount">Points Amount *</label>
            <input
              type="number"
              id="amount"
              min="1"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              required
              disabled={loading}
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
              disabled={loading}
            />
          </div>
          <div className="form-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
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

export default TransactionModal;

