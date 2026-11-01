import React, { useState } from 'react';
import type { OfficialWink } from '@concord/shared/src/winks';

interface WinkThumbnailProps {
  wink: OfficialWink;
  className?: string;
  emojiClassName?: string;
}

/**
 * Robust thumbnail renderer for Winks with finite 3-step fallback:
 * 1. Primary static URL (/winks/${wink.id}_thumb.webp or wink.thumbnailUrl)
 * 2. Alternative verified URL (/winks/${wink.id}_thumb.webp)
 * 3. Fallback preview emoji / placeholder (guarantees no broken image icons)
 */
export function WinkThumbnail({ wink, className = 'w-full h-full object-cover', emojiClassName = 'text-2xl' }: WinkThumbnailProps) {
  // Stages: 0 = primary URL, 1 = verified static fallback, 2 = emoji placeholder
  const [stage, setStage] = useState<0 | 1 | 2>(0);

  const primaryUrl = wink.thumbnailUrl || `/winks/${wink.id}_thumb.webp`;
  const fallbackUrl = `/winks/${wink.id}_thumb.webp`;

  if (stage === 2 || (!primaryUrl && !fallbackUrl)) {
    return (
      <span className={emojiClassName} role="img" aria-label={wink.name}>
        {wink.previewEmoji || '✨'}
      </span>
    );
  }

  const currentSrc = stage === 0 ? primaryUrl : fallbackUrl;

  const handleError = () => {
    if (stage === 0) {
      if (primaryUrl !== fallbackUrl) {
        setStage(1);
      } else {
        setStage(2);
      }
    } else {
      setStage(2);
    }
  };

  return (
    <img
      src={currentSrc}
      alt={wink.name}
      className={className}
      loading="lazy"
      onError={handleError}
    />
  );
}
