import React, { useState } from 'react';
import type { VisualBlock } from '../../types/store';

interface VisualBlockRendererProps {
  blocks: VisualBlock[];
  previewMode?: 'desktop' | 'tablet' | 'mobile';
  className?: string;
  onCtaClick?: (link?: string) => void;
}

export function VisualBlockRenderer({
  blocks,
  previewMode = 'desktop',
  className = '',
  onCtaClick,
}: VisualBlockRendererProps) {
  if (!blocks || blocks.length === 0) {
    return null;
  }

  const containerWidthClass =
    previewMode === 'mobile'
      ? 'max-w-sm mx-auto'
      : previewMode === 'tablet'
      ? 'max-w-2xl mx-auto'
      : 'w-full';

  return (
    <div className={`space-y-8 select-text ${containerWidthClass} ${className}`}>
      {blocks.map((block) => (
        <BlockItem key={block.id} block={block} onCtaClick={onCtaClick} />
      ))}
    </div>
  );
}

function BlockItem({ block, onCtaClick }: { block: VisualBlock; onCtaClick?: (link?: string) => void }) {
  const { type, props } = block;

  switch (type) {
    case 'hero': {
      const {
        title = 'Título Incrível',
        subtitle = 'Descrição detalhada do seu produto ou serviço',
        badge = '',
        align = 'center',
        bgGradient = 'purple',
        ctaText = '',
        ctaLink = '',
      } = props;

      const gradients: Record<string, string> = {
        purple: 'from-accent-primary/20 via-surface-panel to-surface-base border-accent-primary/30',
        blue: 'from-blue-600/20 via-surface-panel to-surface-base border-blue-500/30',
        emerald: 'from-emerald-600/20 via-surface-panel to-surface-base border-emerald-500/30',
        amber: 'from-amber-600/20 via-surface-panel to-surface-base border-amber-500/30',
        dark: 'from-white/5 via-surface-panel to-surface-base border-border-hard',
      };

      const alignClasses =
        align === 'left' ? 'text-left items-start' : 'text-center items-center';

      return (
        <div
          className={`relative overflow-hidden rounded-2xl p-8 md:p-12 border bg-gradient-to-b ${
            gradients[bgGradient] || gradients.purple
          } flex flex-col ${alignClasses}`}
        >
          {badge ? (
            <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-accent-primary/20 text-accent-primary border border-accent-primary/30 mb-4 inline-block">
              {badge}
            </span>
          ) : null}
          <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight max-w-3xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-4 text-base md:text-lg text-txt-secondary max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          ) : null}
          {ctaText ? (
            <button
              onClick={() => (onCtaClick ? onCtaClick(ctaLink) : window.open(ctaLink, '_blank'))}
              className="mt-6 px-6 py-3 rounded-xl bg-accent-primary hover:bg-accent-primary/90 text-white font-semibold text-sm transition-transform active:scale-95 shadow-lg shadow-accent-primary/20"
            >
              {ctaText}
            </button>
          ) : null}
        </div>
      );
    }

    case 'heading': {
      const { text = '', level = 2, align = 'left' } = props;
      const alignClass =
        align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

      if (level === 1) {
        return <h1 className={`text-2xl md:text-3xl font-bold text-white tracking-tight ${alignClass}`}>{text}</h1>;
      }
      if (level === 3) {
        return <h3 className={`text-lg md:text-xl font-semibold text-white tracking-tight ${alignClass}`}>{text}</h3>;
      }
      return <h2 className={`text-xl md:text-2xl font-bold text-white tracking-tight ${alignClass}`}>{text}</h2>;
    }

    case 'paragraph': {
      const { content = '', size = 'base', align = 'left' } = props;
      const sizeClass = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base';
      const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

      return (
        <div className={`${sizeClass} text-txt-secondary leading-relaxed whitespace-pre-line ${alignClass}`}>
          {content}
        </div>
      );
    }

    case 'image': {
      const { url = '', alt = '', caption = '', rounded = true } = props;
      if (!url) return null;
      return (
        <figure className="space-y-2">
          <img
            src={url}
            alt={alt || caption || 'Imagem do produto'}
            className={`w-full object-cover max-h-[500px] border border-border-hard ${
              rounded ? 'rounded-xl' : 'rounded-none'
            }`}
            loading="lazy"
          />
          {caption ? (
            <figcaption className="text-xs text-txt-tertiary text-center italic">
              {caption}
            </figcaption>
          ) : null}
        </figure>
      );
    }

    case 'gallery': {
      const { images = [], columns = 3 } = props;
      if (!Array.isArray(images) || images.length === 0) return null;

      const colClass =
        columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : columns === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3';

      return (
        <div className={`grid gap-4 ${colClass}`}>
          {images.map((img: any, idx: number) => {
            const url = typeof img === 'string' ? img : img.url;
            const caption = typeof img === 'string' ? '' : img.caption;
            return (
              <div key={idx} className="group relative rounded-xl overflow-hidden border border-border-hard bg-surface-panel aspect-video">
                <img
                  src={url}
                  alt={caption || `Galeria ${idx + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                {caption ? (
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-black/60 backdrop-blur-sm text-[11px] text-txt-secondary truncate">
                    {caption}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      );
    }

    case 'feature_grid': {
      const { title = '', items = [] } = props;
      return (
        <div className="space-y-4">
          {title ? <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">{title}</h2> : null}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {items.map((item: any, i: number) => (
              <div
                key={i}
                className="p-5 rounded-xl border border-border-hard bg-surface-panel/60 hover:bg-surface-panel transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-lg bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center text-accent-primary mb-3">
                    <FeatureIcon name={item.icon || 'Star'} />
                  </div>
                  <h3 className="font-semibold text-white text-base mb-1">{item.title}</h3>
                  <p className="text-sm text-txt-secondary leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'faq': {
      const { title = 'Perguntas Frequentes', items = [] } = props;
      return (
        <div className="space-y-4">
          {title ? <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">{title}</h2> : null}
          <div className="space-y-2">
            {items.map((item: any, i: number) => (
              <FaqItem key={i} question={item.question} answer={item.answer} />
            ))}
          </div>
        </div>
      );
    }

    case 'testimonials': {
      const { title = 'O que dizem os clientes', items = [] } = props;
      return (
        <div className="space-y-4">
          {title ? <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">{title}</h2> : null}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((t: any, i: number) => (
              <div key={i} className="p-5 rounded-xl border border-border-hard bg-surface-panel flex flex-col justify-between">
                <p className="text-sm text-txt-secondary italic leading-relaxed mb-4">
                  "{t.quote}"
                </p>
                <div className="flex items-center gap-3">
                  {t.avatar ? (
                    <img src={t.avatar} alt={t.author} className="w-9 h-9 rounded-full object-cover border border-border-hard" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-accent-primary/20 text-accent-primary font-bold text-sm flex items-center justify-center">
                      {(t.author || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs font-semibold text-white">{t.author}</h4>
                    {t.role ? <p className="text-[11px] text-txt-tertiary">{t.role}</p> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'specs': {
      const { title = 'Especificações & Detalhes', items = [] } = props;
      return (
        <div className="space-y-4">
          {title ? <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">{title}</h2> : null}
          <div className="rounded-xl border border-border-hard overflow-hidden bg-surface-panel/40 divide-y divide-border-hard">
            {items.map((it: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-5 py-3.5 text-sm">
                <span className="text-txt-tertiary font-medium">{it.label}</span>
                <span className="text-white font-semibold text-right">{it.value}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'video': {
      const { url = '', title = '' } = props;
      if (!url) return null;

      // Extract embed URL safely
      let embedUrl = url;
      if (url.includes('youtube.com/watch?v=')) {
        const videoId = url.split('v=')[1]?.split('&')[0];
        embedUrl = `https://www.youtube.com/embed/${videoId}`;
      } else if (url.includes('youtu.be/')) {
        const videoId = url.split('youtu.be/')[1]?.split('?')[0];
        embedUrl = `https://www.youtube.com/embed/${videoId}`;
      }

      return (
        <div className="space-y-2">
          {title ? <h3 className="text-lg font-semibold text-white">{title}</h3> : null}
          <div className="relative aspect-video rounded-xl overflow-hidden border border-border-hard bg-black">
            <iframe
              src={embedUrl}
              title={title || 'Vídeo do produto'}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      );
    }

    case 'button_cta': {
      const { text = 'Comprar Agora', link = '', variant = 'primary', align = 'center' } = props;
      const alignClass =
        align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center';

      const variantClass =
        variant === 'outline'
          ? 'border border-accent-primary text-accent-primary hover:bg-accent-primary/10'
          : variant === 'secondary'
          ? 'bg-surface-panel text-white hover:bg-surface-channel border border-border-hard'
          : 'bg-accent-primary text-white hover:bg-accent-primary/90 shadow-lg shadow-accent-primary/20';

      return (
        <div className={`flex ${alignClass} my-4`}>
          <button
            onClick={() => (onCtaClick ? onCtaClick(link) : window.open(link, '_blank'))}
            className={`px-8 py-3.5 rounded-xl font-bold text-sm transition-transform active:scale-95 ${variantClass}`}
          >
            {text}
          </button>
        </div>
      );
    }

    case 'divider': {
      const { style = 'solid' } = props;
      if (style === 'glow') {
        return (
          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-accent-primary/60 to-transparent my-6" />
        );
      }
      return (
        <hr
          className={`border-border-hard my-6 ${style === 'dashed' ? 'border-dashed' : 'border-solid'}`}
        />
      );
    }

    default:
      return null;
  }
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border-hard rounded-xl overflow-hidden bg-surface-panel/40">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left font-medium text-white hover:bg-surface-panel/60 transition-colors"
      >
        <span>{question}</span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-txt-tertiary transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open ? (
        <div className="px-5 pb-4 text-sm text-txt-secondary leading-relaxed border-t border-border-hard/50 pt-3">
          {answer}
        </div>
      ) : null}
    </div>
  );
}

function FeatureIcon({ name }: { name: string }) {
  switch (name) {
    case 'Shield':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'Zap':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case 'Clock':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'Smile':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
      );
    default:
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
  }
}
