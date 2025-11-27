// Event detail page
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { eventAPI } from '../services/api';

const EventDetail = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadEvent();
  }, [eventId]);

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

  if (loading) {
    return <div className="loading">Loading event...</div>;
  }

  if (error || !event) {
    return (
      <div className="container">
        <div className="error-message">{error || 'Event not found'}</div>
        <Link to="/events" className="btn btn-secondary">
          Back to Events
        </Link>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ marginBottom: '20px' }}>
        <Link to="/events" className="btn btn-secondary">
          ← Back to Events
        </Link>
      </div>

      <div className="card">
        <div className="card-header">{event.name}</div>
        <div style={{ marginBottom: '15px' }}>
          <p><strong>Description:</strong></p>
          <p>{event.description}</p>
        </div>
        <div style={{ marginBottom: '15px' }}>
          <p><strong>Location:</strong> {event.location}</p>
          <p><strong>Start Time:</strong> {new Date(event.startTime).toLocaleString()}</p>
          <p><strong>End Time:</strong> {new Date(event.endTime).toLocaleString()}</p>
          {event.capacity && <p><strong>Capacity:</strong> {event.capacity}</p>}
        </div>

        {hasRole('manager') && (
          <div style={{ marginBottom: '15px' }}>
            <p><strong>Points Remaining:</strong> {event.pointsRemain}</p>
            <p><strong>Points Awarded:</strong> {event.pointsAwarded || 0}</p>
            <p><strong>Published:</strong> {event.published ? 'Yes' : 'No'}</p>
          </div>
        )}

        {user && !isOrganizer() && !isEventPast() && (
          <div style={{ marginTop: '20px' }}>
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
          </div>
        )}

        {hasRole('manager') && (
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
            <Link to={`/events/${eventId}/edit`} className="btn btn-primary">
              Edit Event
            </Link>
          </div>
        )}
      </div>

      {event.organizers && event.organizers.length > 0 && (
        <div className="card">
          <div className="card-header">Organizers</div>
          <ul>
            {event.organizers.map((org) => (
              <li key={org.id}>{org.name} ({org.utorid})</li>
            ))}
          </ul>
        </div>
      )}

      {event.guests && event.guests.length > 0 && (
        <div className="card">
          <div className="card-header">Guests ({event.guests.length})</div>
          <ul>
            {event.guests.map((guest) => (
              <li key={guest.id}>{guest.name} ({guest.utorid})</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default EventDetail;

