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
  
  // Guest management state
  const [guestUsers, setGuestUsers] = useState([]);
  const [guestUserSearch, setGuestUserSearch] = useState('');
  const [loadingGuestUsers, setLoadingGuestUsers] = useState(false);
  const [selectedGuestUserId, setSelectedGuestUserId] = useState('');
  const [addingGuest, setAddingGuest] = useState(false);
  const [showAddGuestForm, setShowAddGuestForm] = useState(false);
  const [guestUtorid, setGuestUtorid] = useState('');
  const guestSelectRef = useRef(null);

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

  const loadGuestUsers = useCallback(async () => {
    if (!hasRole('manager') && !hasRole('superuser')) return;
    
    setLoadingGuestUsers(true);
    try {
      const params = { limit: 50 };
      if (guestUserSearch) {
        params.name = guestUserSearch;
      }
      const response = await userAPI.getUsers(params);
      // Filter out users who are already organizers or guests
      const existingOrganizerIds = event?.organizers?.map(o => o.id) || [];
      const existingGuestIds = event?.guests?.map(g => g.id) || [];
      const filteredUsers = (response.data.results || []).filter(
        u => !existingOrganizerIds.includes(u.id) && !existingGuestIds.includes(u.id)
      );
      setGuestUsers(filteredUsers);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoadingGuestUsers(false);
    }
  }, [guestUserSearch, hasRole, event]);

  // Load users for organizer selection (only for managers/superusers)
  useEffect(() => {
    if ((hasRole('manager') || hasRole('superuser')) && event) {
      loadUsers();
    }
  }, [userSearch, hasRole, event, loadUsers]);

  // Load users for guest selection (only for managers/superusers)
  useEffect(() => {
    if ((hasRole('manager') || hasRole('superuser')) && event && showAddGuestForm) {
      loadGuestUsers();
    }
  }, [guestUserSearch, hasRole, event, showAddGuestForm, loadGuestUsers]);

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

  // Auto-focus dropdown for guest selection when user starts typing
  useEffect(() => {
    if (showAddGuestForm && guestUserSearch && guestUserSearch.length > 0 && guestSelectRef.current) {
      const timer = setTimeout(() => {
        if (guestSelectRef.current && guestUsers.length > 0) {
          guestSelectRef.current.focus();
        }
      }, 150);
      
      return () => clearTimeout(timer);
    }
  }, [guestUserSearch, guestUsers, showAddGuestForm]);

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

  const handleAddGuest = async () => {
    let utoridToAdd = '';
    
    // If manager/superuser, get from selected user
    if (hasRole('manager') || hasRole('superuser')) {
      if (!selectedGuestUserId) return;
      const user = guestUsers.find(u => u.id === parseInt(selectedGuestUserId));
      if (!user) return;
      utoridToAdd = user.utorid;
      
      if (!confirm(`Add ${user.name} (${user.utorid}) as a guest?`)) return;
    } else {
      // Event organizer - use utorid directly
      if (!guestUtorid || !guestUtorid.trim()) {
        alert('Please enter a UTORid');
        return;
      }
      utoridToAdd = guestUtorid.trim();
      
      if (!confirm(`Add ${utoridToAdd} as a guest?`)) return;
    }

    setAddingGuest(true);
    try {
      await eventAPI.addGuest(eventId, utoridToAdd);
      setSelectedGuestUserId('');
      setGuestUserSearch('');
      setGuestUtorid('');
      setShowAddGuestForm(false);
      loadEvent();
      // Reload guest users to update the list
      if (hasRole('manager') || hasRole('superuser')) {
        loadGuestUsers();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add guest.');
    } finally {
      setAddingGuest(false);
    }
  };

  const handleRemoveGuest = async (userId) => {
    if (!confirm('Remove this guest from the event?')) return;
    
    setActionLoading(true);
    try {
      await eventAPI.removeGuest(eventId, userId);
      loadEvent();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove guest.');
    } finally {
      setActionLoading(false);
    }
  };

  const canManageGuests = () => {
    return (hasRole('manager') || hasRole('superuser') || isOrganizer()) && !isEventPast();
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
                <button
                  onClick={handleUnregister}
                  className="btn btn-danger"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Unregistering...' : 'Unregister'}
                </button>
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

      {((event.organizers && event.organizers.length > 0) || 
        ((event.guests && event.guests.length > 0) && ((hasRole('manager') || hasRole('superuser')) || isOrganizer())) || 
        (hasRole('manager') || hasRole('superuser')) || 
        isOrganizer()) && (
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

          {((hasRole('manager') || hasRole('superuser')) || isOrganizer()) && (
            <div className="event-detail-section">
              <div className="event-detail-section-header">
                Guests {event.guests && event.guests.length > 0 ? `(${event.guests.length})` : '(0)'}
                {event.capacity && ` / ${event.capacity}`}
              </div>
              {event.guests && event.guests.length > 0 ? (
                <ul className="event-detail-list">
                  {event.guests.map((guest) => (
                    <li key={guest.id} className="event-detail-list-item event-detail-list-item-with-action">
                      <span>{guest.name} ({guest.utorid})</span>
                      {canManageGuests() && (
                        <button
                          onClick={() => handleRemoveGuest(guest.id)}
                          className="btn btn-danger event-detail-remove-btn"
                          disabled={actionLoading}
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ padding: '10px', color: '#666', fontStyle: 'italic' }}>
                  No guests yet
                </div>
              )}
              {canManageGuests() && (
                <div className="event-detail-add-organizer-section">
                  {!showAddGuestForm ? (
                    <button
                      onClick={() => setShowAddGuestForm(true)}
                      className="btn btn-primary"
                      disabled={isEventFull()}
                    >
                      Add Guest
                    </button>
                  ) : (
                    <div className="event-detail-add-organizer-form">
                      {(hasRole('manager') || hasRole('superuser')) ? (
                        <>
                          <div className="form-group">
                            <input
                              type="text"
                              placeholder="Search users by name or UTORid..."
                              value={guestUserSearch}
                              onChange={(e) => setGuestUserSearch(e.target.value)}
                              onFocus={() => {
                                if (guestSelectRef.current && guestUsers.length > 0) {
                                  setTimeout(() => {
                                    guestSelectRef.current?.focus();
                                  }, 50);
                                }
                              }}
                            />
                          </div>
                          <div className="form-group">
                            <select
                              ref={guestSelectRef}
                              value={selectedGuestUserId}
                              onChange={(e) => setSelectedGuestUserId(e.target.value)}
                              disabled={loadingGuestUsers || addingGuest}
                            >
                              <option value="">Select a user to add as guest...</option>
                              {guestUsers.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name} ({u.utorid})
                                </option>
                              ))}
                            </select>
                          </div>
                        </>
                      ) : (
                        <div className="form-group">
                          <input
                            type="text"
                            placeholder="Enter UTORid..."
                            value={guestUtorid}
                            onChange={(e) => setGuestUtorid(e.target.value)}
                            disabled={addingGuest}
                          />
                        </div>
                      )}
                      <div className="event-detail-add-organizer-actions">
                        <button
                          onClick={handleAddGuest}
                          className="btn btn-primary"
                          disabled={
                            addingGuest || 
                            loadingGuestUsers || 
                            ((hasRole('manager') || hasRole('superuser')) && !selectedGuestUserId) ||
                            (!hasRole('manager') && !hasRole('superuser') && !guestUtorid.trim())
                          }
                        >
                          {addingGuest ? 'Adding...' : 'Add Guest'}
                        </button>
                        <button
                          onClick={() => {
                            setShowAddGuestForm(false);
                            setSelectedGuestUserId('');
                            setGuestUserSearch('');
                            setGuestUtorid('');
                          }}
                          className="btn btn-secondary"
                          disabled={addingGuest}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EventDetail;

