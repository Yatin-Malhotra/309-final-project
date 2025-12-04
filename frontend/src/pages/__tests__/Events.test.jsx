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
    useAuth.mockReturnValue({ 
      user: { role: 'manager' }, 
      hasRole: (role) => role === 'manager',
      currentRole: 'manager'
    });
    const mockEvents = [
        { id: 1, name: 'Event 1', startTime: '2023-12-25T10:00:00', endTime: '2023-12-25T12:00:00', location: 'Room 1', published: false },
    ];
    eventAPI.getEvents.mockResolvedValue({ data: { results: mockEvents, count: 1 } });
    eventAPI.deleteEvent.mockResolvedValue({});

    renderEvents();

    await waitFor(() => {
        // Wait for event to load first
        expect(screen.getByText('Event 1')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Wait for delete button - it should appear for unpublished events
    await waitFor(() => {
        const deleteButtons = screen.queryAllByText('Delete');
        expect(deleteButtons.length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    // Click Delete button on the event card - this opens confirmation modal
    // Use getAllByText and click the first one (the card button, not the modal button)
    const deleteButtons = screen.getAllByText('Delete');
    const cardDeleteButton = deleteButtons[0]; // First one is the card button
    fireEvent.click(cardDeleteButton);

    // Wait for confirmation modal to appear
    await waitFor(() => {
      expect(screen.getByText(/delete event/i)).toBeInTheDocument();
    });

    // Now there will be multiple Delete buttons - the modal confirm button is the one in the modal
    // Find it by looking for the button that's a child of the modal
    await waitFor(() => {
      const modalDeleteButtons = screen.getAllByText('Delete');
      // The last one should be the modal confirm button, or we can find it by its parent
      expect(modalDeleteButtons.length).toBeGreaterThan(1);
    });

    // Get all Delete buttons again and click the one that's in the modal (usually the last one)
    const allDeleteButtons = screen.getAllByText('Delete');
    const modalConfirmButton = allDeleteButtons[allDeleteButtons.length - 1];
    fireEvent.click(modalConfirmButton);

    await waitFor(() => {
        expect(eventAPI.deleteEvent).toHaveBeenCalledWith(1);
    });
  });
});

