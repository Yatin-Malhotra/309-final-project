// Event detail page
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { eventAPI, userAPI } from '../services/api';
import './EventDetail.css';

const EventDetail = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [addingOrganizer, setAddingOrganizer] = useState(false);
  const [showAddOrganizerForm, setShowAddOrganizerForm] = useState(false);
  const selectRef = useRef(null);

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const loadUsers = useCallback(async () => {
    if (!hasRole('manager') && !hasRole('superuser')) return;
    
    setLoadingUsers(true);
    try {
      const params = { limit: 50 };
      if (userSearch) {
        params.name = userSearch;
      }
      const response = await userAPI.getUsers(params);
      // Filter out users who are already organizers or guests
      const existingOrganizerIds = event?.organizers?.map(o => o.id) || [];
      const existingGuestIds = event?.guests?.map(g => g.id) || [];
      const filteredUsers = (response.data.results || []).filter(
        u => !existingOrganizerIds.includes(u.id) && !existingGuestIds.includes(u.id)
      );
      setUsers(filteredUsers);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoadingUsers(false);
    }
  }, [userSearch, hasRole, event]);

  // Load users for organizer selection (only for managers/superusers)
  useEffect(() => {
    if ((hasRole('manager') || hasRole('superuser')) && event) {
      loadUsers();
    }
  }, [userSearch, hasRole, event, loadUsers]);

  // Auto-focus dropdown when user starts typing to enable keyboard navigation
  useEffect(() => {
    if (showAddOrganizerForm && userSearch && userSearch.length > 0 && selectRef.current) {
      // Small delay to ensure the users list has been updated
      const timer = setTimeout(() => {
        if (selectRef.current && users.length > 0) {
          selectRef.current.focus();
        }
      }, 150);
      
      return () => clearTimeout(timer);
    }
  }, [userSearch, users, showAddOrganizerForm]);

  const loadEvent = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await eventAPI.getEvent(eventId);
      setEvent(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load event.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!confirm('Register for this event?')) return;
    setActionLoading(true);
    try {
      await eventAPI.registerForEvent(eventId);
      loadEvent();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to register for event.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnregister = async () => {
    if (!confirm('Unregister from this event?')) return;
    setActionLoading(true);
    try {
      await eventAPI.unregisterFromEvent(eventId);
      loadEvent();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to unregister from event.');
    } finally {
      setActionLoading(false);
    }
  };

  const isRegistered = () => {
    if (!event || !user) return false;
    // Use isRegistered property from backend if available, otherwise check guests array
    if (event.isRegistered !== undefined) {
      return event.isRegistered;
    }
    return event.guests?.some((g) => g.id === user.id);
  };

  const isOrganizer = () => {
    if (!event || !user) return false;
    return event.organizers?.some((o) => o.id === user.id);
  };

  const isEventFull = () => {
    return event?.capacity && event.guests?.length >= event.capacity;
  };

  const isEventPast = () => {
    return event && new Date(event.endTime) < new Date();
  };

  const handleAddOrganizer = async () => {
    if (!selectedUserId) return;
    
    const user = users.find(u => u.id === parseInt(selectedUserId));
    if (!user) return;

    if (!confirm(`Add ${user.name} (${user.utorid}) as an organizer?`)) return;

    setAddingOrganizer(true);
    try {
      await eventAPI.addOrganizer(eventId, user.utorid);
      setSelectedUserId('');
      setUserSearch('');
      setShowAddOrganizerForm(false); // Hide the form after successful addition
      loadEvent();
      // Reload users to update the list
      if (hasRole('manager') || hasRole('superuser')) {
        loadUsers();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add organizer.');
    } finally {
      setAddingOrganizer(false);
    }
  };

  if (loading) {
    return (
      <div className="event-detail-page">
        <div className="event-detail-loading">Loading event...</div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="event-detail-page">
        <div className="event-detail-error-message">{error || 'Event not found'}</div>
        <Link to="/events" className="btn btn-secondary event-detail-back-btn">
          Back to Events
        </Link>
      </div>
    );
  }

  return (
    <div className="event-detail-page">
      <div className="event-detail-page-header">
        <Link to="/events" className="btn btn-secondary event-detail-back-btn">
          ← Back to Events
        </Link>
      </div>

      <div className="event-detail-section">
        <div className="event-detail-title">{event.name}</div>
        <div className="event-detail-description">
          <strong>Description:</strong>
          <div style={{ marginTop: '8px' }}>{event.description}</div>
        </div>
        <div className="event-detail-info">
          <div className="event-detail-info-item">
            <strong>Location:</strong> {event.location}
          </div>
          <div className="event-detail-info-item">
            <strong>Start Time:</strong> {new Date(event.startTime).toLocaleString()}
          </div>
          <div className="event-detail-info-item">
            <strong>End Time:</strong> {new Date(event.endTime).toLocaleString()}
          </div>
          {event.capacity && (
            <div className="event-detail-info-item">
              <strong>Capacity:</strong> {event.capacity}
            </div>
          )}
        </div>

        {hasRole('manager') && (
          <div className="event-detail-info">
            <div className="event-detail-info-item">
              <strong>Points Remaining:</strong> {event.pointsRemain}
            </div>
            <div className="event-detail-info-item">
              <strong>Points Awarded:</strong> {event.pointsAwarded || 0}
            </div>
            <div className="event-detail-info-item">
              <strong>Published:</strong> {event.published ? 'Yes' : 'No'}
            </div>
          </div>
        )}

        <div className="event-detail-actions">
          {user && !isOrganizer() && !isEventPast() && (
            <>
              {isRegistered() ? (
                // For regular users, show "Already Registered" text instead of Unregister button
                !hasRole('cashier') ? (
                  <span className="event-detail-already-registered">Already Registered</span>
                ) : (
                  <button
                    onClick={handleUnregister}
                    className="btn btn-danger"
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Unregistering...' : 'Unregister'}
                  </button>
                )
              ) : (
                <button
                  onClick={handleRegister}
                  className="btn btn-success"
                  disabled={actionLoading || isEventFull()}
                >
                  {actionLoading ? 'Registering...' : isEventFull() ? 'Event Full' : 'Register'}
                </button>
              )}
            </>
          )}

          {hasRole('manager') && (
            <Link to={`/events/${eventId}/edit`} className="btn btn-primary">
              Edit Event
            </Link>
          )}
        </div>
      </div>

      {((event.organizers && event.organizers.length > 0) || (event.guests && event.guests.length > 0) || (hasRole('manager') || hasRole('superuser'))) && (
        <div className="event-detail-sections-grid">
          <div className="event-detail-section">
            <div className="event-detail-section-header">
              Organizers {event.organizers && event.organizers.length > 0 && `(${event.organizers.length})`}
            </div>
            {event.organizers && event.organizers.length > 0 && (
              <ul className="event-detail-list">
                {event.organizers.map((org) => (
                  <li key={org.id} className="event-detail-list-item">
                    {org.name} ({org.utorid})
                  </li>
                ))}
              </ul>
            )}
            {(hasRole('manager') || hasRole('superuser')) && !isEventPast() && (
              <div className="event-detail-add-organizer-section">
                {!showAddOrganizerForm ? (
                  <button
                    onClick={() => setShowAddOrganizerForm(true)}
                    className="btn btn-primary"
                  >
                    Add Organizer
                  </button>
                ) : (
                  <div className="event-detail-add-organizer-form">
                    <div className="form-group">
                      <input
                        type="text"
                        placeholder="Search users by name or UTORid..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        onFocus={() => {
                          // Focus the dropdown when search input is focused
                          if (selectRef.current && users.length > 0) {
                            setTimeout(() => {
                              selectRef.current?.focus();
                            }, 50);
                          }
                        }}
                      />
                    </div>
                    <div className="form-group">
                      <select
                        ref={selectRef}
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        disabled={loadingUsers || addingOrganizer}
                      >
                        <option value="">Select a user to add as organizer...</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.utorid})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="event-detail-add-organizer-actions">
                      <button
                        onClick={handleAddOrganizer}
                        className="btn btn-primary"
                        disabled={!selectedUserId || addingOrganizer || loadingUsers}
                      >
                        {addingOrganizer ? 'Adding...' : 'Add Organizer'}
                      </button>
                      <button
                        onClick={() => {
                          setShowAddOrganizerForm(false);
                          setSelectedUserId('');
                          setUserSearch('');
                        }}
                        className="btn btn-secondary"
                        disabled={addingOrganizer}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {event.guests && event.guests.length > 0 && (
            <div className="event-detail-section">
              <div className="event-detail-section-header">Guests ({event.guests.length})</div>
              <ul className="event-detail-list">
                {event.guests.map((guest) => (
                  <li key={guest.id} className="event-detail-list-item">
                    {guest.name} ({guest.utorid})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EventDetail;

