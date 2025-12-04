import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';
import { useAuth } from '../../contexts/AuthContext';
import { transactionAPI, eventAPI, promotionAPI, userAPI, analyticsAPI } from '../../services/api';

// Mock context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock react-toastify
vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock API
vi.mock('../../services/api', () => ({
  transactionAPI: {
    getMyTransactions: vi.fn(),
    getRedemptionTransactions: vi.fn(),
    getTransactions: vi.fn(),
  },
  eventAPI: {
    getEvents: vi.fn(),
  },
  promotionAPI: {
    getPromotions: vi.fn(),
  },
  userAPI: {
    getUsers: vi.fn(),
  },
  analyticsAPI: {
    getCashierStats: vi.fn(),
    getOverview: vi.fn(),
    getUserAnalytics: vi.fn(),
    getTransactionAnalytics: vi.fn(),
    getEventAnalytics: vi.fn(),
    getPromotionAnalytics: vi.fn(),
    getFinancialAnalytics: vi.fn(),
  },
}));

// Mock child components that might cause issues or aren't focus of this test
vi.mock('../../components/SimpleChart', () => ({
  default: () => <div data-testid="simple-chart">Chart</div>,
}));
vi.mock('../../components/AnimatedNumber', () => ({
  default: ({ value }) => <span>{value}</span>,
}));
// Mock SortableTable to avoid complex rendering in dashboard test
vi.mock('../../components/SortableTable', () => ({
  default: ({ data }) => (
    <div data-testid="sortable-table">
      {data.map((item, i) => <div key={i}>Item</div>)}
    </div>
  ),
}));

describe('Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderDashboard = () => {
    return render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
  };

  it('should render loading state initially', () => {
    useAuth.mockReturnValue({ 
      user: { role: 'regular' }, 
      currentRole: 'regular',
      hasRole: () => false,
      updateLocalUser: vi.fn()
    });
    renderDashboard();
    // It starts with loading = true
    expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument();
  });

  it('should render regular user dashboard', async () => {
    useAuth.mockReturnValue({ 
      user: { name: 'Test User', role: 'regular', points: 500, verified: true }, 
      currentRole: 'regular',
      hasRole: () => false,
      updateLocalUser: vi.fn()
    });

    transactionAPI.getMyTransactions.mockResolvedValue({ data: { results: [] } });
    eventAPI.getEvents.mockResolvedValue({ data: { results: [] } });
    promotionAPI.getPromotions.mockResolvedValue({ data: { results: [] } });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/welcome, test user/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(screen.getByText(/your points balance/i)).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument(); // AnimatedNumber mock renders value
    expect(screen.getByText(/scan qr code/i)).toBeInTheDocument();
  });

  it('should render cashier dashboard', async () => {
    useAuth.mockReturnValue({ 
      user: { name: 'Cashier User', role: 'cashier' }, 
      currentRole: 'cashier',
      hasRole: () => true,
      updateLocalUser: vi.fn()
    });

    transactionAPI.getMyTransactions.mockResolvedValue({ data: { results: [] } });
    transactionAPI.getRedemptionTransactions.mockResolvedValue({ data: { count: 5 } });
    analyticsAPI.getCashierStats.mockResolvedValue({ data: { dailyVolume: [] } });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/welcome, cashier user/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Cashier specific elements
    // Use getAllByText because "Pending Redemptions" appears in title and description
    expect(screen.getAllByText(/pending redemptions/i)[0]).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // Pending count
    expect(screen.getByText(/create transaction/i)).toBeInTheDocument();
  });

  it('should render manager dashboard', async () => {
    useAuth.mockReturnValue({ 
      user: { name: 'Manager User', role: 'manager' }, 
      currentRole: 'manager',
      hasRole: () => true,
      updateLocalUser: vi.fn()
    });

    eventAPI.getEvents.mockResolvedValue({ data: { results: [], count: 10 } });
    promotionAPI.getPromotions.mockResolvedValue({ data: { results: [] } });
    userAPI.getUsers.mockResolvedValue({ data: { count: 50 } });
    transactionAPI.getTransactions.mockResolvedValue({ data: { count: 100 } });
    
    // Mock all analytics calls
    analyticsAPI.getOverview.mockResolvedValue({ data: {} });
    analyticsAPI.getUserAnalytics.mockResolvedValue({ data: {} });
    analyticsAPI.getTransactionAnalytics.mockResolvedValue({ data: {} });
    analyticsAPI.getEventAnalytics.mockResolvedValue({ data: {} });
    analyticsAPI.getPromotionAnalytics.mockResolvedValue({ data: {} });
    analyticsAPI.getFinancialAnalytics.mockResolvedValue({ data: {} });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/welcome, manager user/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Manager specific elements
    expect(screen.getByText(/total users/i)).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText(/total events/i)).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });
});

