import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Transactions from '../Transactions';
import { useAuth } from '../../contexts/AuthContext';
import { transactionAPI } from '../../services/api';

// Mock context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock API
vi.mock('../../services/api', () => ({
  transactionAPI: {
    getMyTransactions: vi.fn(),
    getTransactions: vi.fn(),
    getRedemptionTransactions: vi.fn(),
    processRedemption: vi.fn(),
    markSuspicious: vi.fn(),
  },
}));

// Mock child components
vi.mock('../../components/TransactionDetailPanel', () => ({
  default: () => <div data-testid="transaction-detail-panel">Panel</div>,
}));
vi.mock('../../components/TransactionModal', () => ({
  default: ({ isOpen }) => isOpen ? <div data-testid="transaction-modal">Modal</div> : null,
}));

describe('Transactions Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderTransactions = () => {
    return render(
      <MemoryRouter>
        <Transactions />
      </MemoryRouter>
    );
  };

  it('should render loading state', () => {
    useAuth.mockReturnValue({ user: { role: 'regular' }, hasRole: () => false });
    transactionAPI.getMyTransactions.mockImplementation(() => new Promise(() => {}));
    renderTransactions();
    expect(screen.getByText(/loading transactions/i)).toBeInTheDocument();
  });

  it('should render transactions list for regular user', async () => {
    useAuth.mockReturnValue({ user: { role: 'regular' }, hasRole: () => false });
    const mockTxs = [
      { id: 1, type: 'purchase', amount: 100, createdAt: new Date().toISOString(), processed: true },
    ];
    transactionAPI.getMyTransactions.mockResolvedValue({ data: { results: mockTxs, count: 1 } });

    renderTransactions();

    await waitFor(() => {
      expect(screen.getByText('purchase')).toBeInTheDocument();
      // We check for 100 in the table cell specifically or just check it exists
      // Since it might appear in dropdown options too, we can be more specific
      const cells = screen.getAllByText('100');
      expect(cells.length).toBeGreaterThan(0);
    });
  });

  it('should render redemption transactions for cashier', async () => {
    useAuth.mockReturnValue({ user: { role: 'cashier' }, hasRole: (role) => role === 'cashier' });
    const mockTxs = [
      { id: 1, type: 'redemption', amount: -50, redeemed: 50, createdAt: new Date().toISOString(), processed: false },
    ];
    transactionAPI.getRedemptionTransactions.mockResolvedValue({ data: { results: mockTxs, count: 1 } });

    renderTransactions();

    await waitFor(() => {
      expect(screen.getByText('Redemption Transactions')).toBeInTheDocument();
      const cells = screen.getAllByText('50');
      expect(cells.length).toBeGreaterThan(0);
    });
  });

  it('should render all transactions for manager', async () => {
    useAuth.mockReturnValue({ user: { role: 'manager' }, hasRole: (role) => role === 'manager' });
    const mockTxs = [
      { id: 1, type: 'purchase', amount: 100, createdAt: new Date().toISOString(), processed: true, user: { utorid: 'user1' } },
    ];
    transactionAPI.getTransactions.mockResolvedValue({ data: { results: mockTxs, count: 1 } });

    renderTransactions();

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/id or utorid/i)).toBeInTheDocument(); // Manager filter
      expect(screen.getByText('user1')).toBeInTheDocument();
    });
  });

  it('should handle filtering', async () => {
    useAuth.mockReturnValue({ user: { role: 'regular' }, hasRole: () => false });
    transactionAPI.getMyTransactions.mockResolvedValue({ data: { results: [], count: 0 } });

    renderTransactions();

    // Get the select by label text since getByRole('combobox') might be ambiguous if multiple selects exist
    const select = screen.getByLabelText(/type/i);
    fireEvent.change(select, { target: { value: 'purchase' } });

    await waitFor(() => {
      expect(transactionAPI.getMyTransactions).toHaveBeenCalledWith(expect.objectContaining({ type: 'purchase' }));
    });
  });

  it('should open create modal', async () => {
    useAuth.mockReturnValue({ user: { role: 'regular' }, hasRole: () => false });
    transactionAPI.getMyTransactions.mockResolvedValue({ data: { results: [], count: 0 } });

    renderTransactions();

    await waitFor(() => {
      expect(screen.getByText('Create Transaction')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Create Transaction'));

    expect(screen.getByTestId('transaction-modal')).toBeInTheDocument();
  });
});

