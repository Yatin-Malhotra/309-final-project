// Event detail page
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { eventAPI, userAPI } from '../services/api';
import ConfirmationModal from '../components/ConfirmationModal';
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
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [addingOrganizer, setAddingOrganizer] = useState(false);
  const [showAddOrganizerForm, setShowAddOrganizerForm] = useState(false);
  const [showOrganizerDropdown, setShowOrganizerDropdown] = useState(false);
  const organizerInputRef = useRef(null);
  const organizerDropdownRef = useRef(null);
  const [confirmation, setConfirmation] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDangerous: false
  });
  
  // Guest management state
  const [guestUsers, setGuestUsers] = useState([]);
  const [guestUserSearch, setGuestUserSearch] = useState('');
  const [loadingGuestUsers, setLoadingGuestUsers] = useState(false);
  const [selectedGuestUserId, setSelectedGuestUserId] = useState(null);
  const [addingGuest, setAddingGuest] = useState(false);
  const [showAddGuestForm, setShowAddGuestForm] = useState(false);
  const [guestUtorid, setGuestUtorid] = useState('');
  const [showGuestDropdown, setShowGuestDropdown] = useState(false);
  const guestInputRef = useRef(null);
  const guestDropdownRef = useRef(null);
  
  // Points allocation state
  const [allocatingPoints, setAllocatingPoints] = useState(false);
  const [pointsAmount, setPointsAmount] = useState('');
  const [selectedGuestForPoints, setSelectedGuestForPoints] = useState(null);
  const [showPointsForm, setShowPointsForm] = useState(false);

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const loadUsers = useCallback(async () => {
    if (!hasRole('manager') && !hasRole('superuser')) return;
    
    setLoadingUsers(true);
    try {
      // Load more users for client-side filtering
      const params = { limit: 100 };
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
  }, [hasRole, event]);

  const loadGuestUsers = useCallback(async () => {
    if (!hasRole('manager') && !hasRole('superuser')) return;
    
    setLoadingGuestUsers(true);
    try {
      // Load more users for client-side filtering
      const params = { limit: 100 };
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
  }, [hasRole, event]);

  // Load users for organizer selection (only for managers/superusers)
  useEffect(() => {
    if ((hasRole('manager') || hasRole('superuser')) && event && showAddOrganizerForm) {
      loadUsers();
    }
  }, [hasRole, event, showAddOrganizerForm, loadUsers]);

  // Load users for guest selection (only for managers/superusers)
  useEffect(() => {
    if ((hasRole('manager') || hasRole('superuser')) && event && showAddGuestForm) {
      loadGuestUsers();
    }
  }, [hasRole, event, showAddGuestForm, loadGuestUsers]);

  // Filter users based on search input (client-side filtering)
  const filteredOrganizerUsers = userSearch.trim()
    ? users.filter(u => 
        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.utorid.toLowerCase().includes(userSearch.toLowerCase())
      )
    : users;

  const filteredGuestUsers = guestUserSearch.trim()
    ? guestUsers.filter(u => 
        u.name.toLowerCase().includes(guestUserSearch.toLowerCase()) ||
        u.utorid.toLowerCase().includes(guestUserSearch.toLowerCase())
      )
    : guestUsers;

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
      if (showGuestDropdown && 
          guestInputRef.current && 
          guestDropdownRef.current &&
          !guestInputRef.current.contains(event.target) &&
          !guestDropdownRef.current.contains(event.target)) {
        setShowGuestDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOrganizerDropdown, showGuestDropdown]);

  // Autofocus input when form opens
  useEffect(() => {
    if (showAddOrganizerForm && organizerInputRef.current) {
      setTimeout(() => {
        organizerInputRef.current?.focus();
      }, 100);
    }
  }, [showAddOrganizerForm]);

  useEffect(() => {
    if (showAddGuestForm && guestInputRef.current) {
      setTimeout(() => {
        guestInputRef.current?.focus();
      }, 100);
    }
  }, [showAddGuestForm]);

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

  const register = async () => {
    setActionLoading(true);
    try {
      await eventAPI.registerForEvent(eventId);
      toast.success('Successfully registered for event!');
      loadEvent();
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to register for event.';
      toast.error(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegister = async () => {
    setConfirmation({
      isOpen: true,
      title: 'Register for Event',
      message: 'Register for this event?',
      onConfirm: register,
      isDangerous: false
    });
  };

  const unregister = async () => {
    setActionLoading(true);
    try {
      await eventAPI.unregisterFromEvent(eventId);
      toast.success('Successfully unregistered from event!');
      loadEvent();
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to unregister from event.';
      toast.error(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnregister = async () => {
    setConfirmation({
      isOpen: true,
      title: 'Unregister from Event',
      message: 'Unregister from this event?',
      onConfirm: unregister,
      isDangerous: true
    });
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

  const addOrganizer = async () => {
    setAddingOrganizer(true);
    try {
      await eventAPI.addOrganizer(eventId, selectedUserId.utorid);
      toast.success(`Organizer ${selectedUserId.name} added successfully!`);
      setSelectedUserId(null);
      setUserSearch('');
      setShowOrganizerDropdown(false);
      setShowAddOrganizerForm(false); // Hide the form after successful addition
      loadEvent();
      // Reload users to update the list
      if (hasRole('manager') || hasRole('superuser')) {
        loadUsers();
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to add organizer.';
      toast.error(errorMessage);
    } finally {
      setAddingOrganizer(false);
    }
  };

  const handleAddOrganizer = async () => {
    if (!selectedUserId) return;

    setConfirmation({
      isOpen: true,
      title: 'Add Organizer',
      message: `Add ${selectedUserId.name} (${selectedUserId.utorid}) as an organizer?`,
      onConfirm: addOrganizer,
      isDangerous: false
    });
  };

  const handleOrganizerSelect = (user) => {
    setSelectedUserId(user);
    setUserSearch(`${user.name} (${user.utorid})`);
    setShowOrganizerDropdown(false);
  };

  const addGuest = async (utoridToAdd) => {
    setAddingGuest(true);
    try {
      await eventAPI.addGuest(eventId, utoridToAdd);
      toast.success(`Guest added successfully!`);
      setSelectedGuestUserId(null);
      setGuestUserSearch('');
      setGuestUtorid('');
      setShowGuestDropdown(false);
      setShowAddGuestForm(false);
      loadEvent();
      // Reload guest users to update the list
      if (hasRole('manager') || hasRole('superuser')) {
        loadGuestUsers();
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to add guest.';
      toast.error(errorMessage);
    } finally {
      setAddingGuest(false);
    }
  };

  const handleAddGuest = async () => {
    let utoridToAdd = '';
    let confirmMessage = '';
    
    // If manager/superuser, get from selected user
    if (hasRole('manager') || hasRole('superuser')) {
      if (!selectedGuestUserId) return;
      utoridToAdd = selectedGuestUserId.utorid;
      confirmMessage = `Add ${selectedGuestUserId.name} (${selectedGuestUserId.utorid}) as a guest?`;
    } else {
      // Event organizer - use utorid directly
      if (!guestUtorid || !guestUtorid.trim()) {
        toast.error('Please enter a UTORid');
        return;
      }
      utoridToAdd = guestUtorid.trim();
      confirmMessage = `Add ${utoridToAdd} as a guest?`;
    }
    
    setConfirmation({
      isOpen: true,
      title: 'Add Guest',
      message: confirmMessage,
      onConfirm: () => addGuest(utoridToAdd),
      isDangerous: false
    });
  };

  const handleGuestSelect = (user) => {
    setSelectedGuestUserId(user);
    setGuestUserSearch(`${user.name} (${user.utorid})`);
    setShowGuestDropdown(false);
  };

  const removeGuest = async (userId) => {
    setActionLoading(true);
    try {
      await eventAPI.removeGuest(eventId, userId);
      toast.success('Guest removed successfully!');
      loadEvent();
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to remove guest.';
      toast.error(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveGuest = async (userId) => {
    setConfirmation({
      isOpen: true,
      title: 'Remove Guest',
      message: 'Remove this guest from the event?',
      onConfirm: () => removeGuest(userId),
      isDangerous: true
    });
  };

  const removeOrganizer = async (userId) => {
    setActionLoading(true);
    try {
      await eventAPI.removeOrganizer(eventId, userId);
      toast.success('Organizer removed successfully!');
      loadEvent();
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to remove organizer.';
      toast.error(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveOrganizer = async (userId) => {
    setConfirmation({
      isOpen: true,
      title: 'Remove Organizer',
      message: 'Remove this organizer from the event?',
      onConfirm: () => removeOrganizer(userId),
      isDangerous: true
    });
  };

  const canRemoveOrganizers = () => {
    return (hasRole('manager') || hasRole('superuser')) && !isEventPast();
  };

  const deleteEvent = async () => {
    setActionLoading(true);
    try {
      await eventAPI.deleteEvent(eventId);
      toast.success('Event deleted successfully!');
      navigate('/events');
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to delete event.';
      toast.error(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteEvent = async () => {
    setConfirmation({
      isOpen: true,
      title: 'Delete Event',
      message: `Are you sure you want to delete "${event.name}"? This action cannot be undone.`,
      onConfirm: deleteEvent,
      isDangerous: true
    });
  };

  const canDeleteEvent = () => {
    return (hasRole('manager') || hasRole('superuser')) && !event?.published;
  };

  const canManageGuests = () => {
    return (hasRole('manager') || hasRole('superuser') || isOrganizer()) && !isEventPast();
  };

  const canRemoveGuests = () => {
    return (hasRole('manager') || hasRole('superuser')) && !isEventPast();
  };

  const canAllocatePoints = () => {
    return (hasRole('manager') || hasRole('superuser') || isOrganizer()) && !isEventPast();
  };

  const awardPoints = async (guest, amount) => {
    setAllocatingPoints(true);
    try {
      await eventAPI.awardPointsToGuest(eventId, guest.utorid, amount);
      toast.success(`${amount} points awarded to ${guest.name} successfully!`);
      setPointsAmount('');
      setSelectedGuestForPoints(null);
      setShowPointsForm(false);
      loadEvent(); // Reload to update points remaining
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to award points.';
      toast.error(errorMessage);
    } finally {
      setAllocatingPoints(false);
    }
  };

  const handleAwardPoints = async (guest) => {
    if (!pointsAmount || parseInt(pointsAmount) <= 0) {
      toast.error('Please enter a valid points amount');
      return;
    }

    const amount = parseInt(pointsAmount);
    setConfirmation({
      isOpen: true,
      title: 'Award Points',
      message: `Award ${amount} points to ${guest.name} (${guest.utorid})?`,
      onConfirm: () => awardPoints(guest, amount),
      isDangerous: false
    });
  };

  const awardPointsToAll = async (amount) => {
    setAllocatingPoints(true);
    try {
      await eventAPI.awardPointsToAllGuests(eventId, amount);
      toast.success(`${amount} points awarded to all guests successfully!`);
      setPointsAmount('');
      setShowPointsForm(false);
      loadEvent(); // Reload to update points remaining
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to award points.';
      toast.error(errorMessage);
    } finally {
      setAllocatingPoints(false);
    }
  };

  const handleAwardPointsToAll = async () => {
    if (!pointsAmount || parseInt(pointsAmount) <= 0) {
      toast.error('Please enter a valid points amount');
      return;
    }

    const amount = parseInt(pointsAmount);
    const totalPoints = amount * (event.guests?.length || 0);
    
    setConfirmation({
      isOpen: true,
      title: 'Award Points to All',
      message: `Award ${amount} points to all ${event.guests?.length || 0} guests (${totalPoints} total points)?`,
      onConfirm: () => awardPointsToAll(amount),
      isDangerous: false
    });
  };

  if (loading) {
    return (
      <div className="event-detail-page">
        <div className="event-detail-loading">Loading event...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="event-detail-page">
        <div className="event-detail-loading">Loading event...</div>
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
              <strong>Points Remaining:</strong> {event.pointsRemain || 0}
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

          {(hasRole('manager') || isOrganizer()) && !isEventPast() && (
            <Link to={`/events/${eventId}/edit`} className="btn btn-primary">
              Edit Event
            </Link>
          )}
          {canDeleteEvent() && (
            <button
              onClick={handleDeleteEvent}
              className="btn btn-danger"
              disabled={actionLoading}
            >
              {actionLoading ? 'Deleting...' : 'Delete Event'}
            </button>
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
                  <li key={org.id} className="event-detail-list-item event-detail-list-item-with-action">
                    <span>{org.name} ({org.utorid})</span>
                    {canRemoveOrganizers() && (
                      <button
                        onClick={() => handleRemoveOrganizer(org.id)}
                        className="btn btn-danger event-detail-remove-btn"
                        disabled={actionLoading}
                      >
                        Remove
                      </button>
                    )}
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
                    <div className="form-group" style={{ position: 'relative' }}>
                      <input
                        ref={organizerInputRef}
                        type="text"
                        placeholder="Search users by name or UTORid..."
                        value={userSearch}
                        onChange={(e) => {
                          setUserSearch(e.target.value);
                          setShowOrganizerDropdown(true);
                          setSelectedUserId(null);
                        }}
                        onFocus={() => {
                          if (filteredOrganizerUsers.length > 0) {
                            setShowOrganizerDropdown(true);
                          }
                        }}
                        disabled={loadingUsers || addingOrganizer}
                        className="event-detail-searchable-input"
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
                          setSelectedUserId(null);
                          setUserSearch('');
                          setShowOrganizerDropdown(false);
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
                    <li key={guest.id} className="event-detail-list-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '12px' }}>
                        <span>{guest.name} ({guest.utorid})</span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {canAllocatePoints() && (
                            <>
                              {selectedGuestForPoints?.id === guest.id && showPointsForm ? (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <input
                                    type="number"
                                    min="1"
                                    placeholder="Points"
                                    value={pointsAmount}
                                    onChange={(e) => setPointsAmount(e.target.value)}
                                    style={{
                                      width: '80px',
                                      padding: '6px 8px',
                                      border: '1.5px solid rgba(147, 177, 181, 0.3)',
                                      borderRadius: '6px',
                                      fontSize: '14px'
                                    }}
                                    disabled={allocatingPoints}
                                  />
                                  <button
                                    onClick={() => handleAwardPoints(guest)}
                                    className="btn btn-primary"
                                    style={{ padding: '6px 12px', fontSize: '13px' }}
                                    disabled={allocatingPoints || !pointsAmount || parseInt(pointsAmount) <= 0}
                                  >
                                    {allocatingPoints ? '...' : 'Award'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedGuestForPoints(null);
                                      setShowPointsForm(false);
                                      setPointsAmount('');
                                    }}
                                    className="btn btn-secondary"
                                    style={{ padding: '6px 12px', fontSize: '13px' }}
                                    disabled={allocatingPoints}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setSelectedGuestForPoints(guest);
                                    setShowPointsForm(true);
                                    setPointsAmount('');
                                  }}
                                  className="btn btn-primary"
                                  style={{ padding: '6px 12px', fontSize: '13px' }}
                                  disabled={allocatingPoints || (showPointsForm && selectedGuestForPoints?.id !== guest.id)}
                                >
                                  Award Points
                                </button>
                              )}
                            </>
                          )}
                          {canRemoveGuests() && (
                            <button
                              onClick={() => handleRemoveGuest(guest.id)}
                              className="btn btn-danger event-detail-remove-btn"
                              style={{ padding: '6px 12px', fontSize: '13px' }}
                              disabled={actionLoading || showPointsForm}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ padding: '10px', color: '#666', fontStyle: 'italic' }}>
                  No guests yet
                </div>
              )}
              {canAllocatePoints() && event.guests && event.guests.length > 0 && !showPointsForm && (
                <div className="event-detail-add-organizer-section" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(147, 177, 181, 0.2)' }}>
                  <div style={{ marginBottom: '12px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    Award Points to All Guests
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="number"
                      min="1"
                      placeholder="Points per guest"
                      value={pointsAmount}
                      onChange={(e) => setPointsAmount(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: '1.5px solid rgba(147, 177, 181, 0.3)',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                      disabled={allocatingPoints}
                    />
                    <button
                      onClick={handleAwardPointsToAll}
                      className="btn btn-primary"
                      style={{ padding: '8px 16px', fontSize: '14px' }}
                      disabled={allocatingPoints || !pointsAmount || parseInt(pointsAmount) <= 0}
                    >
                      {allocatingPoints ? 'Awarding...' : `Award to All (${event.guests.length})`}
                    </button>
                  </div>
                  {event.pointsRemain !== undefined && (
                    <div style={{ marginTop: '8px', fontSize: '13px', color: '#666' }}>
                      Points remaining: {event.pointsRemain}
                    </div>
                  )}
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
                        <div className="form-group" style={{ position: 'relative' }}>
                          <input
                            ref={guestInputRef}
                            type="text"
                            placeholder="Search users by name or UTORid..."
                            value={guestUserSearch}
                            onChange={(e) => {
                              setGuestUserSearch(e.target.value);
                              setShowGuestDropdown(true);
                              setSelectedGuestUserId(null);
                            }}
                            onFocus={() => {
                              if (filteredGuestUsers.length > 0) {
                                setShowGuestDropdown(true);
                              }
                            }}
                            disabled={loadingGuestUsers || addingGuest}
                            className="event-detail-searchable-input"
                          />
                          {showGuestDropdown && filteredGuestUsers.length > 0 && (
                            <div 
                              ref={guestDropdownRef}
                              className="event-detail-searchable-dropdown"
                            >
                              {filteredGuestUsers.map((u) => (
                                <div
                                  key={u.id}
                                  className="event-detail-dropdown-item"
                                  onClick={() => handleGuestSelect(u)}
                                >
                                  {u.name} ({u.utorid})
                                </div>
                              ))}
                            </div>
                          )}
                          {showGuestDropdown && filteredGuestUsers.length === 0 && guestUserSearch.trim() && (
                            <div 
                              ref={guestDropdownRef}
                              className="event-detail-searchable-dropdown"
                            >
                              <div className="event-detail-dropdown-item event-detail-dropdown-empty">
                                No users found
                              </div>
                            </div>
                          )}
                          {loadingGuestUsers && (
                            <div className="event-detail-dropdown-loading">Loading users...</div>
                          )}
                        </div>
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
                            setSelectedGuestUserId(null);
                            setGuestUserSearch('');
                            setGuestUtorid('');
                            setShowGuestDropdown(false);
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
      
      <ConfirmationModal
        isOpen={confirmation.isOpen}
        onClose={() => setConfirmation({ ...confirmation, isOpen: false })}
        onConfirm={confirmation.onConfirm}
        title={confirmation.title}
        message={confirmation.message}
        isDangerous={confirmation.isDangerous}
      />
    </div>
  );
};

export default EventDetail;

