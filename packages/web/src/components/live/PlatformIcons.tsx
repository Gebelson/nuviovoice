import React from 'react';
import type { StreamPlatform } from '@concord/shared';

interface PlatformIconProps {
  platform: StreamPlatform;
  className?: string;
  size?: number;
}

export function PlatformIcon({ platform, className = '', size = 16 }: PlatformIconProps) {
  switch (platform) {
    case 'twitch':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
        >
          <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
        </svg>
      );

    case 'kick':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
        >
          <path d="M3 3h4.5v6.5l4-6.5h5.5l-5.5 8.5L18 21h-5.5l-5-7.5V21H3V3z" />
        </svg>
      );

    case 'youtube':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
        >
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
  }
}

export function getPlatformColor(platform: StreamPlatform): string {
  switch (platform) {
    case 'twitch':
      return '#9146FF';
    case 'kick':
      return '#53FC18';
    case 'youtube':
      return '#FF0000';
  }
}

export function getPlatformBadgeStyle(platform: StreamPlatform): { bg: string; text: string; border: string } {
  switch (platform) {
    case 'twitch':
      return { bg: 'bg-[#9146FF]/15', text: 'text-[#a970ff]', border: 'border-[#9146FF]/30' };
    case 'kick':
      return { bg: 'bg-[#53FC18]/15', text: 'text-[#53FC18]', border: 'border-[#53FC18]/30' };
    case 'youtube':
      return { bg: 'bg-[#FF0000]/15', text: 'text-[#ff4e4e]', border: 'border-[#FF0000]/30' };
  }
}

export function getPlatformName(platform: StreamPlatform): string {
  switch (platform) {
    case 'twitch':
      return 'Twitch';
    case 'kick':
      return 'Kick';
    case 'youtube':
      return 'YouTube';
  }
}
