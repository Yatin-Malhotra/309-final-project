// Events management page
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { eventAPI } from '../services/api';
import { Link, useSearchParams } from 'react-router-dom';

const Events = () => {
  const { user, hasRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    name: searchParams.get('name') || '',
    published: searchParams.get('published') || '',
    page: parseInt(searchParams.get('page')) || 1,
    limit: parseInt(searchParams.get('limit')) || 10,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadEvents();
  }, [filters]);

  const loadEvents = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { ...filters };
      Object.keys(params).forEach((key) => {
        if (!params[key]) delete params[key];
      });

      const response = await eventAPI.getEvents(params);
      setEvents(response.data.results || []);
      setCount(response.data.count || 0);
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

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Events</h1>
        {hasRole('manager') && (
          <Link to="/events/create" className="btn btn-primary">
            Create Event
          </Link>
        )}
      </div>

      {(
        <div className="filters">
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={filters.name}
              onChange={(e) => handleFilterChange('name', e.target.value)}
              placeholder="Search by name..."
            />
          </div>
          {hasRole('manager') && (<div className="form-group">
            <label>Published</label>
            <select
              value={filters.published}
              onChange={(e) => handleFilterChange('published', e.target.value)}
            >
              <option value="">All</option>
              <option value="true">Published</option>
              <option value="false">Unpublished</option>
            </select>
          </div>)}
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
      )}

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="empty-state">No events found</div>
      ) : (
        <>
          <div style={{ display: 'grid', gap: '20px' }}>
            {events.map((event) => (
              <div key={event.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ marginBottom: '10px' }}>{event.name}</h3>
                    <p style={{ color: '#666', marginBottom: '10px' }}>
                      {formatDate(event.startTime)} - {formatDate(event.endTime)}
                    </p>
                    <p style={{ color: '#666' }}>Location: {event.location}</p>
                    {hasRole('manager') && (
                      <div style={{ marginTop: '10px' }}>
                        <span className="badge badge-secondary">
                          {event.numGuests} / {event.capacity || '∞'} guests
                        </span>
                        <span className="badge badge-primary" style={{ marginLeft: '10px' }}>
                          {event.pointsRemain} points remaining
                        </span>
                        {!event.published && (
                          <span className="badge badge-warning" style={{ marginLeft: '10px' }}>
                            Unpublished
                          </span>
                        )}
                      </div>
                    )}
                    {!hasRole('manager') && (
                      <div style={{ marginTop: '10px' }}>
                        <span className="badge badge-secondary">
                          {event.numGuests} / {event.capacity || '∞'} guests
                        </span>
                        {isEventFull(event) && (
                          <span className="badge badge-danger" style={{ marginLeft: '10px' }}>
                            Full
                          </span>
                        )}
                        {isEventPast(event) && (
                          <span className="badge badge-secondary" style={{ marginLeft: '10px' }}>
                            Past
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <Link
                      to={`/events/${event.id}`}
                      className="btn btn-primary"
                      style={{ padding: '8px 16px' }}
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pagination">
            <button
              onClick={() => handleFilterChange('page', filters.page - 1)}
              disabled={filters.page <= 1}
            >
              Previous
            </button>
            <span>
              Page {filters.page} of {Math.ceil(count / filters.limit)}
            </span>
            <button
              onClick={() => handleFilterChange('page', filters.page + 1)}
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

