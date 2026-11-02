import React, { useState } from 'react';
import type { LiveStreamInfo } from '@concord/shared';
import { PlatformIcon, getPlatformColor, getPlatformName } from './PlatformIcons';
import { Avatar } from '../ui/Avatar';
import { VerificationBadge } from '../ui/VerificationBadge';
import { Tooltip } from '../ui/Tooltip';
import { formatters } from '../../i18n/formatters';

interface LiveStreamSidebarItemProps {
  stream: LiveStreamInfo;
  active: boolean;
  onClick: () => void;
}

export function LiveStreamSidebarItem({ stream, active, onClick }: LiveStreamSidebarItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const platformColor = getPlatformColor(stream.platform);
  const platformName = getPlatformName(stream.platform);

  const getPillHeight = () => {
    if (active) return 'h-8';
    if (isHovered) return 'h-4';
    return 'h-2 scale-0';
  };

  const tooltipNode = (
    <div className="flex flex-col gap-1 max-w-[200px] text-left py-0.5">
      <div className="flex items-center gap-1.5 font-bold text-white text-xs">
        <span className="truncate">{stream.streamer.displayName || stream.streamer.username}</span>
        {stream.streamer.verification && (
          <VerificationBadge
            category={stream.streamer.verification.category}
            size="xs"
            showTooltip={false}
          />
        )}
      </div>

      <div className="flex items-center gap-2 text-[10px]">
        <span className="flex items-center gap-1 text-red-400 font-bold uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping inline-block" />
          Ao Vivo
        </span>
        <span className="text-white/60">
          {stream.viewerCount > 0 ? `${formatters.formatNumber(stream.viewerCount)} assistindo` : platformName}
        </span>
      </div>

      {stream.streamTitle && (
        <span className="text-[11px] text-white/80 line-clamp-2 leading-tight">
          {stream.streamTitle}
        </span>
      )}

      {stream.streamGame && (
        <span className="text-[10px] text-accent-primary font-medium truncate">
          🎮 {stream.streamGame}
        </span>
      )}
    </div>
  );

  return (
    <div
      className="relative flex items-center mb-2 w-full justify-center group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Active / Hover Pill Indicator on the left */}
      <div className="absolute left-0 w-2 h-10 flex items-center pointer-events-none">
        <div
          className={`bg-white rounded-r-full transition-all duration-200 origin-left w-1 ${getPillHeight()}`}
        />
      </div>

      <Tooltip content={tooltipNode} position="right" delay={150}>
        <button
          onClick={onClick}
          className={`relative w-10 h-10 flex items-center justify-center transition-all duration-200 focus:outline-none ${
            active
              ? 'rounded-[14px] ring-2 ring-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]'
              : 'rounded-[20px] hover:rounded-[14px] ring-2 ring-red-500/80 hover:ring-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
          }`}
          aria-label={`Assistir transmissão ao vivo de ${stream.streamer.displayName || stream.streamer.username}`}
        >
          {/* Avatar */}
          <Avatar
            src={stream.streamer.avatar || undefined}
            name={stream.streamer.displayName || stream.streamer.username}
            avatarColor={stream.streamer.avatarColor || undefined}
            size={38}
            className="w-full h-full object-cover rounded-[inherit]"
          />

          {/* Corner Platform Badge */}
          <div
            style={{ backgroundColor: platformColor }}
            className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white ring-2 ring-surface-base shadow-sm"
            title={platformName}
          >
            <PlatformIcon platform={stream.platform} size={9} />
          </div>
        </button>
      </Tooltip>
    </div>
  );
}
