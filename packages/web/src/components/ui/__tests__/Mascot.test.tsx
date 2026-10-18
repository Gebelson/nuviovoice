// packages/web/src/components/ui/__tests__/Mascot.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Mascot } from '../Mascot';

describe('Mascot', () => {
  it('renders a video element with presentation role and aria-hidden for idle state', () => {
    const { container } = render(<Mascot state="idle" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute('role')).toBe('presentation');
    const video = wrapper.querySelector('video');
    expect(video).toBeTruthy();
    expect(video!.getAttribute('src')).toBe('/animations/mascot.webm');
    expect(video!.getAttribute('aria-hidden')).toBe('true');
    expect(video!.hasAttribute('autoplay')).toBe(true);
    expect(video!.hasAttribute('loop')).toBe(true);
    expect(video!.hasAttribute('muted')).toBe(true);
    expect(video!.hasAttribute('playsinline')).toBe(true);
  });

  it('renders a video element with presentation role and aria-hidden for sleeping state', () => {
    const { container } = render(<Mascot state="sleeping" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute('role')).toBe('presentation');
    const video = wrapper.querySelector('video');
    expect(video).toBeTruthy();
    expect(video!.getAttribute('src')).toBe('/animations/mascot-sleeping.webm');
    expect(video!.getAttribute('aria-hidden')).toBe('true');
    expect(video!.hasAttribute('autoplay')).toBe(true);
    expect(video!.hasAttribute('loop')).toBe(true);
    expect(video!.hasAttribute('muted')).toBe(true);
    expect(video!.hasAttribute('playsinline')).toBe(true);
  });

  it('renders an SVG with aria-hidden and presentation role for SVG states', () => {
    const { container } = render(<Mascot state="excited" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute('role')).toBe('presentation');
    const svg = wrapper.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
  });

  it('applies excited palette gradient stops', () => {
    const { container } = render(<Mascot state="excited" />);
    const stops = container.querySelectorAll('stop');
    const colors = Array.from(stops).map(s => s.getAttribute('stop-color'));
    expect(colors).toContain('#fde0c8');
    expect(colors).toContain('#e8a870');
  });

  it('applies lonely palette gradient stops', () => {
    const { container } = render(<Mascot state="lonely" />);
    const stops = container.querySelectorAll('stop');
    const colors = Array.from(stops).map(s => s.getAttribute('stop-color'));
    expect(colors).toContain('#c0dced');
    expect(colors).toContain('#78aec8');
  });

  it('renders upright viewBox for excited state', () => {
    const { container } = render(<Mascot state="excited" />);
    const svg = container.querySelector('svg');
    expect(svg!.getAttribute('viewBox')).toBe('0 0 200 200');
  });

  it('renders open eyes (ellipses) for excited state', () => {
    const { container } = render(<Mascot state="excited" />);
    const eyeWhites = container.querySelectorAll('[data-eye="white"]');
    expect(eyeWhites.length).toBe(2);
  });

  it('renders a ground shadow for SVG states', () => {
    const { container } = render(<Mascot state="excited" />);
    const shadow = container.querySelector('[data-mascot="shadow"]');
    expect(shadow).toBeTruthy();
  });

  it('applies custom className replacing default size', () => {
    const { container } = render(<Mascot state="idle" className="w-48 h-48" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('w-48');
    expect(wrapper.className).toContain('h-48');
    // Custom className replaces default w-32 h-32 to avoid Tailwind conflicts
    expect(wrapper.className).not.toContain('w-32');
  });

  it('uses default w-32 h-32 when no className provided', () => {
    const { container } = render(<Mascot state="idle" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('w-32');
    expect(wrapper.className).toContain('h-32');
  });


  it('renders the upright mouth as a path for excited', () => {
    const { container } = render(<Mascot state="excited" />);
    const mouth = container.querySelector('[data-mascot="mouth"]');
    expect(mouth).toBeTruthy();
    expect(mouth!.tagName.toLowerCase()).toBe('path');
  });

  describe('Mascot animation lifecycle', () => {
    it('renders without crashing when element.animate is unavailable (jsdom)', () => {
      expect(() => render(<Mascot state="idle" />)).not.toThrow();
    });

    it('renders without crashing for each state', () => {
      for (const state of ['idle', 'sleeping', 'excited', 'lonely'] as const) {
        const { unmount } = render(<Mascot state={state} />);
        unmount();
      }
    });
  });
});
