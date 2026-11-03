import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { VoiceRecordButton } from './VoiceRecordButton';

describe('VoiceRecordButton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('triggers onStartRecording(true) on a single click / tap', () => {
    const onStart = vi.fn();
    render(<VoiceRecordButton onStartRecording={onStart} />);

    const btn = screen.getByTestId('voice-record-trigger');
    fireEvent.pointerDown(btn, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(btn);

    expect(onStart).toHaveBeenCalledWith(true);
  });

  it('triggers hold state and onStartRecording(false) when held down', () => {
    const onStart = vi.fn();
    render(<VoiceRecordButton onStartRecording={onStart} />);

    const btn = screen.getByTestId('voice-record-trigger');
    fireEvent.pointerDown(btn, { button: 0, clientX: 100, clientY: 100 });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onStart).toHaveBeenCalledWith(false);
    expect(screen.getByTestId('voice-slide-cancel-indicator')).toBeDefined();
    expect(screen.getByTestId('voice-lock-indicator')).toBeDefined();
  });

  it('triggers onLockRecording when sliding up past threshold during hold', () => {
    const onStart = vi.fn();
    const onLock = vi.fn();
    render(<VoiceRecordButton onStartRecording={onStart} onLockRecording={onLock} />);

    const btn = screen.getByTestId('voice-record-trigger');
    fireEvent.pointerDown(btn, { button: 0, clientX: 100, clientY: 100 });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Move up by 55px (dy = -55)
    fireEvent.pointerMove(btn, { clientX: 100, clientY: 45 });

    expect(onLock).toHaveBeenCalled();
  });

  it('triggers onCancelRecording when sliding left past threshold during hold', () => {
    const onStart = vi.fn();
    const onCancel = vi.fn();
    render(<VoiceRecordButton onStartRecording={onStart} onCancelRecording={onCancel} />);

    const btn = screen.getByTestId('voice-record-trigger');
    fireEvent.pointerDown(btn, { button: 0, clientX: 100, clientY: 100 });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Move left by 75px (dx = -75)
    fireEvent.pointerMove(btn, { clientX: 25, clientY: 100 });

    expect(onCancel).toHaveBeenCalled();
  });

  it('triggers onFinishHold when releasing finger after hold', () => {
    const onStart = vi.fn();
    const onFinish = vi.fn();
    render(<VoiceRecordButton onStartRecording={onStart} onFinishHold={onFinish} />);

    const btn = screen.getByTestId('voice-record-trigger');
    fireEvent.pointerDown(btn, { button: 0, clientX: 100, clientY: 100 });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    fireEvent.pointerUp(btn);

    expect(onFinish).toHaveBeenCalled();
  });
});
