import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Events from '../Events';
import { useAuth } from '../../contexts/AuthContext';
import { eventAPI } from '../../services/api';

// Mock context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock API
vi.mock('../../services/api', () => ({
  eventAPI: {
    getEvents: vi.fn(),
    deleteEvent: vi.fn(),
  },
}));

describe('Events Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { role: 'regular' }, hasRole: () => false });
  });

  const renderEvents = () => {
    return render(
      <MemoryRouter>
        <Events />
      </MemoryRouter>
    );
  };

  it('should render loading state initially', () => {
    eventAPI.getEvents.mockImplementation(() => new Promise(() => {}));
    renderEvents();
    expect(screen.getByText(/loading events/i)).toBeInTheDocument();
  });

  it('should render events list', async () => {
    const mockEvents = [
      { id: 1, name: 'Event 1', startTime: '2023-12-25T10:00:00', endTime: '2023-12-25T12:00:00', location: 'Room 1' },
      { id: 2, name: 'Event 2', startTime: '2023-12-26T10:00:00', endTime: '2023-12-26T12:00:00', location: 'Room 2' },
    ];
    eventAPI.getEvents.mockResolvedValue({ data: { results: mockEvents, count: 2 } });

    renderEvents();

    await waitFor(() => {
      expect(screen.getByText('Event 1')).toBeInTheDocument();
      expect(screen.getByText('Event 2')).toBeInTheDocument();
    });
  });

  it('should render empty state', async () => {
    eventAPI.getEvents.mockResolvedValue({ data: { results: [], count: 0 } });
    renderEvents();

    await waitFor(() => {
      expect(screen.getByText(/no events found/i)).toBeInTheDocument();
    });
  });

  it('should handle filtering by name', async () => {
    eventAPI.getEvents.mockResolvedValue({ data: { results: [], count: 0 } });
    renderEvents();

    const input = screen.getByPlaceholderText(/search by name/i);
    fireEvent.change(input, { target: { value: 'Test' } });

    await waitFor(() => {
      // Expect getEvents to be called with name filter (debouncing might be involved in real app, but here implementation seems direct)
      expect(eventAPI.getEvents).toHaveBeenCalledWith(expect.objectContaining({ name: 'Test' }));
    });
  });

  it('should show create button for manager', async () => {
    useAuth.mockReturnValue({ user: { role: 'manager' }, hasRole: (role) => role === 'manager' });
    eventAPI.getEvents.mockResolvedValue({ data: { results: [], count: 0 } });
    
    renderEvents();

    await waitFor(() => {
      expect(screen.getByText(/create event/i)).toBeInTheDocument();
    });
  });

  it('should handle delete event for manager', async () => {
    useAuth.mockReturnValue({ user: { role: 'manager' }, hasRole: (role) => role === 'manager' });
    const mockEvents = [
        { id: 1, name: 'Event 1', startTime: '2023-12-25T10:00:00', endTime: '2023-12-25T12:00:00', location: 'Room 1', published: false },
    ];
    eventAPI.getEvents.mockResolvedValue({ data: { results: mockEvents, count: 1 } });
    eventAPI.deleteEvent.mockResolvedValue({});
    // Mock window.confirm
    window.confirm = vi.fn(() => true);

    renderEvents();

    await waitFor(() => {
        expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
        expect(eventAPI.deleteEvent).toHaveBeenCalledWith(1);
    });
  });
});

