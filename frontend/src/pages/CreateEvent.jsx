// Create/Edit event page (for managers)
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { eventAPI, userAPI } from '../services/api';
import '../styles/pages/CreateEvent.css';

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
  const [organizerIds, setOrganizerIds] = useState([]);
  const [originalOrganizerIds, setOriginalOrganizerIds] = useState([]);
  const [organizerUsers, setOrganizerUsers] = useState([]); // Store organizer user objects for display
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showOrganizerDropdown, setShowOrganizerDropdown] = useState(false);
  const organizerInputRef = useRef(null);
  const organizerDropdownRef = useRef(null);
  const [originalPublished, setOriginalPublished] = useState(false); // Track original published state

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

      const publishedState = event.published || false;
      setOriginalPublished(publishedState);
      setFormData({
        name: event.name || '',
        description: event.description || '',
        location: event.location || '',
        startTime: formatDateTimeLocal(event.startTime),
        endTime: formatDateTimeLocal(event.endTime),
        capacity: event.capacity ? String(event.capacity) : '',
        points: event.pointsAllocated ? String(event.pointsAllocated) : '',
        published: publishedState,
      });
      
      // Load existing organizers
      if (event.organizers) {
        const orgIds = event.organizers.map(o => o.id);
        // Store organizer user objects for display (convert from {id, utorid, name} to user format)
        const orgUsers = event.organizers.map(o => ({
          id: o.id,
          utorid: o.utorid,
          name: o.name
        }));
        setOrganizerIds(orgIds);
        setOriginalOrganizerIds(orgIds);
        setOrganizerUsers(orgUsers);
      }
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

  const loadUsers = useCallback(async () => {
    if (!hasRole('manager') && !hasRole('superuser')) return;
    
    setLoadingUsers(true);
    try {
      // Load more users for client-side filtering (like EventDetail)
      const params = { limit: 100 };
      const response = await userAPI.getUsers(params);
      // Filter out users who are already selected as organizers
      const filteredUsers = (response.data.results || []).filter(
        u => !organizerIds.includes(u.id)
      );
      setUsers(filteredUsers);
    } catch (err) {
      // Silently fail - users list is optional
      console.error('Failed to load users:', err);
    } finally {
      setLoadingUsers(false);
    }
  }, [hasRole, organizerIds]);

  // Load users for organizer selection (only for managers/superusers)
  useEffect(() => {
    if (hasRole('manager') || hasRole('superuser')) {
      loadUsers();
    }
  }, [hasRole, loadUsers]);

  // Filter users based on search input (client-side filtering)
  const filteredOrganizerUsers = userSearch.trim()
    ? users.filter(u => 
        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.utorid.toLowerCase().includes(userSearch.toLowerCase())
      )
    : users;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showOrganizerDropdown && 
          organizerInputRef.current && 
          organizerDropdownRef.current &&
          !organizerInputRef.current.contains(event.target) &&
          !organizerDropdownRef.current.contains(event.target)) {
        setShowOrganizerDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOrganizerDropdown]);

  const handleOrganizerSelect = (user) => {
    if (!organizerIds.includes(user.id)) {
      setOrganizerIds([...organizerIds, user.id]);
      // Add to organizerUsers for display
      setOrganizerUsers([...organizerUsers, user]);
    }
    setUserSearch('');
    setShowOrganizerDropdown(false);
  };

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
      };

      if (formData.capacity) {
        data.capacity = parseInt(formData.capacity);
      }

      // Only include points and published for managers/superusers
      if (hasRole('manager') || hasRole('superuser')) {
        data.points = parseInt(formData.points);
        data.published = formData.published;
        // Only send organizerIds if they've changed (to avoid unnecessary delete/recreate)
        const organizerIdsChanged = JSON.stringify([...organizerIds].sort()) !== JSON.stringify([...originalOrganizerIds].sort());
        if (organizerIdsChanged) {
          data.organizerIds = organizerIds;
        }
      }

      if (isEditMode) {
        await eventAPI.updateEvent(eventId, data);
        toast.success('Event updated successfully!');
      } else {
        await eventAPI.createEvent(data);
        toast.success('Event created successfully!');
      }
      navigate('/events');
    } catch (err) {
      const errorMessage = err.response?.data?.error || `Failed to ${isEditMode ? 'update' : 'create'} event.`;
      setError(errorMessage);
      toast.error(errorMessage);
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
            {(hasRole('manager') || hasRole('superuser')) && (
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
                  required={!isEditMode}
                />
              </div>
            )}
          </div>
          
          {(hasRole('manager') || hasRole('superuser')) && (
            <div className="form-group">
              <label htmlFor="organizers">Organizers (optional)</label>
              <div className="form-group" style={{ position: 'relative', marginBottom: '8px' }}>
                <input
                  ref={organizerInputRef}
                  type="text"
                  placeholder="Search users by name or UTORid..."
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setShowOrganizerDropdown(true);
                  }}
                  onFocus={() => {
                    if (filteredOrganizerUsers.length > 0) {
                      setShowOrganizerDropdown(true);
                    }
                  }}
                  disabled={loadingUsers}
                  className="event-detail-searchable-input"
                  style={{ width: '100%', padding: '8px' }}
                />
                {showOrganizerDropdown && filteredOrganizerUsers.length > 0 && (
                  <div 
                    ref={organizerDropdownRef}
                    className="event-detail-searchable-dropdown"
                  >
                    {filteredOrganizerUsers.map((u) => (
                      <div
                        key={u.id}
                        className="event-detail-dropdown-item"
                        onClick={() => handleOrganizerSelect(u)}
                      >
                        {u.name} ({u.utorid})
                      </div>
                    ))}
                  </div>
                )}
                {showOrganizerDropdown && filteredOrganizerUsers.length === 0 && userSearch.trim() && (
                  <div 
                    ref={organizerDropdownRef}
                    className="event-detail-searchable-dropdown"
                  >
                    <div className="event-detail-dropdown-item event-detail-dropdown-empty">
                      No users found
                    </div>
                  </div>
                )}
                {loadingUsers && (
                  <div className="event-detail-dropdown-loading">Loading users...</div>
                )}
              </div>
              {organizerIds.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  {organizerIds.map((userId) => {
                    const user = organizerUsers.find(u => u.id === userId);
                    return (
                      <div
                        key={userId}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px',
                          marginBottom: '4px',
                          backgroundColor: '#f5f5f5',
                          borderRadius: '4px',
                        }}
                      >
                        <span>
                          {user ? `${user.name} (${user.utorid})` : `User #${userId}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setOrganizerIds(organizerIds.filter(id => id !== userId));
                            setOrganizerUsers(organizerUsers.filter(u => u.id !== userId));
                            // Reload users to include the removed user in the list
                            if (hasRole('manager') || hasRole('superuser')) {
                              loadUsers();
                            }
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <small>Select users who will organize this event.</small>
            </div>
          )}

          {(hasRole('manager') || hasRole('superuser')) && (
            <div className={`form-group ${isEditMode && originalPublished ? 'published-disabled' : ''}`}>
              <label>Published Status</label>
              <div className="switch-container">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={formData.published}
                    onChange={(e) =>
                      setFormData({ ...formData, published: e.target.checked })
                    }
                    disabled={isEditMode && originalPublished}
                  />
                  <span className="slider round"></span>
                </label>
                <span className="switch-label">{formData.published ? 'Published' : 'Draft'}</span>
              </div>
              <small>
                {isEditMode && originalPublished 
                  ? 'Published events cannot be unpublished.'
                  : formData.published 
                    ? 'This event is visible to all users.' 
                    : 'This event is hidden from regular users.'}
              </small>
            </div>
          )}

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

