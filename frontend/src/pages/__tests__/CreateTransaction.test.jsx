import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CreateTransaction from '../CreateTransaction';
import { useAuth } from '../../contexts/AuthContext';

// Mock context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock child components
vi.mock('../../components/CashierCreateTx', () => ({
  default: () => <div data-testid="cashier-create">Cashier Create</div>,
}));
vi.mock('../../components/UserCreateTx', () => ({
  default: () => <div data-testid="user-create">User Create</div>,
}));

describe('CreateTransaction Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderCreateTransaction = () => {
    return render(
      <MemoryRouter>
        <CreateTransaction />
      </MemoryRouter>
    );
  };

  it('should render CashierCreateTx for cashier', () => {
    useAuth.mockReturnValue({ hasRole: (role) => role === 'cashier' });
    renderCreateTransaction();
    expect(screen.getByTestId('cashier-create')).toBeInTheDocument();
  });

  it('should render UserCreateTx for regular user', () => {
    useAuth.mockReturnValue({ hasRole: () => false });
    renderCreateTransaction();
    expect(screen.getByTestId('user-create')).toBeInTheDocument();
  });
});

