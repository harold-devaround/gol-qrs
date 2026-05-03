// @ts-nocheck
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initImageViewer } from '../js/viewers/image-viewer.js';

let container;

beforeEach(() => {
  document.body.innerHTML = '';
  container = document.createElement('div');
  document.body.appendChild(container);
});

describe('initImageViewer', () => {
  it('renders the title via textContent (no HTML interpretation)', () => {
    initImageViewer(container, {
      title: '<script>alert(1)</script>',
      images: [],
    });
    const h2 = container.querySelector('.viewer-header h2');
    expect(h2.textContent).toBe('<script>alert(1)</script>');
    // No script element is created — the angle brackets are escaped text.
    expect(container.querySelectorAll('script').length).toBe(0);
  });

  it('renders an image card per entry with safe text content', () => {
    initImageViewer(container, {
      title: 'Gallery',
      images: [
        { name: '<img onerror="alert(1)">', thumb: 'a.jpg', full: 'A.jpg' },
        { name: 'B', thumb: 'b.jpg', full: 'B.jpg' },
      ],
    });
    const cards = container.querySelectorAll('.viewer-card');
    expect(cards.length).toBe(2);
    // The malicious name is set via textContent on the label, never parsed as HTML.
    expect(cards[0].querySelector('.viewer-card-label').textContent).toBe('<img onerror="alert(1)">');
    // Only the gallery img element exists for that card (no injected one).
    expect(cards[0].querySelectorAll('img').length).toBe(1);
  });

  it('image src/alt are set via DOM properties (no attribute injection)', () => {
    initImageViewer(container, {
      title: 'X',
      images: [{ name: 'a" onerror="x', thumb: 'thumb"x"', full: 'full' }],
    });
    const imgEl = container.querySelector('.viewer-card img');
    // The src/alt attributes must contain the literal user string (no HTML break).
    expect(imgEl.alt).toBe('a" onerror="x');
    expect(imgEl.getAttribute('src')).toBe('thumb"x"');
    expect(imgEl.hasAttribute('onerror')).toBe(false);
  });

  it('shows the image count in the header', () => {
    initImageViewer(container, {
      title: 'Gallery',
      images: [
        { name: '1', thumb: '', full: '' },
        { name: '2', thumb: '', full: '' },
        { name: '3', thumb: '', full: '' },
      ],
    });
    expect(container.querySelector('.viewer-count').textContent).toBe('3 images');
  });

  it('opens a lightbox when a card is clicked', () => {
    initImageViewer(container, {
      title: 'X',
      images: [{ name: 'pic', thumb: 't', full: 'F' }],
    });
    expect(container.querySelector('.viewer-lightbox')).toBeNull();
    container.querySelector('.viewer-card').click();
    const lb = container.querySelector('.viewer-lightbox');
    expect(lb).not.toBeNull();
    expect(lb.querySelector('img').getAttribute('src')).toBe('F');
    expect(lb.querySelector('.lb-label').textContent).toBe('pic');
  });

  it('closes the lightbox on backdrop click', () => {
    initImageViewer(container, {
      title: 'X',
      images: [{ name: 'pic', thumb: 't', full: 'F' }],
    });
    container.querySelector('.viewer-card').click();
    expect(container.querySelector('.viewer-lightbox')).not.toBeNull();
    container.querySelector('.lb-backdrop').click();
    expect(container.querySelector('.viewer-lightbox')).toBeNull();
  });

  it('closes the lightbox on close-button click', () => {
    initImageViewer(container, {
      title: 'X',
      images: [{ name: 'pic', thumb: 't', full: 'F' }],
    });
    container.querySelector('.viewer-card').click();
    container.querySelector('.lb-close').click();
    expect(container.querySelector('.viewer-lightbox')).toBeNull();
  });

  it('closes the lightbox on Escape key', () => {
    initImageViewer(container, {
      title: 'X',
      images: [{ name: 'pic', thumb: 't', full: 'F' }],
    });
    container.querySelector('.viewer-card').click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(container.querySelector('.viewer-lightbox')).toBeNull();
  });

  it('replaces an existing lightbox when opening a new one', () => {
    initImageViewer(container, {
      title: 'X',
      images: [
        { name: 'a', thumb: 'a', full: 'A' },
        { name: 'b', thumb: 'b', full: 'B' },
      ],
    });
    const cards = container.querySelectorAll('.viewer-card');
    cards[0].click();
    cards[1].click();
    const lbs = container.querySelectorAll('.viewer-lightbox');
    expect(lbs.length).toBe(1);
    expect(lbs[0].querySelector('img').getAttribute('src')).toBe('B');
  });

  it('removes the keydown listener after close (no leaks)', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    initImageViewer(container, {
      title: 'X',
      images: [{ name: 'pic', thumb: 't', full: 'F' }],
    });
    container.querySelector('.viewer-card').click();
    container.querySelector('.lb-close').click();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
