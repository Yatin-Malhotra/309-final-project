import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CreateUser from '../CreateUser';
import { userAPI } from '../../services/api';

// Mock API
vi.mock('../../services/api', () => ({
  userAPI: {
    createUser: vi.fn(),
  },
}));

describe('CreateUser Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderCreateUser = () => {
    return render(
      <MemoryRouter>
        <CreateUser />
      </MemoryRouter>
    );
  };

  it('should render form', () => {
    renderCreateUser();
    expect(screen.getByLabelText(/utorid/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('should handle submission', async () => {
    userAPI.createUser.mockResolvedValue({ data: { resetToken: 'token123' } });
    renderCreateUser();

    fireEvent.change(screen.getByLabelText(/utorid/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@utoronto.ca' } });

    fireEvent.click(screen.getByText('Create User', { selector: 'button' }));

    await waitFor(() => {
      expect(userAPI.createUser).toHaveBeenCalledWith({
        utorid: 'testuser',
        name: 'Test User',
        email: 'test@utoronto.ca'
      });
      expect(screen.getByText(/user created successfully/i)).toBeInTheDocument();
    });
  });

  it('should handle error', async () => {
    userAPI.createUser.mockRejectedValue({ response: { data: { error: 'Failed' } } });
    renderCreateUser();

    fireEvent.change(screen.getByLabelText(/utorid/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@utoronto.ca' } });

    fireEvent.click(screen.getByText('Create User', { selector: 'button' }));

    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });
  });
});

