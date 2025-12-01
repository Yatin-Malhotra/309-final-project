// Transaction detail sliding panel component
import { useState, useEffect } from 'react';
import { transactionAPI, promotionAPI } from '../services/api';
import './TransactionDetailPanel.css';

const TransactionDetailPanel = ({ transaction, isOpen, onClose, onUpdate, hasRole }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingAmount, setEditingAmount] = useState(false);
  const [editingSpent, setEditingSpent] = useState(false);
  const [amount, setAmount] = useState('');
  const [spent, setSpent] = useState('');
  const [transactionDetails, setTransactionDetails] = useState(null);
  const [promotionNames, setPromotionNames] = useState({});

  useEffect(() => {
    if (isOpen && transaction) {
      setAmount(transaction.amount?.toString() || '');
      setSpent(transaction.spent?.toString() || '');
      setEditingAmount(false);
      setEditingSpent(false);
      setError('');
      loadTransactionDetails();
    }
  }, [isOpen, transaction]);

  const loadTransactionDetails = async () => {
    if (!transaction?.id) return;
    
    try {
      const response = await transactionAPI.getTransaction(transaction.id);
      setTransactionDetails(response.data);
      setAmount(response.data.amount?.toString() || '');
      setSpent(response.data.spent?.toString() || '');
      
      // Load promotion names if promotionIds exist
      if (response.data.promotionIds && response.data.promotionIds.length > 0) {
        loadPromotionNames(response.data.promotionIds);
      }
    } catch (err) {
      console.error('Failed to load transaction details:', err);
      // Fallback to transaction prop if API fails
      setTransactionDetails(transaction);
      if (transaction.promotionIds && transaction.promotionIds.length > 0) {
        loadPromotionNames(transaction.promotionIds);
      }
    }
  };

  const loadPromotionNames = async (promotionIds) => {
    try {
      const names = {};
      // Fetch each promotion to get its name
      await Promise.all(
        promotionIds.map(async (id) => {
          try {
            const response = await promotionAPI.getPromotion(id);
            names[id] = response.data.name;
          } catch (err) {
            // If promotion not found, use ID as fallback
            names[id] = `#${id}`;
          }
        })
      );
      setPromotionNames(names);
    } catch (err) {
      console.error('Failed to load promotion names:', err);
    }
  };

  const handleSaveAmount = async () => {
    if (!transaction?.id) return;
    
    const newAmount = parseFloat(amount);
    if (isNaN(newAmount)) {
      setError('Invalid amount');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await transactionAPI.updateTransactionAmount(transaction.id, newAmount);
      setEditingAmount(false);
      // Reload transaction details
      await loadTransactionDetails();
      // Notify parent to refresh the list
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update amount');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSpent = async () => {
    if (!transaction?.id) return;
    
    const newSpent = parseFloat(spent);
    if (isNaN(newSpent) || newSpent <= 0) {
      setError('Invalid spent amount');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await transactionAPI.updateTransactionSpent(transaction.id, newSpent);
      setEditingSpent(false);
      // Reload transaction details
      await loadTransactionDetails();
      // Notify parent to refresh the list
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update spent amount');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessRedemption = async () => {
    if (!confirm('Process this redemption?')) return;
    
    setLoading(true);
    setError('');

    try {
      const response = await transactionAPI.processRedemption(transaction.id);
      // Update state immediately from response
      if (response.data) {
        setTransactionDetails(prev => ({
          ...prev,
          ...response.data,
          processed: response.data.processed !== undefined ? response.data.processed : true
        }));
      }
      // Also reload full details to ensure everything is up to date
      await loadTransactionDetails();
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process redemption');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessPurchase = async () => {
    if (!confirm('Process this purchase transaction?')) return;
    
    setLoading(true);
    setError('');

    try {
      const response = await transactionAPI.processTransaction(transaction.id);
      // Update state immediately from response
      if (response.data) {
        setTransactionDetails(prev => ({
          ...prev,
          ...response.data,
          processed: response.data.processed !== undefined ? response.data.processed : true
        }));
      }
      // Also reload full details to ensure everything is up to date
      await loadTransactionDetails();
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSuspicious = async () => {
    const action = transactionDetails?.suspicious ? 'unmark' : 'mark';
    if (!confirm(`Are you sure you want to ${action} this transaction as suspicious?`)) return;
    
    setLoading(true);
    setError('');

    try {
      const response = await transactionAPI.markSuspicious(transaction.id, !transactionDetails?.suspicious);
      // Update state immediately from response
      if (response.data) {
        setTransactionDetails(prev => ({
          ...prev,
          ...response.data,
          suspicious: response.data.suspicious !== undefined ? response.data.suspicious : !transactionDetails?.suspicious,
          processed: response.data.processed !== undefined ? response.data.processed : prev?.processed
        }));
      }
      // Also reload full details to ensure everything is up to date
      await loadTransactionDetails();
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update suspicious status');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getTransactionTypeBadge = (type) => {
    const colors = {
      purchase: 'transaction-panel-badge-primary',
      redemption: 'transaction-panel-badge-danger',
      adjustment: 'transaction-panel-badge-warning',
      event: 'transaction-panel-badge-success',
      transfer: 'transaction-panel-badge-secondary',
    };
    return colors[type] || 'transaction-panel-badge-secondary';
  };

  if (!isOpen || !transaction) return null;

  const details = transactionDetails || transaction;
  const isCashierOnly = hasRole('cashier') && !hasRole('manager');

  return (
    <>
      <div className={`transaction-panel-overlay ${isOpen ? 'active' : ''}`} onClick={onClose} />
      <div className={`transaction-panel ${isOpen ? 'transaction-panel-open' : ''}`}>
        <div className="transaction-panel-header">
          <h2>Transaction Details</h2>
          <button className="transaction-panel-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="transaction-panel-content">
          {error && <div className="transaction-panel-error">{error}</div>}

          <div className="transaction-panel-section">
            <div className="transaction-panel-field">
              <label>ID</label>
              <div className="transaction-panel-value">{details.id}</div>
            </div>

            {(hasRole('manager') || hasRole('superuser') || isCashierOnly) && (
              <div className="transaction-panel-field">
                <label>User</label>
                <div className="transaction-panel-value">
                  {details.userName || details.utorid || details.user?.utorid || 'N/A'}
                </div>
              </div>
            )}

            {!isCashierOnly && (
              <div className="transaction-panel-field">
                <label>Type</label>
                <div className="transaction-panel-value">
                  <span className={`transaction-panel-badge ${getTransactionTypeBadge(details.type)}`}>
                    {details.type}
                  </span>
                </div>
              </div>
            )}

            <div className="transaction-panel-field">
              <label>Amount</label>
              {editingAmount ? (
                <div className="transaction-panel-edit-amount">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="transaction-panel-amount-input"
                    disabled={loading}
                  />
                  <div className="transaction-panel-edit-actions">
                    <button
                      onClick={handleSaveAmount}
                      className="btn btn-primary"
                      disabled={loading}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingAmount(false);
                        setAmount(details.amount?.toString() || '');
                        setError('');
                      }}
                      className="btn btn-secondary"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="transaction-panel-value-container">
                  <div className="transaction-panel-value">
                    {isCashierOnly ? (details.redeemed || Math.abs(details.amount)) : details.amount}
                  </div>
                  {(hasRole('manager') || hasRole('superuser')) && (
                    <button
                      onClick={() => setEditingAmount(true)}
                      className="transaction-panel-edit-btn"
                      disabled={loading}
                    >
                      Edit
                    </button>
                  )}
                </div>
              )}
            </div>

            {details.spent !== undefined && details.spent !== null && (
              <div className="transaction-panel-field">
                <label>Spent</label>
                {editingSpent ? (
                  <div className="transaction-panel-edit-amount">
                    <input
                      type="number"
                      step="0.01"
                      value={spent}
                      onChange={(e) => setSpent(e.target.value)}
                      className="transaction-panel-amount-input"
                      disabled={loading}
                      placeholder="0.00"
                    />
                    <div className="transaction-panel-edit-actions">
                      <button
                        onClick={handleSaveSpent}
                        className="btn btn-primary"
                        disabled={loading}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingSpent(false);
                          setSpent(details.spent?.toString() || '');
                          setError('');
                        }}
                        className="btn btn-secondary"
                        disabled={loading}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="transaction-panel-value-container">
                    <div className="transaction-panel-value">${details.spent}</div>
                    {(hasRole('manager') || hasRole('superuser')) && details.type === 'purchase' && (
                      <button
                        onClick={() => setEditingSpent(true)}
                        className="transaction-panel-edit-btn"
                        disabled={loading}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="transaction-panel-field">
              <label>Date</label>
              <div className="transaction-panel-value">{formatDate(details.createdAt)}</div>
            </div>

            <div className="transaction-panel-field">
              <label>Status</label>
              <div className="transaction-panel-value">
                {details.processed ? (
                  <span className="transaction-panel-badge transaction-panel-badge-success">
                    Processed
                  </span>
                ) : (
                  <span className="transaction-panel-badge transaction-panel-badge-warning">
                    Pending
                  </span>
                )}
              </div>
            </div>

            {details.suspicious !== undefined && (hasRole('manager') || hasRole('superuser')) && (
              <div className="transaction-panel-field">
                <label>Suspicious</label>
                <div className="transaction-panel-value">
                  {details.suspicious ? (
                    <span className="transaction-panel-badge transaction-panel-badge-danger">
                      Yes
                    </span>
                  ) : (
                    <span className="transaction-panel-badge transaction-panel-badge-success">
                      No
                    </span>
                  )}
                </div>
              </div>
            )}

            {details.remark && (
              <div className="transaction-panel-field">
                <label>Remark</label>
                <div className="transaction-panel-value">{details.remark}</div>
              </div>
            )}

            {details.createdBy && (hasRole('manager') || hasRole('superuser')) && (
              <div className="transaction-panel-field">
                <label>Created By</label>
                <div className="transaction-panel-value">{details.createdBy}</div>
              </div>
            )}

            {details.promotionIds && details.promotionIds.length > 0 && (
              <div className="transaction-panel-field">
                <label>Promotions</label>
                <div className="transaction-panel-value">
                  {details.promotionIds.map((id, index) => (
                    <span key={id}>
                      {promotionNames[id] || `#${id}`}
                      {index < details.promotionIds.length - 1 && ', '}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="transaction-panel-actions">
            {hasRole('cashier') && !details.processed && (isCashierOnly || details.type === 'redemption') && (
              <button
                onClick={handleProcessRedemption}
                className="btn btn-success"
                disabled={loading}
              >
                Process Redemption
              </button>
            )}

            {hasRole('manager') && details.type === 'purchase' && (
              <>
                {!details.processed && !details.suspicious && (
                  <button
                    onClick={handleProcessPurchase}
                    className="btn btn-success"
                    disabled={loading}
                  >
                    Process Transaction
                  </button>
                )}
                {!details.suspicious && (
                  <button
                    onClick={handleToggleSuspicious}
                    className="btn btn-outline-danger"
                    disabled={loading}
                  >
                    Mark Suspicious
                  </button>
                )}
                {details.suspicious && (
                  <button
                    onClick={handleToggleSuspicious}
                    className="btn btn-outline-secondary"
                    disabled={loading}
                  >
                    Clear Suspicious
                  </button>
                )}
              </>
            )}

            {hasRole('manager') && details.type === 'adjustment' && (
              <button
                onClick={handleToggleSuspicious}
                className={`btn ${details.suspicious ? 'btn-outline-secondary' : 'btn-outline-danger'}`}
                disabled={loading}
              >
                {details.suspicious ? 'Clear Suspicious' : 'Mark Suspicious'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default TransactionDetailPanel;

