import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { VoiceRecorderBar } from './VoiceRecorderBar';
import * as voiceUploadModule from '../../utils/voiceUpload';
import { useUIStore } from '../../stores/uiStore';
import type { Attachment } from '@concord/shared';

describe('VoiceRecorderBar', () => {
  let mockStream: MediaStream;
  let mockStopTrack: ReturnType<typeof vi.fn>;
  let mockRecorder: any;

  beforeEach(() => {
    vi.useFakeTimers();

    mockStopTrack = vi.fn();
    mockStream = {
      getTracks: () => [{ stop: mockStopTrack }] as unknown as MediaStreamTrack[],
    } as unknown as MediaStream;

    mockRecorder = {
      state: 'recording',
      start: vi.fn(),
      pause: vi.fn().mockImplementation(() => {
        mockRecorder.state = 'paused';
      }),
      resume: vi.fn().mockImplementation(() => {
        mockRecorder.state = 'recording';
      }),
      stop: vi.fn().mockImplementation(() => {
        mockRecorder.state = 'inactive';
        if (mockRecorder.ondataavailable) {
          mockRecorder.ondataavailable({ data: new Blob(['mock audio data'], { type: 'audio/webm' }) });
        }
        if (mockRecorder.onstop) {
          mockRecorder.onstop();
        }
      }),
      ondataavailable: null,
      onstop: null,
    };

    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
    });

    vi.stubGlobal('MediaRecorder', vi.fn().mockImplementation(() => mockRecorder));
    (window as any).MediaRecorder.isTypeSupported = vi.fn().mockReturnValue(true);

    vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => ({
      createMediaStreamSource: vi.fn().mockReturnValue({ connect: vi.fn() }),
      createAnalyser: vi.fn().mockReturnValue({
        frequencyBinCount: 32,
        getByteFrequencyData: vi.fn((arr: Uint8Array) => arr.fill(50)),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    })));

    vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => setTimeout(cb, 50)));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:mock-audio'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders recording state and increments timer', async () => {
    const onCancel = vi.fn();
    const onSend = vi.fn();

    render(
      <VoiceRecorderBar
        channelId="c-1"
        onCancel={onCancel}
        onSendVoice={onSend}
        initialMediaStream={mockStream}
        initialMediaRecorder={mockRecorder}
      />
    );

    expect(screen.getByTestId('voice-recorder-bar')).toBeDefined();
    expect(screen.getByText('0:00')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('0:02')).toBeDefined();
  });

  it('pauses and resumes recording', () => {
    const onCancel = vi.fn();
    const onSend = vi.fn();

    render(
      <VoiceRecorderBar
        channelId="c-1"
        onCancel={onCancel}
        onSendVoice={onSend}
        initialMediaStream={mockStream}
        initialMediaRecorder={mockRecorder}
      />
    );

    const pauseBtn = screen.getByTestId('voice-pause-button');
    fireEvent.click(pauseBtn);
    expect(mockRecorder.pause).toHaveBeenCalled();

    // Now button becomes resume
    const resumeBtn = screen.getByTestId('voice-pause-button');
    fireEvent.click(resumeBtn);
    expect(mockRecorder.resume).toHaveBeenCalled();
  });

  it('cancels and cleans up hardware when trash icon is clicked', () => {
    const onCancel = vi.fn();
    const onSend = vi.fn();

    render(
      <VoiceRecorderBar
        channelId="c-1"
        onCancel={onCancel}
        onSendVoice={onSend}
        initialMediaStream={mockStream}
        initialMediaRecorder={mockRecorder}
      />
    );

    const cancelBtn = screen.getByTestId('voice-discard-button');
    fireEvent.click(cancelBtn);

    expect(onCancel).toHaveBeenCalled();
    expect(mockStopTrack).toHaveBeenCalled();
  });

  it('enters preview mode on review click and allows playing preview', () => {
    const onCancel = vi.fn();
    const onSend = vi.fn();

    render(
      <VoiceRecorderBar
        channelId="c-1"
        onCancel={onCancel}
        onSendVoice={onSend}
        initialMediaStream={mockStream}
        initialMediaRecorder={mockRecorder}
      />
    );

    // Advance timer past minimum duration
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    const reviewBtn = screen.getByTestId('voice-review-button');
    fireEvent.click(reviewBtn);

    // Trigger recorder onstop
    act(() => {
      if (mockRecorder.onstop) mockRecorder.onstop();
    });

    expect(screen.getByTestId('voice-recorder-preview')).toBeDefined();
  });

  it('sends voice message when send is clicked', async () => {
    const onCancel = vi.fn();
    const onSend = vi.fn().mockResolvedValue(undefined);

    const uploadedAttachment: Attachment = {
      id: 'att-123',
      messageId: '',
      filename: 'voice-123.webm',
      originalName: 'voice-123.webm',
      mimetype: 'audio/webm',
      size: 5000,
      duration: 3,
      createdAt: Date.now(),
    };

    vi.spyOn(voiceUploadModule, 'uploadVoiceAttachment').mockResolvedValue(uploadedAttachment);

    render(
      <VoiceRecorderBar
        channelId="c-1"
        onCancel={onCancel}
        onSendVoice={onSend}
        initialMediaStream={mockStream}
        initialMediaRecorder={mockRecorder}
      />
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    const sendBtn = screen.getByTestId('voice-send-button');
    await act(async () => {
      fireEvent.click(sendBtn);
      if (mockRecorder.onstop) mockRecorder.onstop();
    });

    expect(onSend).toHaveBeenCalledWith(uploadedAttachment);
  });

  it('prevents sending empty/too-short recording (<0.5s)', () => {
    const onCancel = vi.fn();
    const onSend = vi.fn();
    const addToast = vi.spyOn(useUIStore.getState(), 'addToast');

    render(
      <VoiceRecorderBar
        channelId="c-1"
        onCancel={onCancel}
        onSendVoice={onSend}
        initialMediaStream={mockStream}
        initialMediaRecorder={mockRecorder}
      />
    );

    // Duration is 0s
    const sendBtn = screen.getByTestId('voice-send-button');
    fireEvent.click(sendBtn);

    expect(addToast).toHaveBeenCalledWith(expect.stringMatching(/too short/i), 'warning');
    expect(onCancel).toHaveBeenCalled();
  });
});
