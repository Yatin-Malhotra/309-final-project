import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Users from '../Users';
import { useAuth } from '../../contexts/AuthContext';
import { userAPI } from '../../services/api';

// Mock context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock API
vi.mock('../../services/api', () => ({
  userAPI: {
    getUsers: vi.fn(),
  },
}));

describe('Users Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ hasRole: () => false });
  });

  const renderUsers = () => {
    return render(
      <MemoryRouter>
        <Users />
      </MemoryRouter>
    );
  };

  it('should render loading state', () => {
    userAPI.getUsers.mockImplementation(() => new Promise(() => {}));
    renderUsers();
    expect(screen.getByText(/loading users/i)).toBeInTheDocument();
  });

  it('should render users list', async () => {
    const mockUsers = [
      { id: 1, utorid: 'user1', name: 'User One', role: 'regular', verified: true, points: 100 },
    ];
    userAPI.getUsers.mockResolvedValue({ data: { results: mockUsers, count: 1 } });

    renderUsers();

    await waitFor(() => {
      expect(screen.getByText('user1')).toBeInTheDocument();
      expect(screen.getByText('User One')).toBeInTheDocument();
    });
  });

  it('should show create button for cashier', async () => {
    useAuth.mockReturnValue({ hasRole: (role) => role === 'cashier' });
    userAPI.getUsers.mockResolvedValue({ data: { results: [], count: 0 } });

    renderUsers();

    await waitFor(() => {
      expect(screen.getByText(/create user/i)).toBeInTheDocument();
    });
  });

  it('should handle filtering', async () => {
    userAPI.getUsers.mockResolvedValue({ data: { results: [], count: 0 } });
    renderUsers();

    const input = screen.getByPlaceholderText(/name or utorid/i);
    fireEvent.change(input, { target: { value: 'search' } });

    await waitFor(() => {
      expect(userAPI.getUsers).toHaveBeenCalledWith(expect.objectContaining({ name: 'search' }));
    });
  });
});

