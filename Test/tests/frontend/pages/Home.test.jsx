import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import Home from '@/pages/Home';
import { renderWithProviders } from '../helpers/render';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';

// Mock the navigate function
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Home Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      profile: null,
      ready: true,
      profileLoading: false,
      profileError: null,
      authLoading: false,
      error: null,
    });
  });

  it('1. Renders logo and login form correctly', () => {
    renderWithProviders(<Home />);
    expect(screen.getByText(/padel/i)).toBeInTheDocument();
    // Use getAllByText for 'zero' since it appears in logo and footer
    expect(screen.getAllByText(/zero/i)[0]).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/correo@ejemplo.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/tu contraseña/i)).toBeInTheDocument();
  });

  it('2. Shows warning if email or password are empty', async () => {
    const showToast = vi.fn();
    useUiStore.setState({ showToast });
    renderWithProviders(<Home />);
    
    // The button name depends on translation, let's use a regex that matches both Log In and Entrar
    fireEvent.click(screen.getByRole('button', { name: /(log in|entrar)/i }));
    
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({
      type: 'warning'
    }));
  });

  it('3. Shows warning for invalid email format', async () => {
    const showToast = vi.fn();
    useUiStore.setState({ showToast });
    const { container } = renderWithProviders(<Home />);
    
    fireEvent.change(screen.getByPlaceholderText(/correo@ejemplo.com/i), { target: { value: 'invalid-email' } });
    fireEvent.change(screen.getByPlaceholderText(/tu contraseña/i), { target: { value: 'password123' } });
    
    // Submit the form directly to bypass HTML5 validation
    fireEvent.submit(container.querySelector('form'));
    
    await waitFor(() => {
      expect(showToast).toHaveBeenCalled();
    });
    
    expect(showToast).toHaveBeenCalledWith(expect.objectContaining({
      type: 'warning'
    }));
  });

  it('4. Toggles between login and registration mode', () => {
    renderWithProviders(<Home />);
    
    // Toggle button text also depends on translation
    const toggleBtn = screen.getByText(/(regístrate|sign up)/i);
    fireEvent.click(toggleBtn);
    
    expect(screen.getByRole('button', { name: /(crear cuenta|create account)/i })).toBeInTheDocument();
  });

  it('5. Calls signInWithEmail on form submission', async () => {
    const signInWithEmail = vi.fn().mockResolvedValue({ error: null });
    useAuthStore.setState({ signInWithEmail });
    renderWithProviders(<Home />);
    
    fireEvent.change(screen.getByPlaceholderText(/correo@ejemplo.com/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText(/tu contraseña/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /(log in|entrar)/i }));
    
    expect(signInWithEmail).toHaveBeenCalledWith('test@example.com', 'password123');
  });

  it('6. Calls signInWithGoogle when Google button is clicked', async () => {
    const signInWithGoogle = vi.fn().mockResolvedValue({ error: null });
    useAuthStore.setState({ signInWithGoogle });
    renderWithProviders(<Home />);
    
    fireEvent.click(screen.getByRole('button', { name: /google/i }));
    
    expect(signInWithGoogle).toHaveBeenCalled();
  });

  it('7. Redirects to /onboarding if user is logged in but profile is incomplete', async () => {
    useAuthStore.setState({
      user: { id: '123' },
      profile: { id: '123', display_name: '' },
      ready: true
    });
    
    renderWithProviders(<Home />);
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding', { replace: true });
    });
  });

  it('8. Redirects to /play if user is logged in and profile is complete', async () => {
    useAuthStore.setState({
      user: { id: '123' },
      profile: { id: '123', display_name: 'Test Player' },
      ready: true
    });
    
    renderWithProviders(<Home />);
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/play', { replace: true });
    });
  });

  it('9. Shows loading state when profile is loading', () => {
    useAuthStore.setState({
      user: { id: '123' },
      profileLoading: true,
      ready: true
    });
    
    renderWithProviders(<Home />);
    expect(screen.getByText(/cargando tu perfil/i)).toBeInTheDocument();
  });

  it('10. Shows error state when profile load fails', () => {
    useAuthStore.setState({
      user: { id: '123' },
      profileError: 'FAILED',
      profile: null,
      ready: true
    });
    
    renderWithProviders(<Home />);
    expect(screen.getByText(/no se pudo cargar tu perfil/i)).toBeInTheDocument();
  });
});
