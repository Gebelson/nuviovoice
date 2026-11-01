import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { PrivacyPanel } from './PrivacyPanel';
import { useAuthStore } from '../../../stores/authStore';
import { useUIStore } from '../../../stores/uiStore';
import { api } from '../../../api/client';
import i18n from '../../../i18n';

afterEach(cleanup);

vi.mock('../../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      users: {
        ...actual.api.users,
        update: vi.fn(),
      },
    },
  };
});

describe('PrivacyPanel', () => {
  const addToastMock = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('pt');
    useAuthStore.setState({
      user: {
        id: 'u-1',
        username: 'testuser',
        friendDiscoveryVisibility: 'everyone',
        receiveWinks: true,
      } as any,
    });
    useUIStore.setState({ addToast: addToastMock });
  });

  it('renders discovery and winks privacy sections', () => {
    render(<PrivacyPanel />);

    expect(screen.getByText('Descoberta de pessoas')).toBeInTheDocument();
    expect(screen.getByText('Quem pode me encontrar em Adicionar amigos?')).toBeInTheDocument();
    expect(screen.getByText('Todos')).toBeInTheDocument();
    expect(screen.getByText('Amigos de amigos')).toBeInTheDocument();
    expect(screen.getByText('Ninguém')).toBeInTheDocument();

    expect(screen.getByText('Winks')).toBeInTheDocument();
    expect(screen.getByText('Receber Winks')).toBeInTheDocument();
  });

  it('updates discovery visibility to mutual_friends and shows success toast', async () => {
    vi.mocked(api.users.update).mockResolvedValueOnce({
      id: 'u-1',
      username: 'testuser',
      friendDiscoveryVisibility: 'mutual_friends',
      receiveWinks: true,
    } as any);

    render(<PrivacyPanel />);

    const mutualBtn = screen.getByRole('radio', { name: /Amigos de amigos/i });
    fireEvent.click(mutualBtn);

    await waitFor(() => {
      expect(api.users.update).toHaveBeenCalledWith({ friendDiscoveryVisibility: 'mutual_friends' });
    });

    expect(addToastMock).toHaveBeenCalledWith('Preferências de privacidade atualizadas.', 'success');
  });

  it('toggles receiveWinks and shows success toast', async () => {
    vi.mocked(api.users.update).mockResolvedValueOnce({
      id: 'u-1',
      username: 'testuser',
      friendDiscoveryVisibility: 'everyone',
      receiveWinks: false,
    } as any);

    render(<PrivacyPanel />);

    // Winks toggle switch
    const winksToggle = screen.getByRole('switch', { name: /Receber Winks/i });
    fireEvent.click(winksToggle);

    await waitFor(() => {
      expect(api.users.update).toHaveBeenCalledWith({ receiveWinks: false });
    });

    expect(addToastMock).toHaveBeenCalledWith('Preferências de privacidade atualizadas.', 'success');
  });

  it('reverts state and shows error toast when API update fails', async () => {
    vi.mocked(api.users.update).mockRejectedValueOnce(new Error('Network error'));

    render(<PrivacyPanel />);

    const nobodyBtn = screen.getByRole('radio', { name: /Ninguém/i });
    fireEvent.click(nobodyBtn);

    await waitFor(() => {
      expect(api.users.update).toHaveBeenCalledWith({ friendDiscoveryVisibility: 'nobody' });
    });

    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalledWith('Não foi possível salvar suas preferências. Tente novamente.', 'warning');
    });

    // Option should revert to everyone
    const everyoneBtn = screen.getByRole('radio', { name: /Todos/i });
    expect(everyoneBtn).toHaveAttribute('aria-checked', 'true');
  });
});
