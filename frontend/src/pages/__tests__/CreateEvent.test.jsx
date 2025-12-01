import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CreateEvent from '../CreateEvent';
import { useAuth } from '../../contexts/AuthContext';
import { eventAPI, userAPI } from '../../services/api';

// Mock context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock API
vi.mock('../../services/api', () => ({
  eventAPI: {
    createEvent: vi.fn(),
    getEvent: vi.fn(),
    updateEvent: vi.fn(),
  },
  userAPI: {
    getUsers: vi.fn(),
  },
}));

describe('CreateEvent Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { role: 'manager' }, hasRole: (role) => role === 'manager' });
  });

  const renderCreateEvent = (eventId = null) => {
    const path = eventId ? `/events/${eventId}/edit` : '/events/create';
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
            <Route path="/events/create" element={<CreateEvent />} />
            <Route path="/events/:eventId/edit" element={<CreateEvent />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('should render create form', () => {
    renderCreateEvent();
    expect(screen.getByLabelText(/event name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByText('Create Event', { selector: 'button' })).toBeInTheDocument();
  });

  it('should handle form submission for creating event', async () => {
    eventAPI.createEvent.mockResolvedValue({});
    renderCreateEvent();

    fireEvent.change(screen.getByLabelText(/event name/i), { target: { value: 'New Event' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Desc' } });
    fireEvent.change(screen.getByLabelText(/location/i), { target: { value: 'Loc' } });
    fireEvent.change(screen.getByLabelText(/start time/i), { target: { value: '2023-12-25T10:00' } });
    fireEvent.change(screen.getByLabelText(/end time/i), { target: { value: '2023-12-25T12:00' } });
    fireEvent.change(screen.getByLabelText(/points/i), { target: { value: '10' } });

    fireEvent.click(screen.getByText('Create Event', { selector: 'button' }));

    await waitFor(() => {
      expect(eventAPI.createEvent).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Event',
        description: 'Desc',
        points: 10
      }));
    });
  });

  it('should load existing event data for edit mode', async () => {
    const mockEvent = {
      id: 1,
      name: 'Existing Event',
      description: 'Desc',
      location: 'Loc',
      startTime: '2023-12-25T10:00:00.000Z',
      endTime: '2023-12-25T12:00:00.000Z',
      capacity: 100,
      pointsAllocated: 50,
      published: true
    };
    eventAPI.getEvent.mockResolvedValue({ data: mockEvent });

    renderCreateEvent('1');

    await waitFor(() => {
      expect(screen.getByDisplayValue('Existing Event')).toBeInTheDocument();
    });
  });
});

