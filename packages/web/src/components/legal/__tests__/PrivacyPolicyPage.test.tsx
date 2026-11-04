import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PrivacyPolicyPage } from '../PrivacyPolicyPage';

describe('PrivacyPolicyPage', () => {
  function renderPage() {
    return render(
      <MemoryRouter>
        <PrivacyPolicyPage />
      </MemoryRouter>,
    );
  }

  it('renders official document title and heading', () => {
    renderPage();
    const headings = screen.getAllByRole('heading', { name: /Política de Privacidade/i });
    expect(headings.length).toBeGreaterThan(0);
    expect(screen.getByText(/Documento Jurídico Oficial • LGPD/i)).toBeInTheDocument();
  });

  it('displays the official controller and DPO contact information', () => {
    renderPage();
    expect(screen.getAllByText(/Gabriel Cerqueira do Nascimento/i).length).toBeGreaterThan(0);
    const emails = screen.getAllByRole('link', { name: /Gbrielcerqueira@gmail\.com/i });
    expect(emails.length).toBeGreaterThan(0);
    expect(emails[0]).toHaveAttribute('href', 'mailto:Gbrielcerqueira@gmail.com');
  });

  it('explicitly states the 15-year minimum age policy and protection of adolescents', () => {
    renderPage();
    expect(screen.getAllByText(/15 anos/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /Proteção de Crianças e Adolescentes/i })).toBeInTheDocument();
  });

  it('displays the last updated date', () => {
    renderPage();
    expect(screen.getByText(/03 de novembro de 2026/i)).toBeInTheDocument();
  });

  it('renders all key sections for LGPD compliance and real data treatment', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /Identificação do Responsável \(Controlador\)/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Princípios e Compromisso de Privacidade/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Dados Pessoais Coletados/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Finalidades e Bases Legais \(LGPD\)/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Mensagens, Arquivos e Mídias/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Comunicações de Voz e Vídeo em Tempo Real/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Armazenamento e Prazos de Retenção/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Cookies e Armazenamento Local/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Compartilhamento com Fornecedores/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Integrações Externas e Bots/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Segurança da Informação e Criptografia/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Direitos dos Titulares de Dados \(LGPD\)/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Procedimentos para Solicitação e Exclusão de Dados/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Transferências Internacionais e Contato \(DPO\)/i })).toBeInTheDocument();
  });

  it('guarantees that voice and video calls are not recorded or transcribed by default', () => {
    renderPage();
    expect(screen.getByText(/Garantia de Não Gravação de Voz e Vídeo/i)).toBeInTheDocument();
    expect(screen.getAllByText(/O Nuvio não grava, não armazena e não transcreve conversas de voz/i).length).toBeGreaterThan(0);
  });

  it('provides navigation links to Download, Login and Register', () => {
    renderPage();
    expect(screen.getAllByRole('link', { name: /Baixar Nuvio/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Entrar/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Criar Conta/i }).length).toBeGreaterThan(0);
  });
});
