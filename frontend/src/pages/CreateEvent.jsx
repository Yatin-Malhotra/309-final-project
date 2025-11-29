// Create/Edit event page (for managers)
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { eventAPI } from '../services/api';
import './CreateEvent.css';

const CreateEvent = () => {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const { user, hasRole } = useAuth();
  const isEditMode = !!eventId;
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    startTime: '',
    endTime: '',
    capacity: '',
    points: '',
    published: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(isEditMode);
  const [isOrganizer, setIsOrganizer] = useState(false);

  const loadEvent = useCallback(async () => {
    if (!eventId || !user) return;
    
    setLoadingEvent(true);
    setError('');
    try {
      const response = await eventAPI.getEvent(eventId);
      const event = response.data;
      
      const isOrg = event.organizers?.some(o => o.id === user.id);
      setIsOrganizer(isOrg);

      if (!hasRole('manager') && !isOrg) {
        setError('You do not have permission to edit this event.');
        return;
      }
      
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
        name: event.name || '',
        description: event.description || '',
        location: event.location || '',
        startTime: formatDateTimeLocal(event.startTime),
        endTime: formatDateTimeLocal(event.endTime),
        capacity: event.capacity ? String(event.capacity) : '',
        points: event.points ? String(event.points) : '',
        published: event.published || false,
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load event.');
    } finally {
      setLoadingEvent(false);
    }
  }, [eventId, user, hasRole]);

  useEffect(() => {
    if (isEditMode) {
      loadEvent();
    }
  }, [isEditMode, loadEvent]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = {
        name: formData.name,
        description: formData.description,
        location: formData.location,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        points: parseInt(formData.points),
        published: formData.published,
      };

      if (formData.capacity) {
        data.capacity = parseInt(formData.capacity);
      }

      if (isEditMode) {
        await eventAPI.updateEvent(eventId, data);
      } else {
        await eventAPI.createEvent(data);
      }
      navigate('/events');
    } catch (err) {
      setError(err.response?.data?.error || `Failed to ${isEditMode ? 'update' : 'create'} event.`);
    } finally {
      setLoading(false);
    }
  };

  if (loadingEvent) {
    return (
      <div className="create-event-page">
        <div className="create-event-loading">Loading event...</div>
      </div>
    );
  }

  return (
    <div className="create-event-page">
      <div className="create-event-page-header">
        <div>
          {isEditMode && (
            <Link to={`/events/${eventId}`} className="btn btn-secondary create-event-back-btn" style={{ marginBottom: '16px', display: 'inline-block' }}>
              ← Back to Event
            </Link>
          )}
          <h1>{isEditMode ? 'Edit Event' : 'Create Event'}</h1>
        </div>
      </div>
      <div className="create-event-card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Event Name *</label>
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
            <label htmlFor="location">Location *</label>
            <input
              type="text"
              id="location"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              required
            />
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
              <label htmlFor="capacity">Capacity (optional)</label>
              <input
                type="number"
                id="capacity"
                min="1"
                value={formData.capacity}
                onChange={(e) =>
                  setFormData({ ...formData, capacity: e.target.value })
                }
              />
            </div>
            <div className="form-group">
              <label htmlFor="points">Points to Allocate *</label>
              <input
                type="number"
                id="points"
                min="1"
                value={formData.points}
                onChange={(e) =>
                  setFormData({ ...formData, points: e.target.value })
                }
                required
              />
            </div>
          </div>
          
          {(hasRole('manager') || isOrganizer) && (
            <div className="form-group">
              <label>Published Status</label>
              <div className="switch-container">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={formData.published}
                    onChange={(e) =>
                      setFormData({ ...formData, published: e.target.checked })
                    }
                  />
                  <span className="slider round"></span>
                </label>
                <span className="switch-label">{formData.published ? 'Published' : 'Draft'}</span>
              </div>
              <small>
                {formData.published 
                  ? 'This event is visible to all users.' 
                  : 'This event is hidden from regular users.'}
              </small>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}
          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate('/events')}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Event' : 'Create Event')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateEvent;

