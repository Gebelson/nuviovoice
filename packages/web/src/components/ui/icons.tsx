import React from 'react';

export interface IconProps {
  width?: number | string;
  height?: number | string;
  className?: string;
  fill?: string;
}

export function SparklesIcon({ width = 18, height = 18, className = '', fill = 'currentColor' }: IconProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill={fill}
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z M19 16L19.9 19.1L23 20L19.9 20.9L19 24L18.1 20.9L15 20L18.1 19.1L19 16Z M5 16L5.9 19.1L9 20L5.9 20.9L5 24L4.1 20.9L1 20L4.1 19.1L5 16Z" />
    </svg>
  );
}

export function CloseIcon({ width = 16, height = 16, className = '', fill = 'currentColor' }: IconProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill={fill}
      className={className}
      aria-hidden="true"
    >
      <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" />
    </svg>
  );
}
