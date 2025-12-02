// Create/Edit promotion page (for managers)
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { promotionAPI } from '../services/api';
import './CreatePromotion.css';

const CreatePromotion = () => {
  const navigate = useNavigate();
  const { promotionId } = useParams();
  const isEditMode = !!promotionId;
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'automatic',
    startTime: '',
    endTime: '',
    minSpending: '',
    rate: '',
    points: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPromotion, setLoadingPromotion] = useState(isEditMode);
  const [deleting, setDeleting] = useState(false);

  const loadPromotion = useCallback(async () => {
    if (!promotionId) return;
    
    setLoadingPromotion(true);
    setError('');
    try {
      const response = await promotionAPI.getPromotion(promotionId);
      const promo = response.data;
      
      // Format datetime-local inputs (convert ISO to local datetime string)
      const formatDateTimeLocal = (isoString) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      };

      setFormData({
        name: promo.name || '',
        description: promo.description || '',
        type: promo.type || 'automatic',
        startTime: formatDateTimeLocal(promo.startTime),
        endTime: formatDateTimeLocal(promo.endTime),
        minSpending: promo.minSpending ? String(promo.minSpending) : '',
        rate: promo.rate ? String(promo.rate) : '',
        points: promo.points !== undefined && promo.points !== null ? String(promo.points) : '',
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load promotion.');
    } finally {
      setLoadingPromotion(false);
    }
  }, [promotionId]);

  useEffect(() => {
    if (isEditMode) {
      loadPromotion();
    }
  }, [isEditMode, loadPromotion]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation: At least one reward mechanism must be provided
    if (!formData.minSpending && !formData.rate && !formData.points) {
      toast.error('Please provide at least one reward mechanism (minSpending, rate, or points).');
      return;
    }

    setLoading(true);

    try {
      const data = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
      };

      if (formData.minSpending) {
        data.minSpending = parseFloat(formData.minSpending);
      } else {
        data.minSpending = null;
      }
      if (formData.rate) {
        data.rate = parseFloat(formData.rate);
      } else {
        data.rate = null;
      }
      if (formData.points) {
        data.points = parseInt(formData.points);
      } else {
        data.points = null;
      }

      if (isEditMode) {
        await promotionAPI.updatePromotion(promotionId, data);
        toast.success('Promotion updated successfully!');
      } else {
        await promotionAPI.createPromotion(data);
        toast.success('Promotion created successfully!');
      }
      navigate('/promotions');
    } catch (err) {
      const errorMessage = err.response?.data?.error || `Failed to ${isEditMode ? 'update' : 'create'} promotion.`;
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loadingPromotion) {
    return (
      <div className="create-promotion-page">
        <div className="create-promotion-loading">Loading promotion...</div>
      </div>
    );
  }

  return (
    <div className="create-promotion-page">
      <div className="create-promotion-page-header">
        <div>
          {isEditMode && (
            <Link to="/promotions" className="btn btn-secondary create-promotion-back-btn">
              ← Back to Promotions
            </Link>
          )}
          <h1>{isEditMode ? 'Edit Promotion' : 'Create Promotion'}</h1>
        </div>
      </div>
      <div className="create-promotion-card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Promotion Name *</label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="description">Description *</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows="4"
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
            >
              <option value="automatic">Automatic</option>
              <option value="onetime">One-time</option>
            </select>
            <small>
              Automatic: Applied automatically to eligible transactions. One-time: Users receive a code to use.
            </small>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="startTime">Start Time *</label>
              <input
                type="datetime-local"
                id="startTime"
                value={formData.startTime}
                onChange={(e) =>
                  setFormData({ ...formData, startTime: e.target.value })
                }
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="endTime">End Time *</label>
              <input
                type="datetime-local"
                id="endTime"
                value={formData.endTime}
                onChange={(e) =>
                  setFormData({ ...formData, endTime: e.target.value })
                }
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="minSpending">Minimum Spending (optional)</label>
              <input
                type="number"
                id="minSpending"
                min="0"
                step="0.01"
                value={formData.minSpending}
                onChange={(e) =>
                  setFormData({ ...formData, minSpending: e.target.value })
                }
                placeholder="e.g., 50.00"
              />
              
            </div>
            <div className="form-group">
              <label htmlFor="rate">Rate (optional)</label>
              <input
                type="number"
                id="rate"
                min="0"
                step="0.01"
                value={formData.rate}
                onChange={(e) =>
                  setFormData({ ...formData, rate: e.target.value })
                }
                placeholder="e.g., 1.5"
              />
              
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="points">Fixed Points (optional)</label>
            <input
              type="number"
              id="points"
              min="0"
              step="1"
              value={formData.points}
              onChange={(e) =>
                setFormData({ ...formData, points: e.target.value })
              }
              placeholder="e.g., 100"
            />
            <small>
              Provide minSpending, rate, points, or any combination. At least one reward mechanism is required.
            </small>
          </div>
          <div className="form-actions">
            {isEditMode && (
              <button
                type="button"
                onClick={async () => {
                  if (!confirm('Are you sure you want to delete this promotion? This action cannot be undone.')) return;
                  setDeleting(true);
                  try {
                    await promotionAPI.deletePromotion(promotionId);
                    toast.success('Promotion deleted successfully!');
                    navigate('/promotions');
                  } catch (err) {
                    const errorMessage = err.response?.data?.error || 'Failed to delete promotion.';
                    setError(errorMessage);
                    toast.error(errorMessage);
                    setDeleting(false);
                  }
                }}
                className="btn btn-danger"
                disabled={loading || deleting}
                style={{ marginRight: 'auto' }}
              >
                {deleting ? 'Deleting...' : 'Delete Promotion'}
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/promotions')}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || deleting}>
              {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Promotion' : 'Create Promotion')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePromotion;

