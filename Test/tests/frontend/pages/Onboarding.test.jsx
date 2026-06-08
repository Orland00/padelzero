import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import Onboarding from '@/pages/Onboarding';
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

describe('Onboarding Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: { id: '123', user_metadata: { full_name: 'Test User' } },
      profile: { id: '123' },
      authLoading: false,
    });
  });

  it('1. Renders correctly with initial values', () => {
    renderWithProviders(<Onboarding />);
    expect(screen.getByText(/crea tu perfil/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/test user/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/@tuusuario/i)).toBeInTheDocument();
  });

  it('2. Shows validation errors for required fields', async () => {
    renderWithProviders(<Onboarding />);
    
    // Clear initial display name
    fireEvent.change(screen.getByPlaceholderText(/tu nombre/i), { target: { value: '' } });
    
    // Enable button by checking privacy
    fireEvent.click(screen.getByRole('checkbox'));
    
    fireEvent.click(screen.getByText(/empezar a jugar/i));
    
    await waitFor(() => {
      expect(screen.getByText(/ingresa tu nombre/i)).toBeInTheDocument();
      expect(screen.getByText(/ingresa un @usuario/i)).toBeInTheDocument();
      expect(screen.getByText(/ingresa tu ciudad/i)).toBeInTheDocument();
    });
  });

  it('3. Successfully updates profile and redirects to /play', async () => {
    const updateProfile = vi.fn().mockResolvedValue({ error: null });
    useAuthStore.setState({ updateProfile });
    renderWithProviders(<Onboarding />);
    
    fireEvent.change(screen.getByPlaceholderText(/tu nombre/i), { target: { value: 'Real Name' } });
    fireEvent.change(screen.getByPlaceholderText(/@tuusuario/i), { target: { value: '@realuser' } });
    // Country and City are selects
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'México' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'Cancún' } });
    
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText(/empezar a jugar/i));
    
    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({
        display_name: 'Real Name',
        username: 'realuser',
        city: 'Cancún',
        country: 'México'
      }));
    });
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/play', { replace: true });
    }, { timeout: 2000 });
  });

  it('4. Handles duplicate username error', async () => {
    const updateProfile = vi.fn().mockResolvedValue({ error: { message: 'duplicate key value violates unique constraint "profiles_username_key"' } });
    useAuthStore.setState({ updateProfile });
    renderWithProviders(<Onboarding />);
    
    fireEvent.change(screen.getByPlaceholderText(/tu nombre/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByPlaceholderText(/@tuusuario/i), { target: { value: '@taken' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'Cancún' } });
    
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText(/empezar a jugar/i));
    
    await waitFor(() => {
      expect(screen.getByText(/este @usuario ya está tomado/i)).toBeInTheDocument();
    });
  });
});
