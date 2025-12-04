import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import UserDetail from '../UserDetail';
import { useAuth } from '../../contexts/AuthContext';
import { userAPI } from '../../services/api';

// Mock context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock API
vi.mock('../../services/api', () => ({
  userAPI: {
    getUser: vi.fn(),
    updateUser: vi.fn(),
    getUserTransactions: vi.fn(),
  },
  getAvatarUrl: vi.fn((url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `http://localhost:5000${url}`;
  }),
}));

describe('UserDetail Page', () => {
  const mockUser = {
    id: 1,
    utorid: 'user1',
    name: 'User One',
    email: 'user1@utoronto.ca',
    role: 'regular',
    verified: false,
    suspicious: false,
    points: 100,
    promotions: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ hasRole: () => false });
  });

  const renderUserDetail = (userId = '1') => {
    return render(
      <MemoryRouter initialEntries={[`/users/${userId}`]}>
        <Routes>
          <Route path="/users/:userId" element={<UserDetail />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('should render user details', async () => {
    userAPI.getUser.mockResolvedValue({ data: mockUser });
    renderUserDetail();

    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument();
      expect(screen.getByText('user1')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument(); // points
    });
  });

  it('should show manager controls for verification', async () => {
    // Manager but not superuser, viewing a regular user - should show checkboxes
    useAuth.mockReturnValue({ hasRole: (role) => role === 'manager' });
    userAPI.getUser.mockResolvedValue({ data: mockUser });
    userAPI.getUserTransactions.mockResolvedValue({ data: { results: [] } });
    userAPI.updateUser.mockResolvedValue({ data: { ...mockUser, verified: true } });

    renderUserDetail();

    await waitFor(() => {
      // Wait for user data to load first
      expect(screen.getByText('User One')).toBeInTheDocument();
    });

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });
    
    // Toggle verification (first checkbox is the verified checkbox)
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    
    // Wait for confirmation modal to appear and click confirm
    await waitFor(() => {
      expect(screen.getByText('Verify User')).toBeInTheDocument();
    });
    
    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(userAPI.updateUser).toHaveBeenCalledWith('1', expect.objectContaining({ verified: true }));
    });
  });

  it('should load transactions for manager', async () => {
    useAuth.mockReturnValue({ hasRole: (role) => role === 'manager' });
    userAPI.getUser.mockResolvedValue({ data: mockUser });
    const mockTxs = [
      { id: 1, type: 'purchase', amount: 50, createdAt: new Date().toISOString() }
    ];
    userAPI.getUserTransactions.mockResolvedValue({ data: { results: mockTxs, count: 1 } });

    renderUserDetail();

    // Wait for user to load first
    await waitFor(() => {
      expect(screen.getByText('User One')).toBeInTheDocument();
    });

    // Then wait for transactions section
    await waitFor(() => {
      expect(screen.getByText('User Transactions')).toBeInTheDocument();
      expect(screen.getByText('purchase')).toBeInTheDocument();
    });
  });
});

