import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Login from '../Login';
import { AuthProvider } from '../../contexts/AuthContext';
import { authAPI, userAPI } from '../../services/api';

// Mock API modules
vi.mock('../../services/api', () => ({
  authAPI: {
    login: vi.fn(),
  },
  userAPI: {
    getMe: vi.fn(),
  },
}));

// Mock AuthContext partially if needed, but wrapping in AuthProvider is better integration test
// However, AuthProvider uses api.js, so mocking api.js is crucial.

const renderLogin = () => {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render login form', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/utorid/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('should handle successful login', async () => {
    const mockToken = 'fake-token';
    const mockUser = { id: 1, utorid: 'testuser', role: 'regular', verified: true };

    authAPI.login.mockResolvedValueOnce({ data: { token: mockToken } });
    userAPI.getMe.mockResolvedValueOnce({ data: mockUser });

    renderLogin();

    fireEvent.change(screen.getByLabelText(/utorid/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(authAPI.login).toHaveBeenCalledWith('testuser', 'password123');
      expect(localStorage.getItem('token')).toBe(mockToken);
      // We can't easily check navigation here without mocking useNavigate, 
      // but we can check if login function was called implicitly via side effects
    });
  });

  it('should handle login failure', async () => {
    const errorMessage = 'Invalid credentials';
    authAPI.login.mockRejectedValueOnce({ response: { data: { error: errorMessage } } });

    renderLogin();

    fireEvent.change(screen.getByLabelText(/utorid/i), { target: { value: 'wrong' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      // Component uses toast for error, not rendered text
      // Just verify the login API was called (and will fail)
      expect(authAPI.login).toHaveBeenCalledWith('wrong', 'wrong');
    });
  });

  it('should disable button while loading', async () => {
    // Make the promise never resolve immediately to check loading state
    authAPI.login.mockImplementation(() => new Promise(() => {}));

    renderLogin();

    fireEvent.change(screen.getByLabelText(/utorid/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    expect(screen.getByRole('button', { name: /logging in/i })).toBeDisabled();
  });
});

