import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface PolicySection {
  id: string;
  title: string;
  number: string;
}

const SECTIONS: PolicySection[] = [
  { id: 'controlador', number: '1', title: 'Identificação do Responsável (Controlador)' },
  { id: 'principios', number: '2', title: 'Princípios e Compromisso de Privacidade' },
  { id: 'dados-coletados', number: '3', title: 'Dados Pessoais Coletados' },
  { id: 'finalidades-bases', number: '4', title: 'Finalidades e Bases Legais (LGPD)' },
  { id: 'mensagens-arquivos', number: '5', title: 'Mensagens, Arquivos e Mídias' },
  { id: 'voz-video', number: '6', title: 'Comunicações de Voz e Vídeo em Tempo Real' },
  { id: 'armazenamento-retencao', number: '7', title: 'Armazenamento e Prazos de Retenção' },
  { id: 'cookies-localstorage', number: '8', title: 'Cookies e Armazenamento Local' },
  { id: 'compartilhamento', number: '9', title: 'Compartilhamento com Fornecedores' },
  { id: 'bots-integracoes', number: '10', title: 'Integrações Externas e Bots' },
  { id: 'seguranca-criptografia', number: '11', title: 'Segurança da Informação e Criptografia' },
  { id: 'direitos-titular', number: '12', title: 'Direitos dos Titulares de Dados (LGPD)' },
  { id: 'solicitacao-exclusao', number: '13', title: 'Solicitação e Exclusão de Dados' },
  { id: 'protecao-adolescentes', number: '14', title: 'Proteção de Crianças e Adolescentes (15 anos)' },
  { id: 'transferencias-contato', number: '15', title: 'Transferências Internacionais e Contato (DPO)' },
];

