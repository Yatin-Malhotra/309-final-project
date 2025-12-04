import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CreatePromotion from '../CreatePromotion';
import { promotionAPI } from '../../services/api';

// Mock API
vi.mock('../../services/api', () => ({
  promotionAPI: {
    createPromotion: vi.fn(),
    getPromotion: vi.fn(),
    updatePromotion: vi.fn(),
    deletePromotion: vi.fn(),
  },
}));

describe('CreatePromotion Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderCreatePromotion = (promotionId = null) => {
    const path = promotionId ? `/promotions/${promotionId}/edit` : '/promotions/create';
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/promotions/create" element={<CreatePromotion />} />
          <Route path="/promotions/:promotionId/edit" element={<CreatePromotion />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('should render create form', () => {
    renderCreatePromotion();
    expect(screen.getByLabelText(/promotion name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
    expect(screen.getByText('Create Promotion', { selector: 'button' })).toBeInTheDocument();
  });

  it('should validate form inputs', async () => {
    renderCreatePromotion();

    fireEvent.change(screen.getByLabelText(/promotion name/i), { target: { value: 'New Promo' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Desc' } });
    fireEvent.change(screen.getByLabelText(/start time/i), { target: { value: '2023-12-25T10:00' } });
    fireEvent.change(screen.getByLabelText(/end time/i), { target: { value: '2023-12-25T12:00' } });
    
    // Submit without reward config
    fireEvent.click(screen.getByText('Create Promotion', { selector: 'button' }));

    // Component uses toast for error message, not rendered text
    // Just verify the API was not called (validation prevents submission)
    await waitFor(() => {
      expect(promotionAPI.createPromotion).not.toHaveBeenCalled();
    });
  });

  it('should handle successful submission', async () => {
    promotionAPI.createPromotion.mockResolvedValue({});
    renderCreatePromotion();

    fireEvent.change(screen.getByLabelText(/promotion name/i), { target: { value: 'New Promo' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Desc' } });
    fireEvent.change(screen.getByLabelText(/start time/i), { target: { value: '2023-12-25T10:00' } });
    fireEvent.change(screen.getByLabelText(/end time/i), { target: { value: '2023-12-25T12:00' } });
    fireEvent.change(screen.getByLabelText(/fixed points/i), { target: { value: '100' } });

    fireEvent.click(screen.getByText('Create Promotion', { selector: 'button' }));

    await waitFor(() => {
      expect(promotionAPI.createPromotion).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Promo',
        points: 100
      }));
    });
  });

  it('should load existing promotion for edit', async () => {
    const mockPromo = {
      id: 1,
      name: 'Existing Promo',
      description: 'Desc',
      type: 'automatic',
      startTime: '2023-12-25T10:00:00.000Z',
      endTime: '2023-12-25T12:00:00.000Z',
      points: 50
    };
    promotionAPI.getPromotion.mockResolvedValue({ data: mockPromo });

    renderCreatePromotion('1');

    await waitFor(() => {
      expect(screen.getByDisplayValue('Existing Promo')).toBeInTheDocument();
    });
  });
});

