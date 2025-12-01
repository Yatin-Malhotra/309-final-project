import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Promotions from '../Promotions';
import { useAuth } from '../../contexts/AuthContext';
import { promotionAPI } from '../../services/api';

// Mock context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock API
vi.mock('../../services/api', () => ({
  promotionAPI: {
    getPromotions: vi.fn(),
    deletePromotion: vi.fn(),
  },
}));

describe('Promotions Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ hasRole: () => false });
  });

  const renderPromotions = () => {
    return render(
      <MemoryRouter>
        <Promotions />
      </MemoryRouter>
    );
  };

  it('should render loading state', () => {
    promotionAPI.getPromotions.mockImplementation(() => new Promise(() => {}));
    renderPromotions();
    expect(screen.getByText(/loading promotions/i)).toBeInTheDocument();
  });

  it('should render promotions list', async () => {
    const mockPromos = [
      { id: 1, name: 'Promo 1', description: 'Desc 1', type: 'automatic', startTime: new Date().toISOString(), endTime: new Date(Date.now() + 86400000).toISOString() },
    ];
    promotionAPI.getPromotions.mockResolvedValue({ data: { results: mockPromos } });

    renderPromotions();

    await waitFor(() => {
      expect(screen.getByText('Promo 1')).toBeInTheDocument();
      expect(screen.getByText('Desc 1')).toBeInTheDocument();
    });
  });

  it('should show create button for manager', async () => {
    useAuth.mockReturnValue({ hasRole: (role) => role === 'manager' });
    promotionAPI.getPromotions.mockResolvedValue({ data: { results: [] } });

    renderPromotions();

    await waitFor(() => {
      expect(screen.getByText(/create promotion/i)).toBeInTheDocument();
    });
  });

  it('should handle delete promotion for manager', async () => {
    useAuth.mockReturnValue({ hasRole: (role) => role === 'manager' });
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    
    const mockPromos = [
      { id: 1, name: 'Promo 1', description: 'Desc 1', startTime: futureDate.toISOString(), endTime: futureDate.toISOString() },
    ];
    promotionAPI.getPromotions.mockResolvedValue({ data: { results: mockPromos } });
    promotionAPI.deletePromotion.mockResolvedValue({});
    window.confirm = vi.fn(() => true);

    renderPromotions();

    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(promotionAPI.deletePromotion).toHaveBeenCalledWith(1);
    });
  });
});

