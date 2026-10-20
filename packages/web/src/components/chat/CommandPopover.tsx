import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useFloatingPosition } from '../../hooks/useFloatingPosition';
import { useUIStore } from '../../stores/uiStore';

export interface CommandItem {
  name: string;
  description: string;
  botName: string;
}

interface CommandPopoverProps {
  commands: CommandItem[];
  selectedIndex: number;
  onSelect: (cmd: CommandItem) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

function CommandList({
  commands,
  selectedIndex,
  selectedRef,
  onSelect,
  mobile,
}: {
  commands: CommandItem[];
  selectedIndex: number;
  selectedRef: React.RefObject<HTMLDivElement>;
  onSelect: (cmd: CommandItem) => void;
  mobile: boolean;
}) {
  return (
    <div className="py-1 space-y-0.5">
      <div className="px-3 py-1 text-[10px] font-bold text-txt-tertiary uppercase tracking-wider">
        Comandos de Bots
      </div>
      {commands.map((cmd, idx) => {
        const isSelected = idx === selectedIndex;
        return (
          <div
            key={cmd.name}
            ref={isSelected ? selectedRef : undefined}
            onClick={() => onSelect(cmd)}
            className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              mobile ? 'min-h-[44px]' : ''
            } ${
              isSelected
                ? 'bg-accent-primary/20 text-white'
                : 'hover:bg-white/[0.06] text-txt-primary'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-sm text-accent-primary">
                /{cmd.name}
              </span>
              {cmd.description && (
                <span className="text-xs text-txt-secondary truncate max-w-[280px]">
                  {cmd.description}
                </span>
              )}
            </div>
            <span className="shrink-0 px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-[10px] font-medium text-txt-tertiary">
              {cmd.botName}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DesktopCommandPopover({
  commands,
  selectedIndex,
  onSelect,
  anchorRef,
}: CommandPopoverProps) {
  const selectedRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const { style } = useFloatingPosition(anchorRef, floatingRef, {
    placement: 'top',
    align: 'start',
    offset: 8,
    enabled: commands.length > 0,
  });

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return createPortal(
    <div
      ref={floatingRef}
      style={style}
      className="w-96 max-h-72 overflow-y-auto rounded-xl glass-panel bg-surface-panel/95 backdrop-blur-xl border border-white/10 shadow-2xl p-1.5 scrollbar-thin animate-in fade-in zoom-in-95 duration-100 z-[250]"
    >
      <CommandList
        commands={commands}
        selectedIndex={selectedIndex}
        selectedRef={selectedRef}
        onSelect={onSelect}
        mobile={false}
      />
    </div>,
    document.body
  );
}

function MobileCommandPopover({
  commands,
  selectedIndex,
  onSelect,
}: CommandPopoverProps) {
  const selectedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[300] bg-black/30 pointer-events-none" />
      <div
        className="fixed left-0 right-0 z-[301] rounded-t-2xl glass-modal animate-slide-up-sheet flex flex-col p-2"
        style={{
          bottom: 'var(--keyboard-inset)',
          paddingBottom: 'var(--safe-bottom)',
          maxHeight: 'min(calc(50*var(--app-dvh)), calc(50*var(--app-vh)))',
        }}
      >
        <div className="w-10 h-1 bg-txt-tertiary/30 rounded-full mx-auto mt-2 mb-2 shrink-0" />
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
          <CommandList
            commands={commands}
            selectedIndex={selectedIndex}
            selectedRef={selectedRef}
            onSelect={onSelect}
            mobile={true}
          />
        </div>
      </div>
    </>,
    document.body
  );
}

export function CommandPopover(props: CommandPopoverProps) {
  const isMobile = useUIStore((s) => s.isMobile);

  if (props.commands.length === 0) return null;

  if (isMobile) {
    return <MobileCommandPopover {...props} />;
  }

  return <DesktopCommandPopover {...props} />;
}
