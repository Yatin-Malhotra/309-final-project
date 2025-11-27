// Create promotion page (for managers)
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { promotionAPI } from '../services/api';

const CreatePromotion = () => {
  const navigate = useNavigate();
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation: At least one reward mechanism must be provided
    if (!formData.minSpending && !formData.rate && !formData.points) {
      setError('Please provide either (minSpending + rate) or points.');
      return;
    }

    // If minSpending is provided, rate should also be provided
    if (formData.minSpending && !formData.rate) {
      setError('Rate is required when minimum spending is provided.');
      return;
    }

    // vice versa
    if (formData.rate && !formData.minSpending) {
      setError('Minimum spending is required when rate is provided.');
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
      }
      if (formData.rate) {
        data.rate = parseFloat(formData.rate);
      }
      if (formData.points) {
        data.points = parseInt(formData.points);
      }

      await promotionAPI.createPromotion(data);
      navigate('/promotions');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create promotion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Create Promotion</h1>
      <div className="card">
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
            <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px' }}>
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
              <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                Required if rate is provided
              </small>
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
              <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                Points multiplier (required if minSpending is provided)
              </small>
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
            <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px' }}>
              Provide either (minSpending + rate) OR fixed points. Cannot provide both.
            </small>
          </div>
          {error && <div className="error-message">{error}</div>}
          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate('/promotions')}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Promotion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePromotion;

