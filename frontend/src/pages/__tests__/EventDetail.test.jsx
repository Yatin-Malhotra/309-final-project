import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import EventDetail from '../EventDetail';
import { useAuth } from '../../contexts/AuthContext';
import { eventAPI, userAPI } from '../../services/api';

// Mock context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock API
vi.mock('../../services/api', () => ({
  eventAPI: {
    getEvent: vi.fn(),
    registerForEvent: vi.fn(),
    unregisterFromEvent: vi.fn(),
    addOrganizer: vi.fn(),
    removeOrganizer: vi.fn(),
    addGuest: vi.fn(),
    removeGuest: vi.fn(),
  },
  userAPI: {
    getUsers: vi.fn(),
  },
}));

describe('EventDetail Page', () => {
  const mockEvent = {
    id: 1,
    name: 'Test Event',
    description: 'Description',
    location: 'Test Venue',
    startTime: '2099-12-25T10:00:00',
    endTime: '2099-12-25T12:00:00',
    capacity: 100,
    guests: [],
    organizers: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 1, role: 'regular' }, hasRole: () => false });
  });

  const renderEventDetail = (eventId = '1') => {
    return render(
      <MemoryRouter initialEntries={[`/events/${eventId}`]}>
        <Routes>
          <Route path="/events/:eventId" element={<EventDetail />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('should render event details', async () => {
    eventAPI.getEvent.mockResolvedValue({ data: mockEvent });
    renderEventDetail();

    await waitFor(() => {
      expect(screen.getByText('Test Event')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText(/Test Venue/)).toBeInTheDocument();
    });
  });

  it('should show register button for regular user', async () => {
    eventAPI.getEvent.mockResolvedValue({ data: mockEvent });
    renderEventDetail();

    await waitFor(() => {
      expect(screen.getByText('Test Event')).toBeInTheDocument();
    });
    
    await waitFor(() => {
      // The button might be disabled or text might vary slightly
      const btn = screen.getByRole('button', { name: /register/i });
      expect(btn).toBeInTheDocument();
    });
  });

  it('should handle registration', async () => {
    eventAPI.getEvent.mockResolvedValue({ data: mockEvent });
    eventAPI.registerForEvent.mockResolvedValue({});

    renderEventDetail();

    await waitFor(() => {
      expect(screen.getByText('Register')).toBeInTheDocument();
    });

    // Click Register button - this opens confirmation modal
    fireEvent.click(screen.getByText('Register'));

    // Wait for confirmation modal and click Confirm
    await waitFor(() => {
      expect(screen.getByText('Register for Event')).toBeInTheDocument();
    });

    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(eventAPI.registerForEvent).toHaveBeenCalledWith('1');
    });
  });

  it('should show unregister button if already registered', async () => {
    const registeredEvent = { 
        ...mockEvent, 
        guests: [{ id: 1, name: 'Me', utorid: 'me' }],
        isRegistered: true 
    };
    
    eventAPI.getEvent.mockResolvedValue({ data: registeredEvent });
    renderEventDetail();

    await waitFor(() => {
      // Use getByText
      expect(screen.getByText('Unregister')).toBeInTheDocument();
    });
  });

  it('should show manager controls', async () => {
    useAuth.mockReturnValue({ user: { id: 2, role: 'manager' }, hasRole: (role) => role === 'manager' });
    eventAPI.getEvent.mockResolvedValue({ data: mockEvent });
    renderEventDetail();

    await waitFor(() => {
      expect(screen.getByText('Edit Event')).toBeInTheDocument();
      expect(screen.getByText('Delete Event')).toBeInTheDocument();
      expect(screen.getByText('Add Organizer')).toBeInTheDocument();
    });
  });

  it('should allow adding organizer for manager', async () => {
    useAuth.mockReturnValue({ user: { id: 2, role: 'manager' }, hasRole: (role) => role === 'manager' });
    eventAPI.getEvent.mockResolvedValue({ data: mockEvent });
    userAPI.getUsers.mockResolvedValue({ data: { results: [{ id: 3, name: 'New Org', utorid: 'neworg' }] } });
    eventAPI.addOrganizer.mockResolvedValue({});

    renderEventDetail();

    await waitFor(() => {
        const addBtns = screen.getAllByText('Add Organizer');
        expect(addBtns.length).toBeGreaterThan(0);
    });

    const addBtn = screen.getAllByText('Add Organizer')[0];
    fireEvent.click(addBtn);

    await waitFor(() => {
        const input = screen.getByPlaceholderText(/search users/i);
        expect(input).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/search users/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'New' } });

    await waitFor(() => {
        expect(screen.getByText(/New Org/)).toBeInTheDocument();
    }, { timeout: 3000 });

    fireEvent.click(screen.getByText(/New Org/));
    
    // Get the form submit button (the one that's not disabled and is in the form)
    await waitFor(() => {
      const buttons = screen.getAllByText('Add Organizer');
      // The last button should be the form submit button
      const formButton = buttons[buttons.length - 1];
      expect(formButton).toBeInTheDocument();
      expect(formButton).not.toBeDisabled();
    });

    const buttons = screen.getAllByText('Add Organizer');
    fireEvent.click(buttons[buttons.length - 1]);

    // Wait for confirmation modal - find it by the message text which is unique
    await waitFor(() => {
      expect(screen.getByText(/Add.*New Org.*neworg.*as an organizer/i)).toBeInTheDocument();
    });

    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);

    await waitFor(() => {
        expect(eventAPI.addOrganizer).toHaveBeenCalledWith('1', 'neworg');
    }, { timeout: 3000 });
  });
});
