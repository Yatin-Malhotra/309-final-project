// Events management page
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { eventAPI } from '../services/api';
import { Link, useSearchParams } from 'react-router-dom';
import './Events.css';

const Events = () => {
  const { user, hasRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    name: searchParams.get('name') || '',
    published: searchParams.get('published') || '',
    registeredUserName: searchParams.get('registeredUserName') || '',
    registeredUserLimitMin: searchParams.get('registeredUserLimitMin') || '',
    registeredUserLimitMax: searchParams.get('registeredUserLimitMax') || '',
    isFull: searchParams.get('isFull') || '',
    registered: searchParams.get('registered') || '',
    page: parseInt(searchParams.get('page')) || 1,
    limit: parseInt(searchParams.get('limit')) || 10,
  });
  const [error, setError] = useState('');
  const [showMyEvents, setShowMyEvents] = useState(false);

  useEffect(() => {
    loadEvents();
  }, [filters, showMyEvents]);

  // Apply client-side filtering and pagination when showMyEvents filter is active
  useEffect(() => {
    if (showMyEvents && allEvents.length > 0) {
      const filtered = allEvents.filter(e => e.isOrganizer === true);
      setCount(filtered.length);
      const startIndex = (filters.page - 1) * filters.limit;
      const endIndex = startIndex + filters.limit;
      setEvents(filtered.slice(startIndex, endIndex));
    }
  }, [showMyEvents, allEvents, filters.page, filters.limit]);

  const loadEvents = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { ...filters };
      Object.keys(params).forEach((key) => {
        if (!params[key]) delete params[key];
      });

      // If filtering by "My Events", we need to fetch more results for client-side filtering
      const fetchParams = { ...params };
      if (showMyEvents) {
        // Remove page parameter and increase limit to get more results for client-side filtering
        delete fetchParams.page;
        fetchParams.limit = 100; // Maximum allowed by backend
      }

      const response = await eventAPI.getEvents(fetchParams);
      const fetchedEvents = response.data.results || [];
      setAllEvents(fetchedEvents);
      
      // Store all fetched events - filtering will be applied in useEffect if needed
      if (!showMyEvents) {
        setEvents(fetchedEvents);
        setCount(response.data.count || 0);
      }
      // If showMyEvents is active, the useEffect will handle filtering and pagination
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load events.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    // Only reset to page 1 if changing a non-page filter
    if (key !== 'page') {
      newFilters.page = 1;
    }
    setFilters(newFilters);
    setSearchParams(newFilters);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString();
  };

  const isEventFull = (event) => {
    return event.capacity && event.numGuests >= event.capacity;
  };

  const isEventPast = (event) => {
    return new Date(event.endTime) < new Date();
  };

  const hasAnyOrganizedEvents = () => {
    return events.some(event => event.isOrganizer === true) || allEvents.some(event => event.isOrganizer === true);
  };

  const canShowMyEventsButton = () => {
    // Always show for managers and superusers
    if (hasRole('manager') || hasRole('superuser')) {
      return true;
    }
    // For others, show if they have any organized events
    return hasAnyOrganizedEvents();
  };

  return (
    <div className="events-page">
      <div className="events-page-header">
        <h1>Events</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
          {hasRole('manager') && (
            <Link to="/events/create" className="btn btn-primary events-create-btn">
              Create Event
            </Link>
          )}
          {canShowMyEventsButton() && (
            <button
              type="button"
              onClick={() => {
                setShowMyEvents(!showMyEvents);
                // Reset to page 1 when toggling filter
                const newFilters = { ...filters, page: 1 };
                setFilters(newFilters);
                setSearchParams(newFilters);
              }}
              className={showMyEvents ? "btn btn-secondary" : "btn btn-outline-secondary"}
              title={showMyEvents ? "Clear filter and show all events" : "Show only events I organize"}
            >
              My Events
            </button>
          )}
        </div>
      </div>

      <div className="events-filters">
        <div className="form-group">
          <label>Name</label>
          <input
            type="text"
            value={filters.name}
            onChange={(e) => handleFilterChange('name', e.target.value)}
            placeholder="Search by name..."
          />
        </div>
        {hasRole('manager') && (
          <div className="form-group">
            <label>Published</label>
            <select
              value={filters.published}
              onChange={(e) => handleFilterChange('published', e.target.value)}
            >
              <option value="">All</option>
              <option value="true">Published</option>
              <option value="false">Unpublished</option>
            </select>
          </div>
        )}
        {!hasRole('manager') && (
          <div className="form-group">
            <label>Registered</label>
            <select
              value={filters.registered}
              onChange={(e) => handleFilterChange('registered', e.target.value)}
            >
              <option value="">All Events</option>
              <option value="true">My Registered Events</option>
              <option value="false">Not Registered</option>
            </select>
          </div>
        )}
        {hasRole('manager') && (
          <div className="form-group">
            <label>Event Full Status</label>
            <select
              value={filters.isFull}
              onChange={(e) => handleFilterChange('isFull', e.target.value)}
            >
              <option value="">All</option>
              <option value="true">Full</option>
              <option value="false">Not Full</option>
            </select>
          </div>
        )}
        <div className="form-group">
          <label>Limit</label>
          <select
            value={filters.limit}
            onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
        </div>
      </div>

      {error && <div className="events-error-message">{error}</div>}

      {loading ? (
        <div className="events-loading">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="events-empty-state">No events found</div>
      ) : (
        <>
          <div className="events-grid">
            {events.map((event) => (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="events-card events-card-link"
              >
                <div className="events-card-content">
                  <div className="events-card-main">
                    <h3 className="events-card-title">{event.name}</h3>
                    <p className="events-card-meta">
                      {formatDate(event.startTime)} - {formatDate(event.endTime)}
                    </p>
                    <p className="events-card-location">Location: {event.location}</p>
                    <div className="events-card-badges">
                      {hasRole('manager') && (
                        <>
                          <span className="events-badge events-badge-secondary">
                            {event.numGuests} / {event.capacity || '∞'} guests
                          </span>
                          <span className="events-badge events-badge-primary">
                            {event.pointsRemain} points remaining
                          </span>
                          {event.isRegistered && (
                            <span className="events-badge events-badge-success">
                              Registered
                            </span>
                          )}
                          {event.isOrganizer && (
                            <span className="events-badge events-badge-blue">
                              Event Organizer
                            </span>
                          )}
                          {!event.published && (
                            <span className="events-badge events-badge-warning">
                              Unpublished
                            </span>
                          )}
                        </>
                      )}
                      {!hasRole('manager') && (
                        <>
                          <span className="events-badge events-badge-secondary">
                            {event.numGuests} / {event.capacity || '∞'} guests
                          </span>
                          {event.isRegistered && (
                            <span className="events-badge events-badge-success">
                              Registered
                            </span>
                          )}
                          {event.isOrganizer && (
                            <span className="events-badge events-badge-blue">
                              Event Organizer
                            </span>
                          )}
                          {isEventFull(event) && (
                            <span className="events-badge events-badge-danger">
                              Full
                            </span>
                          )}
                          {isEventPast(event) && (
                            <span className="events-badge events-badge-secondary">
                              Past
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="events-pagination">
            <button
              onClick={() => {
                if (showMyEvents) {
                  // Client-side pagination
                  const newPage = filters.page - 1;
                  const startIndex = (newPage - 1) * filters.limit;
                  const endIndex = startIndex + filters.limit;
                  const filtered = allEvents.filter(e => e.isOrganizer === true);
                  setEvents(filtered.slice(startIndex, endIndex));
                  handleFilterChange('page', newPage);
                } else {
                  handleFilterChange('page', filters.page - 1);
                }
              }}
              disabled={filters.page <= 1}
            >
              Previous
            </button>
            <span>
              Page {filters.page} of {Math.ceil(count / filters.limit)}
            </span>
            <button
              onClick={() => {
                if (showMyEvents) {
                  // Client-side pagination
                  const newPage = filters.page + 1;
                  const startIndex = (newPage - 1) * filters.limit;
                  const endIndex = startIndex + filters.limit;
                  const filtered = allEvents.filter(e => e.isOrganizer === true);
                  setEvents(filtered.slice(startIndex, endIndex));
                  handleFilterChange('page', newPage);
                } else {
                  handleFilterChange('page', filters.page + 1);
                }
              }}
              disabled={filters.page >= Math.ceil(count / filters.limit)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Events;

