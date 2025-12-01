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
    useAuth.mockReturnValue({ hasRole: (role) => role === 'manager' });
    userAPI.getUser.mockResolvedValue({ data: mockUser });
    userAPI.getUserTransactions.mockResolvedValue({ data: { results: [] } });
    userAPI.updateUser.mockResolvedValue({ data: { ...mockUser, verified: true } });
    window.confirm = vi.fn(() => true);

    renderUserDetail();

    await waitFor(() => {
      expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
    });
    
    // Toggle verification (first checkbox usually)
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); 

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

    await waitFor(() => {
      expect(screen.getByText('User Transactions')).toBeInTheDocument();
      expect(screen.getByText('purchase')).toBeInTheDocument();
    });
  });
});

