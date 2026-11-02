import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VerificationBadge } from './VerificationBadge';

describe('VerificationBadge', () => {
  it('renders nothing if status is not verified or category is null', () => {
    const { container: c1 } = render(<VerificationBadge category={null} status="verified" />);
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(<VerificationBadge category="personal" status="pending" />);
    expect(c2.firstChild).toBeNull();

    const { container: c3 } = render(<VerificationBadge category="personal" status="rejected" />);
    expect(c3.firstChild).toBeNull();
  });

  it('renders personal verified badge with sky color and accessible title', () => {
    render(<VerificationBadge category="personal" status="verified" />);
    const badge = screen.getByTestId('verification-badge-personal');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('aria-label', 'Conta verificada');
    expect(badge.className).toContain('text-sky-400');
  });

  it('renders creator verified badge', () => {
    render(<VerificationBadge category="creator" status="verified" />);
    const badge = screen.getByTestId('verification-badge-creator');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('aria-label', 'Criador de conteúdo verificado');
    expect(badge.className).toContain('text-sky-400');
  });

  it('renders organization verified badge with emerald color', () => {
    render(<VerificationBadge category="organization" status="verified" />);
    const badge = screen.getByTestId('verification-badge-organization');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('aria-label', 'Organização verificada');
    expect(badge.className).toContain('text-emerald-400');
  });

  it('renders official team badge with purple shield icon', () => {
    render(<VerificationBadge category="official" status="verified" />);
    const badge = screen.getByTestId('verification-badge-official');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('aria-label', 'Equipe oficial Nuvio');
    expect(badge.className).toContain('text-purple-400');
  });

  it('renders public space badge with sky color', () => {
    render(<VerificationBadge category="space" status="verified" />);
    const badge = screen.getByTestId('verification-badge-space');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('aria-label', 'Espaço verificado');
    expect(badge.className).toContain('text-sky-400');
  });

  it('displays tooltip popover on hover with title, description, and legal disclaimer', () => {
    render(<VerificationBadge category="personal" status="verified" />);
    const badge = screen.getByTestId('verification-badge-personal');

    fireEvent.mouseEnter(badge);

    expect(screen.getAllByText('Conta verificada').length).toBeGreaterThan(0);
    expect(screen.getByText(/A autenticidade desta conta foi confirmada pelo Nuvio/i)).toBeInTheDocument();
    expect(screen.getByText(/A verificação comprova identidade e controle legítimo da conta/i)).toBeInTheDocument();

    fireEvent.mouseLeave(badge);
    expect(screen.queryByText(/A autenticidade desta conta foi confirmada pelo Nuvio/i)).not.toBeInTheDocument();
  });
});
