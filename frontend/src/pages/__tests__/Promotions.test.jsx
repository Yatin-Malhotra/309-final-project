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
    useAuth.mockReturnValue({ 
      hasRole: (role) => role === 'manager',
      currentRole: 'manager'
    });
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    
    const mockPromos = [
      { id: 1, name: 'Promo 1', description: 'Desc 1', startTime: futureDate.toISOString(), endTime: futureDate.toISOString() },
    ];
    promotionAPI.getPromotions.mockResolvedValue({ data: { results: mockPromos } });
    promotionAPI.deletePromotion.mockResolvedValue({});

    renderPromotions();

    await waitFor(() => {
      // Wait for promotion to load first
      expect(screen.getByText('Promo 1')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Wait for delete button - it should appear for promotions that haven't started
    await waitFor(() => {
      const deleteButtons = screen.queryAllByText('Delete');
      expect(deleteButtons.length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    // Click Delete button on the promotion card - this opens confirmation modal
    // Use getAllByText and click the first one (the card button, not the modal button)
    const deleteButtons = screen.getAllByText('Delete');
    const cardDeleteButton = deleteButtons[0]; // First one is the card button
    fireEvent.click(cardDeleteButton);

    // Wait for confirmation modal to appear
    await waitFor(() => {
      expect(screen.getByText(/delete promotion/i)).toBeInTheDocument();
    });

    // Now there will be multiple Delete buttons - the modal confirm button is the one in the modal
    // Find it by looking for the button that's a child of the modal
    await waitFor(() => {
      const modalDeleteButtons = screen.getAllByText('Delete');
      // The last one should be the modal confirm button
      expect(modalDeleteButtons.length).toBeGreaterThan(1);
    });

    // Get all Delete buttons again and click the one that's in the modal (usually the last one)
    const allDeleteButtons = screen.getAllByText('Delete');
    const modalConfirmButton = allDeleteButtons[allDeleteButtons.length - 1];
    fireEvent.click(modalConfirmButton);

    await waitFor(() => {
      expect(promotionAPI.deletePromotion).toHaveBeenCalledWith(1);
    });
  });
});