export function PrivacyPolicyPage() {
  const [activeSection, setActiveSection] = useState<string>('controlador');
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    // Scroll to top on initial page load
    window.scrollTo(0, 0);

    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);

      const sectionElements = SECTIONS.map((sec) => document.getElementById(sec.id));
      const scrollPosition = window.scrollY + 200;

      for (let i = sectionElements.length - 1; i >= 0; i--) {
        const el = sectionElements[i];
        if (el && el.offsetTop <= scrollPosition) {
          setActiveSection(SECTIONS[i]?.id ?? 'controlador');
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const topOffset = 80;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - topOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
      setActiveSection(id);
    }
  };

  return (
    <div className="min-h-screen bg-surface-base text-txt-primary flex flex-col font-sans selection:bg-accent-primary/30 selection:text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-surface-base/85 backdrop-blur-md border-b border-white/[0.08] transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary rounded-lg p-1">
            <img
              src="/icons/nuvio_logo.svg"
              alt="Nuvio"
              className="w-8 h-8 drop-shadow-[0_0_12px_rgba(124,121,255,0.4)] transition-transform group-hover:scale-105"
            />
            <span className="font-bold text-lg tracking-tight text-white group-hover:text-accent-primary transition-colors">
              Nuvio
            </span>
          </Link>

          <nav className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
            <Link
              to="/download"
              className="text-txt-secondary hover:text-white transition-colors px-2.5 py-1.5 rounded-md hover:bg-white/[0.04]"
            >
              Baixar Nuvio
            </Link>
            <Link
              to="/login"
              className="text-txt-secondary hover:text-white transition-colors px-2.5 py-1.5 rounded-md hover:bg-white/[0.04]"
            >
              Entrar
            </Link>
            <Link
              to="/register"
              className="bg-accent-primary hover:bg-accent-primary/85 text-white font-medium px-3.5 py-1.5 rounded-md transition-all shadow-sm active:scale-95"
            >
              Criar Conta
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Header */}
      <section className="relative overflow-hidden pt-12 pb-10 sm:pt-16 sm:pb-14 border-b border-white/[0.06] bg-gradient-to-b from-accent-primary/[0.07] via-surface-base to-surface-base">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-accent-primary/15 text-accent-primary border border-accent-primary/30">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Documento Jurídico Oficial • LGPD (Lei nº 13.709/2018)</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
              Política de Privacidade
            </h1>

            <p className="text-base sm:text-lg text-txt-secondary leading-relaxed">
              Transparência, proteção de dados e respeito à sua privacidade na plataforma Nuvio. Saiba exatamente como tratamos, protegemos e garantimos seus direitos.
            </p>

            {/* Official Metadata Grid */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-surface-elevated/60 border border-white/[0.05]">
                <span className="text-txt-tertiary block">Controlador:</span>
                <span className="font-semibold text-txt-primary mt-0.5 block">Gabriel Cerqueira do Nascimento</span>
              </div>
              <div className="p-3 rounded-lg bg-surface-elevated/60 border border-white/[0.05]">
                <span className="text-txt-tertiary block">Canal / Encarregado:</span>
                <a href="mailto:Gbrielcerqueira@gmail.com" className="font-semibold text-accent-primary hover:underline mt-0.5 block truncate">
                  Gbrielcerqueira@gmail.com
                </a>
              </div>
              <div className="p-3 rounded-lg bg-surface-elevated/60 border border-white/[0.05]">
                <span className="text-txt-tertiary block">Idade Mínima:</span>
                <span className="font-semibold text-txt-primary mt-0.5 block">15 anos completos</span>
              </div>
              <div className="p-3 rounded-lg bg-surface-elevated/60 border border-white/[0.05]">
                <span className="text-txt-tertiary block">Última Atualização:</span>
                <span className="font-semibold text-txt-primary mt-0.5 block">03 de novembro de 2026</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area: Sidebar Navigation + Policy Text */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Desktop Sticky Table of Contents */}
          <aside className="hidden lg:block lg:col-span-4 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-thin p-1">
            <div className="rounded-xl bg-surface-elevated/40 border border-white/[0.06] p-4 space-y-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-txt-tertiary px-3 py-2">
                Índice de Seções
              </h2>
              {SECTIONS.map((sec) => {
                const isActive = activeSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => scrollToSection(sec.id)}
                    className={`w-full text-left text-xs px-3 py-2 rounded-md transition-colors flex items-start gap-2.5 ${
                      isActive
                        ? 'bg-accent-primary/15 text-accent-primary font-semibold'
                        : 'text-txt-secondary hover:text-txt-primary hover:bg-white/[0.03]'
                    }`}
                  >
                    <span className="text-txt-tertiary font-mono shrink-0 w-4">{sec.number}.</span>
                    <span className="line-clamp-2 leading-relaxed">{sec.title}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick Contact Card */}
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-accent-primary/[0.08] to-transparent border border-accent-primary/20 text-xs space-y-2">
              <span className="font-semibold text-white block">Dúvidas sobre Privacidade?</span>
              <p className="text-txt-secondary leading-relaxed">
                Entre em contato direto com o nosso Encarregado pelo e-mail:
              </p>
              <a
                href="mailto:Gbrielcerqueira@gmail.com"
                className="inline-block text-accent-primary hover:underline font-medium break-all"
              >
                Gbrielcerqueira@gmail.com
              </a>
            </div>
          </aside>

          {/* Policy Document Body */}
          <div className="lg:col-span-8 space-y-8 leading-relaxed text-sm text-txt-secondary">
            {/* Highlights Box */}
            <div className="p-5 sm:p-6 rounded-xl bg-surface-elevated/50 border border-white/[0.06] space-y-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-accent-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Compromissos Fundamentais do Nuvio
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-txt-secondary pt-1">
                <div className="flex items-start gap-2 p-2.5 rounded bg-surface-base/50">
                  <span className="text-accent-mint font-bold">✔</span>
                  <span><strong>Não vendemos seus dados:</strong> Jamais comercializamos informações para anunciantes ou corretores.</span>
                </div>
                <div className="flex items-start gap-2 p-2.5 rounded bg-surface-base/50">
                  <span className="text-accent-mint font-bold">✔</span>
                  <span><strong>Comunicação criptografada:</strong> Tráfego protegido por TLS 1.3 e voz/vídeo por DTLS-SRTP.</span>
                </div>
                <div className="flex items-start gap-2 p-2.5 rounded bg-surface-base/50">
                  <span className="text-accent-mint font-bold">✔</span>
                  <span><strong>Sem gravação oculta:</strong> O Nuvio não grava nem monitora áudio e vídeo de chamadas.</span>
                </div>
                <div className="flex items-start gap-2 p-2.5 rounded bg-surface-base/50">
                  <span className="text-accent-mint font-bold">✔</span>
                  <span><strong>Controle e portabilidade:</strong> Exportação e exclusão facilitadas em conformidade com a LGPD.</span>
                </div>
              </div>
            </div>

            {/* Section 1 */}
            <section id="controlador" className="scroll-mt-24 p-6 sm:p-8 rounded-xl bg-surface-elevated/40 border border-white/[0.06] space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-md bg-accent-primary/20 text-accent-primary flex items-center justify-center font-bold text-sm shrink-0">1</span>
                <h2 className="text-lg sm:text-xl font-bold text-white">Identificação do Responsável (Controlador)</h2>
              </div>
              <p>
                Esta Política de Privacidade estabelece os termos em que a plataforma <strong>Nuvio</strong> coleta, utiliza, armazena, protege e descarta dados pessoais de seus usuários, em estrita conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018), com o Marco Civil da Internet (Lei nº 12.965/2014) e com as demais normas aplicáveis.
              </p>
              <div className="p-4 rounded-lg bg-surface-base/60 border border-white/[0.04] space-y-2 text-xs">
                <div><strong className="text-txt-primary">Plataforma:</strong> Nuvio (Web, Desktop Windows e interfaces autorizadas)</div>
                <div><strong className="text-txt-primary">Controlador e Responsável Legal:</strong> Gabriel Cerqueira do Nascimento</div>
                <div><strong className="text-txt-primary">Canal de Privacidade e Encarregado (DPO):</strong> <a href="mailto:Gbrielcerqueira@gmail.com" className="text-accent-primary hover:underline">Gbrielcerqueira@gmail.com</a></div>
                <div><strong className="text-txt-primary">Domínio Oficial da Aplicação:</strong> <a href="https://nuviovoice.vercel.app" target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline">https://nuviovoice.vercel.app</a></div>
              </div>
            </section>

            {/* Section 2 */}
            <section id="principios" className="scroll-mt-24 p-6 sm:p-8 rounded-xl bg-surface-elevated/40 border border-white/[0.06] space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-md bg-accent-primary/20 text-accent-primary flex items-center justify-center font-bold text-sm shrink-0">2</span>
                <h2 className="text-lg sm:text-xl font-bold text-white">Princípios e Compromisso de Privacidade</h2>
              </div>
              <p>
                O Nuvio foi concebido sob a premissa de <em>Privacy by Design</em> e <em>Privacy by Default</em> (Privacidade desde a Concepção e por Padrão). Orientamos nossas operações pelos princípios do Artigo 6º da LGPD:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs">
                <li><strong>Finalidade e Adequação:</strong> Coletamos apenas os dados imprescindíveis para fornecer comunicação em tempo real de alta qualidade.</li>
                <li><strong>Necessidade (Minimização):</strong> Não exigimos informações excessivas como CPF, telefone celular ou endereço físico para o uso padrão do comunicador.</li>
                <li><strong>Livre Acesso e Transparência:</strong> Garantimos aos usuários consulta facilitada sobre a forma e duração do tratamento de seus dados.</li>
                <li><strong>Segurança e Prevenção:</strong> Adotamos medidas técnicas contemporâneas para blindar os dados contra acessos não autorizados.</li>
                <li><strong>Não Discriminação:</strong> É expressamente vedado qualquer tratamento de dados para fins discriminatórios ou abusivos.</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section id="dados-coletados" className="scroll-mt-24 p-6 sm:p-8 rounded-xl bg-surface-elevated/40 border border-white/[0.06] space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-md bg-accent-primary/20 text-accent-primary flex items-center justify-center font-bold text-sm shrink-0">3</span>
                <h2 className="text-lg sm:text-xl font-bold text-white">Dados Pessoais Coletados</h2>
              </div>
              <p>
                Para possibilitar a experiência de comunicação interativa, o Nuvio processa as seguintes categorias de informações:
              </p>
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-lg bg-surface-base/50 border border-white/[0.04]">
                  <strong className="text-txt-primary block mb-1">A. Dados Cadastrais e de Identificação:</strong>
                  Nome de usuário único (<code className="text-accent-primary">username</code>), nome de exibição público (<code className="text-accent-primary">displayName</code>, opcional), avatar ou foto de perfil (opcional), recado/bio de perfil (opcional) e senha de acesso. A senha é submetida a derivação criptográfica irreversível antes de qualquer armazenamento.
                </div>
                <div className="p-3.5 rounded-lg bg-surface-base/50 border border-white/[0.04]">
                  <strong className="text-txt-primary block mb-1">B. Conteúdo de Comunicações:</strong>
                  Mensagens de texto enviadas em canais ou conversas diretas (DMs), reações, anexos e mídias transmitidos pelos usuários (como Winks, imagens e documentos).
                </div>
                <div className="p-3.5 rounded-lg bg-surface-base/50 border border-white/[0.04]">
                  <strong className="text-txt-primary block mb-1">C. Dados Técnicos de Rede e Conexão:</strong>
                  Endereço IP utilizado no momento da conexão, metadados de sessão WebSocket, tipo de sistema operacional e navegador (User-Agent) e registros de data e hora (logs) necessários para segurança, prevenção de ataques de negação de serviço e cumprimento de dever legal.
                </div>
                <div className="p-3.5 rounded-lg bg-surface-base/50 border border-white/[0.04]">
                  <strong className="text-txt-primary block mb-1">D. O que NÃO Coletamos:</strong>
                  O Nuvio não realiza coleta de dados sensíveis (dados de saúde, biométricos para autenticação, orientação sexual ou opiniões políticas) nem dados de cartões de pagamento diretamente na plataforma.
                </div>
              </div>
            </section>

            {/* Section 4 */}
            <section id="finalidades-bases" className="scroll-mt-24 p-6 sm:p-8 rounded-xl bg-surface-elevated/40 border border-white/[0.06] space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-md bg-accent-primary/20 text-accent-primary flex items-center justify-center font-bold text-sm shrink-0">4</span>
                <h2 className="text-lg sm:text-xl font-bold text-white">Finalidades e Bases Legais (LGPD)</h2>
              </div>
              <p>
                Todo e qualquer tratamento de dados pessoais no Nuvio é fundamentado em uma das hipóteses autorizativas do Artigo 7º da LGPD:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-white/[0.08] rounded-lg overflow-hidden">
                  <thead className="bg-white/[0.04] text-txt-primary font-semibold">
                    <tr>
                      <th className="p-3 border-b border-white/[0.08]">Finalidade do Tratamento</th>
                      <th className="p-3 border-b border-white/[0.08]">Dados Envolvidos</th>
                      <th className="p-3 border-b border-white/[0.08]">Base Legal (LGPD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    <tr>
                      <td className="p-3">Criação, autenticação e manutenção de conta</td>
                      <td className="p-3">Username, senha com hash, display name</td>
                      <td className="p-3">Art. 7º, V (Execução de Contrato)</td>
                    </tr>
                    <tr>
                      <td className="p-3">Roteamento e entrega de mensagens e arquivos</td>
                      <td className="p-3">Mensagens, anexos, identificadores de canal</td>
                      <td className="p-3">Art. 7º, V (Execução de Contrato)</td>
                    </tr>
                    <tr>
                      <td className="p-3">Transmissão de voz, vídeo e compartilhamento de tela</td>
                      <td className="p-3">Streams WebRTC em trânsito (não gravados)</td>
                      <td className="p-3">Art. 7º, V (Execução de Contrato)</td>
                    </tr>
                    <tr>
                      <td className="p-3">Guarda obrigatória de registros de conexão</td>
                      <td className="p-3">Endereço IP, data/hora e identificador</td>
                      <td className="p-3">Art. 7º, II (Cumprimento de Obrigação Legal — Art. 15 do Marco Civil)</td>
                    </tr>
                    <tr>
                      <td className="p-3">Prevenção a fraudes, segurança e proteção de infraestrutura</td>
                      <td className="p-3">Logs técnicos, tentativas de autenticação</td>
                      <td className="p-3">Art. 7º, IX (Legítimo Interesse)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 5 */}
            <section id="mensagens-arquivos" className="scroll-mt-24 p-6 sm:p-8 rounded-xl bg-surface-elevated/40 border border-white/[0.06] space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-md bg-accent-primary/20 text-accent-primary flex items-center justify-center font-bold text-sm shrink-0">5</span>
                <h2 className="text-lg sm:text-xl font-bold text-white">Mensagens, Arquivos e Mídias</h2>
              </div>
              <p>
                O processamento de conteúdos compartilhados pelos usuários segue diretrizes rígidas de integridade e confidencialidade:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs">
                <li><strong>Mensagens de Texto:</strong> São armazenadas na infraestrutura do Nuvio para viabilizar a entrega síncrona e assíncrona entre os participantes autorizados daquele canal ou conversa direta. O remetente pode editar ou excluir suas mensagens a qualquer momento.</li>
                <li><strong>Upload Fragmentado e Resumível (TUS):</strong> Arquivos de mídia e Winks são transferidos via protocolo fragmentado seguro (TUS), com verificação de tamanho máximo autorizado (até 500 MB) e validação de tipo MIME.</li>
                <li><strong>Exclusão de Arquivos:</strong> Ao cancelar um envio ou deletar uma mídia vinculada, os fragmentos e registros são expurgados do sistema.</li>
                <li><strong>Não Monitoramento de DMs:</strong> O Nuvio não realiza escuta ativa nem leitura humana de conversas privadas, intervindo apenas quando formalmente provocado por denúncia expressa de violação de termos ou ordem judicial.</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section id="voz-video" className="scroll-mt-24 p-6 sm:p-8 rounded-xl bg-surface-elevated/40 border border-white/[0.06] space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-md bg-accent-primary/20 text-accent-primary flex items-center justify-center font-bold text-sm shrink-0">6</span>
                <h2 className="text-lg sm:text-xl font-bold text-white">Comunicações de Voz e Vídeo em Tempo Real</h2>
              </div>
              <p>
                A tecnologia de voz e vídeo do Nuvio é estruturada sobre o protocolo WebRTC e unidades de encaminhamento seletivo (SFU — LiveKit):
              </p>
              <div className="p-4 rounded-lg bg-surface-base/60 border border-accent-mint/20 space-y-2 text-xs">
                <div className="text-accent-mint font-semibold flex items-center gap-1.5">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  </svg>
                  <span>Garantia de Não Gravação de Voz e Vídeo</span>
                </div>
                <p>
                  Os fluxos de áudio, vídeo e compartilhamento de tela trafegam pelos servidores apenas durante a duração da chamada para distribuição entre os participantes daquela sala ou canal. <strong>O Nuvio não grava, não armazena e não transcreve conversas de voz ou transmissões de vídeo em seus servidores.</strong>
                </p>
                <p className="text-txt-tertiary">
                  Todo o tráfego WebRTC é protegido por criptografia de mídia (SRTP) e negociação segura de chaves (DTLS).
                </p>
              </div>
            </section>

            {/* Section 7 */}
            <section id="armazenamento-retencao" className="scroll-mt-24 p-6 sm:p-8 rounded-xl bg-surface-elevated/40 border border-white/[0.06] space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-md bg-accent-primary/20 text-accent-primary flex items-center justify-center font-bold text-sm shrink-0">7</span>
                <h2 className="text-lg sm:text-xl font-bold text-white">Armazenamento e Prazos de Retenção</h2>
              </div>
              <p>
                Os dados pessoais são retidos apenas pelo período necessário para cumprir as finalidades para as quais foram coletados, observados os prazos legais de guarda:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs">
                <li><strong>Dados de Conta:</strong> Armazenados enquanto a conta permanecer ativa. Caso o titular solicite a exclusão de sua conta, os dados identificadores são permanentemente eliminados em até 15 dias úteis.</li>
                <li><strong>Logs de Acesso à Aplicação:</strong> Mantidos sob sigilo pelo prazo estrito de <strong>6 (seis) meses</strong>, em cumprimento compulsório ao Artigo 15 da Lei Federal nº 12.965/2014 (Marco Civil da Internet), sendo automaticamente descartados após o término do período.</li>
                <li><strong>Uploads Incompletos:</strong> Sessões de upload fragmentado abandonadas ou não finalizadas são purgadas periodicamente da infraestrutura temporária.</li>
              </ul>
            </section>

            {/* Section 8 */}
            <section id="cookies-localstorage" className="scroll-mt-24 p-6 sm:p-8 rounded-xl bg-surface-elevated/40 border border-white/[0.06] space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-md bg-accent-primary/20 text-accent-primary flex items-center justify-center font-bold text-sm shrink-0">8</span>
                <h2 className="text-lg sm:text-xl font-bold text-white">Cookies e Armazenamento Local</h2>
              </div>
              <p>
                O Nuvio prioriza a privacidade também no navegador. Não utilizamos cookies de rastreamento de terceiros para publicidade ou monitoramento comportamental entre sites.
              </p>
              <p className="text-xs">
                Utilizamos exclusivamente o mecanismo de armazenamento local (<code className="text-accent-primary">localStorage</code> e <code className="text-accent-primary">IndexedDB</code>) para finalidades estritamente técnicas e operacionais:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs">
                <li>Manter a sua sessão autenticada de forma segura através do token de acesso.</li>
                <li>Preservar preferências de usabilidade definidas por você (volume de áudio, tema visual, escala da interface e idioma).</li>
                <li>Armazenar cache de inicialização rápida de espaços e canais para carregamento instantâneo.</li>
              </ul>
            </section>

            {/* Section 9 */}
            <section id="compartilhamento" className="scroll-mt-24 p-6 sm:p-8 rounded-xl bg-surface-elevated/40 border border-white/[0.06] space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-md bg-accent-primary/20 text-accent-primary flex items-center justify-center font-bold text-sm shrink-0">9</span>
                <h2 className="text-lg sm:text-xl font-bold text-white">Compartilhamento com Fornecedores</h2>
              </div>
              <p>
                O Nuvio não comercializa dados pessoais. O compartilhamento ocorre exclusivamente com prestadores de serviços de tecnologia essenciais para a operação da plataforma, atuando como operadores de dados sob obrigações de confidencialidade:
              </p>
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-lg bg-surface-base/50 border border-white/[0.04]">
                  <strong>• Hospedagem Frontend e CDN (Vercel Inc.):</strong> Distribuição do código estático, roteamento e entrega global segura do aplicativo web.
                </div>
                <div className="p-3 rounded-lg bg-surface-base/50 border border-white/[0.04]">
                  <strong>• Servidores de Aplicação e Dados:</strong> Infraestrutura VPS dedicada onde operam a API em Fastify e os bancos de dados do Nuvio.
                </div>
                <div className="p-3 rounded-lg bg-surface-base/50 border border-white/[0.04]">
                  <strong>• Infraestrutura WebRTC / SFU (LiveKit):</strong> Servidores responsáveis pela negociação e retransmissão de mídia de voz e vídeo em tempo real.
                </div>
                <div className="p-3 rounded-lg bg-surface-base/50 border border-white/[0.04]">
                  <strong>• Autoridades Públicas:</strong> Mediante requisição judicial formal fundamentada ou exigência legal expressa emanada de autoridade competente.
                </div>
              </div>
            </section>

            {/* Section 10 */}
            <section id="bots-integracoes" className="scroll-mt-24 p-6 sm:p-8 rounded-xl bg-surface-elevated/40 border border-white/[0.06] space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-md bg-accent-primary/20 text-accent-primary flex items-center justify-center font-bold text-sm shrink-0">10</span>
                <h2 className="text-lg sm:text-xl font-bold text-white">Integrações Externas e Bots</h2>
              </div>
              <p>
                O Nuvio disponibiliza ecossistema para bots e integrações programáveis desenvolvidas por terceiros:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-xs">
                <li>Um bot somente recebe eventos e mensagens nos canais em que foi expressamente convidado e autorizado pelos administradores do espaço.</li>
                <li>Ao interagir com bots de terceiros, o usuário reconhece que tais aplicativos podem processar os comandos enviados de acordo com suas próprias políticas de privacidade.</li>
                <li>Recomendamos aos administradores de espaços que avaliem as políticas e a reputação de cada bot antes de conceder permissões avançadas.</li>
              </ul>
            </section>

            {/* Section 11 */}
            <section id="seguranca-criptografia" className="scroll-mt-24 p-6 sm:p-8 rounded-xl bg-surface-elevated/40 border border-white/[0.06] space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-md bg-accent-primary/20 text-accent-primary flex items-center justify-center font-bold text-sm shrink-0">11</span>
                <h2 className="text-lg sm:text-xl font-bold text-white">Segurança da Informação e Criptografia</h2>
              </div>
              <p>
                Adotamos salvaguardas técnicas e organizacionais compatíveis com os mais altos padrões do setor para salvaguardar seus dados:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-lg bg-surface-base/50 border border-white/[0.04]">
                  <strong className="text-white block mb-1">Criptografia em Trânsito:</strong>
                  100% das comunicações Web, API e WebSockets são blindadas por <strong>TLS 1.2 / TLS 1.3</strong> com HTTPS e WSS compulsórios.
                </div>
                <div className="p-3.5 rounded-lg bg-surface-base/50 border border-white/[0.04]">
                  <strong className="text-white block mb-1">Criptografia de Voz e Vídeo:</strong>
                  Canais de mídia protegidos por <strong>DTLS</strong> (Datagram Transport Layer Security) e <strong>SRTP</strong> (Secure Real-time Transport Protocol).
                </div>
                <div className="p-3.5 rounded-lg bg-surface-base/50 border border-white/[0.04]">
                  <strong className="text-white block mb-1">Derivação Segura de Senhas:</strong>
                  Senhas sofrem hashing criptográfico com salt individualizado de alta resistência, impedindo reversão ou leitura em texto claro.
                </div>
                <div className="p-3.5 rounded-lg bg-surface-base/50 border border-white/[0.04]">
                  <strong className="text-white block mb-1">Proteção contra Abusos:</strong>
                  Sistemas ativos de limitação de taxa (<em>rate limiting</em>) e sanitização estrita de inputs contra ataques de injeção e força bruta.
                </div>
              </div>
            </section>

            {/* Section 12 */}
            <section id="direitos-titular" className="scroll-mt-24 p-6 sm:p-8 rounded-xl bg-surface-elevated/40 border border-white/[0.06] space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-md bg-accent-primary/20 text-accent-primary flex items-center justify-center font-bold text-sm shrink-0">12</span>
                <h2 className="text-lg sm:text-xl font-bold text-white">Direitos dos Titulares de Dados (LGPD)</h2>
              </div>
              <p>
                Em conformidade com o Artigo 18 da LGPD, você, como titular de dados, possui o direito de solicitar a qualquer momento:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded bg-surface-base/50 border border-white/[0.04]"><strong>1. Confirmação:</strong> Saber se tratamos seus dados pessoais.</div>
                <div className="p-2.5 rounded bg-surface-base/50 border border-white/[0.04]"><strong>2. Acesso:</strong> Obter cópia legível dos dados mantidos pelo Nuvio.</div>
                <div className="p-2.5 rounded bg-surface-base/50 border border-white/[0.04]"><strong>3. Correção:</strong> Retificar dados incompletos ou desatualizados.</div>
                <div className="p-2.5 rounded bg-surface-base/50 border border-white/[0.04]"><strong>4. Anonimização ou Bloqueio:</strong> De dados desnecessários ou excessivos.</div>
                <div className="p-2.5 rounded bg-surface-base/50 border border-white/[0.04]"><strong>5. Portabilidade:</strong> Exportar seus dados em formato estruturado.</div>
                <div className="p-2.5 rounded bg-surface-base/50 border border-white/[0.04]"><strong>6. Eliminação:</strong> Excluir dados tratados com seu consentimento.</div>
                <div className="p-2.5 rounded bg-surface-base/50 border border-white/[0.04]"><strong>7. Informação:</strong> Detalhes sobre compartilhamento com terceiros.</div>
                <div className="p-2.5 rounded bg-surface-base/50 border border-white/[0.04]"><strong>8. Revogação:</strong> Retirar consentimento previamente concedido.</div>
              </div>
            </section>

            {/* Section 13 */}
            <section id="solicitacao-exclusao" className="scroll-mt-24 p-6 sm:p-8 rounded-xl bg-surface-elevated/40 border border-white/[0.06] space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-md bg-accent-primary/20 text-accent-primary flex items-center justify-center font-bold text-sm shrink-0">13</span>
                <h2 className="text-lg sm:text-xl font-bold text-white">Procedimentos para Solicitação e Exclusão de Dados</h2>
              </div>
              <p>
                Garantimos canais ágeis e desburocratizados para o exercício de seus direitos:
              </p>
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-lg bg-surface-base/50 border border-white/[0.04]">
                  <strong className="text-txt-primary block mb-1">A. Exportação dos seus dados pelo Aplicativo:</strong>
                  Você pode gerar uma cópia dos seus dados diretamente nas configurações do Nuvio acessando <strong>Configurações → Dados e privacidade → Solicitar cópia dos dados</strong>.
                </div>
                <div className="p-3.5 rounded-lg bg-surface-base/50 border border-white/[0.04]">
                  <strong className="text-txt-primary block mb-1">B. Exclusão de Conta e Dados Pessoais:</strong>
                  Para solicitar o encerramento definitivo de sua conta e a exclusão dos dados pessoais associados, envie uma mensagem para o e-mail oficial: <a href="mailto:Gbrielcerqueira@gmail.com" className="text-accent-primary hover:underline font-semibold">Gbrielcerqueira@gmail.com</a> contendo seu nome de usuário.
                </div>
                <div className="p-3.5 rounded-lg bg-surface-base/50 border border-white/[0.04]">
                  <strong className="text-txt-primary block mb-1">C. Prazo de Atendimento:</strong>
                  Em observância à LGPD, as solicitações são analisadas e respondidas no prazo regulamentar de até 15 (quinze) dias úteis.
                </div>
              </div>
            </section>

            {/* Section 14 */}
            <section id="protecao-adolescentes" className="scroll-mt-24 p-6 sm:p-8 rounded-xl bg-surface-elevated/40 border border-white/[0.06] space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-md bg-accent-primary/20 text-accent-primary flex items-center justify-center font-bold text-sm shrink-0">14</span>
                <h2 className="text-lg sm:text-xl font-bold text-white">Proteção de Crianças e Adolescentes (Política de 15 Anos)</h2>
              </div>
              <p>
                O Nuvio adota padrões rigorosos no tocante à proteção de menores de idade, em consonância com o Artigo 14 da LGPD e com o Estatuto da Criança e do Adolescente (ECA — Lei nº 8.069/1990):
              </p>
              <div className="p-4 rounded-lg bg-surface-base/60 border border-accent-amber/25 space-y-2 text-xs">
                <div className="text-accent-amber font-semibold flex items-center gap-1.5">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>Idade Mínima Declaratória e Assistência Legal</span>
                </div>
                <p>
                  <strong>A idade mínima para cadastro e uso da plataforma Nuvio é de 15 (quinze) anos.</strong> A plataforma não é desenhada nem direcionada a crianças (menores de 12 anos).
                </p>
                <p>
                  Usuários com idade entre 15 e 18 anos declaram estar assistidos por seus pais ou responsáveis legais, que devem ler e anuir a esta Política de Privacidade.
                </p>
                <p className="text-txt-tertiary">
                  Caso tenhamos conhecimento de que um usuário com menos de 15 anos efetuou cadastro na plataforma sem a devida representação ou assistência legal, procederemos com a exclusão sumária da conta e de todos os dados correspondentes. Pais ou responsáveis que identifiquem uso não autorizado podem contatar imediatamente <a href="mailto:Gbrielcerqueira@gmail.com" className="text-accent-primary hover:underline">Gbrielcerqueira@gmail.com</a>.
                </p>
              </div>
            </section>

            {/* Section 15 */}
            <section id="transferencias-contato" className="scroll-mt-24 p-6 sm:p-8 rounded-xl bg-surface-elevated/40 border border-white/[0.06] space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-md bg-accent-primary/20 text-accent-primary flex items-center justify-center font-bold text-sm shrink-0">15</span>
                <h2 className="text-lg sm:text-xl font-bold text-white">Transferências Internacionais e Contato (DPO)</h2>
              </div>
              <p>
                Em decorrência do uso de infraestrutura global em nuvem (como Vercel e serviços distribuídos de CDN), alguns dados técnicos podem ser processados em servidores localizados fora do território nacional (como nos Estados Unidos). Tais transferências observam rigorosamente o Artigo 33 da LGPD, amparadas por cláusulas contratuais e padrões avançados de segurança cibernética.
              </p>
              <p>
                Esta política poderá sofrer revisões periódicas para aprimoramento contínuo. Modificações substanciais serão comunicadas diretamente na plataforma.
              </p>

              {/* Official Contact Box */}
              <div className="p-5 rounded-lg bg-surface-base/70 border border-accent-primary/30 space-y-3 text-xs mt-4">
                <h3 className="text-sm font-bold text-white">Encarregado pelo Tratamento de Dados Pessoais (DPO)</h3>
                <p>
                  Para esclarecer qualquer dúvida, formular reclamações ou exercer seus direitos de privacidade:
                </p>
                <div className="space-y-1 text-txt-primary">
                  <div><strong>Responsável:</strong> Gabriel Cerqueira do Nascimento</div>
                  <div><strong>E-mail direto:</strong> <a href="mailto:Gbrielcerqueira@gmail.com" className="text-accent-primary hover:underline font-mono">Gbrielcerqueira@gmail.com</a></div>
                  <div><strong>Endereço da Aplicação:</strong> <a href="https://nuviovoice.vercel.app" target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline">https://nuviovoice.vercel.app</a></div>
                  <div><strong>Prazo estimado de resposta:</strong> até 15 dias úteis</div>
                </div>
              </div>
            </section>

            {/* Back to top button */}
            {showBackToTop && (
              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="inline-flex items-center gap-2 text-xs text-txt-tertiary hover:text-white px-3 py-2 rounded-lg bg-surface-elevated/60 border border-white/[0.08] transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                  <span>Voltar ao topo</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Institutional Footer */}
      <footer className="mt-auto border-t border-white/[0.08] bg-surface-base/90 py-8 px-4 sm:px-6 text-xs text-txt-tertiary">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/icons/nuvio_logo.svg" alt="Nuvio" className="w-5 h-5 opacity-80" />
            <span className="font-semibold text-txt-secondary">Nuvio</span>
            <span>•</span>
            <span>© 2026 Gabriel Cerqueira do Nascimento. Todos os direitos reservados.</span>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/download" className="hover:text-txt-secondary transition-colors">
              Baixar Desktop
            </Link>
            <span>•</span>
            <Link to="/login" className="hover:text-txt-secondary transition-colors">
              Entrar
            </Link>
            <span>•</span>
            <Link to="/register" className="hover:text-txt-secondary transition-colors">
              Cadastro
            </Link>
            <span>•</span>
            <Link to="/privacy" className="text-accent-primary hover:underline font-medium">
              Política de Privacidade
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
