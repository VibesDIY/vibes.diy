import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { AuthWall } from '@vibes.diy/use-vibes-base';

// Mock the Image constructor to control load/error behavior
class MockImage {
  src: string = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    // Simulate async behavior
    setTimeout(() => {
      if (this.src.includes('broken-image.jpg')) {
        this.onerror?.();
      } else {
        this.onload?.();
      }
    }, 0);
  }
}

describe('AuthWall Image Fallback', () => {
  const mockOnLogin = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    // Replace global Image with our mock
    globalThis.Image = MockImage as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should use the provided imageUrl when image loads successfully', async () => {
    const { container } = render(
      <AuthWall
        onLogin={mockOnLogin}
        imageUrl="https://example.com/valid-image.jpg"
        title="Test Auth"
        open={true}
      />
    );

    await waitFor(() => {
      const wrapper = container.firstChild as HTMLElement;
      const backgroundImage = getComputedStyle(wrapper).backgroundImage;
      expect(backgroundImage).toContain('https://example.com/valid-image.jpg');
    });
  });

  it('should fallback to Unsplash image when imageUrl fails to load', async () => {
    const { container } = render(
      <AuthWall
        onLogin={mockOnLogin}
        imageUrl="https://example.com/broken-image.jpg"
        title="Test Auth"
        open={true}
      />
    );

    await waitFor(() => {
      const wrapper = container.firstChild as HTMLElement;
      const backgroundImage = getComputedStyle(wrapper).backgroundImage;
      expect(backgroundImage).toContain('images.unsplash.com');
      expect(backgroundImage).toContain('photo-1518837695005-2083093ee35b');
    }, { timeout: 1000 });
  });

  it('should fallback for screenshot.png URL when it fails', async () => {
    // Override the Image mock specifically for this test
    globalThis.Image = class {
      src: string = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor() {
        setTimeout(() => {
          if (this.src.includes('screenshot.png')) {
            this.onerror?.();
          } else {
            this.onload?.();
          }
        }, 0);
      }
    } as any;

    const { container } = render(
      <AuthWall
        onLogin={mockOnLogin}
        imageUrl="/screenshot.png"
        title="Test Auth"
        open={true}
      />
    );

    await waitFor(() => {
      const wrapper = container.firstChild as HTMLElement;
      const backgroundImage = getComputedStyle(wrapper).backgroundImage;
      expect(backgroundImage).toContain('images.unsplash.com');
    }, { timeout: 1000 });
  });

  it('should handle imageUrl prop changes', async () => {
    const { container, rerender } = render(
      <AuthWall
        onLogin={mockOnLogin}
        imageUrl="https://example.com/image1.jpg"
        title="Test Auth"
        open={true}
      />
    );

    // Wait for initial image to load
    await waitFor(() => {
      const wrapper = container.firstChild as HTMLElement;
      const backgroundImage = getComputedStyle(wrapper).backgroundImage;
      expect(backgroundImage).toContain('image1.jpg');
    });

    // Change to a broken image
    rerender(
      <AuthWall
        onLogin={mockOnLogin}
        imageUrl="https://example.com/broken-image.jpg"
        title="Test Auth"
        open={true}
      />
    );

    // Should fallback to Unsplash
    await waitFor(() => {
      const wrapper = container.firstChild as HTMLElement;
      const backgroundImage = getComputedStyle(wrapper).backgroundImage;
      expect(backgroundImage).toContain('images.unsplash.com');
    }, { timeout: 1000 });
  });

  it('should not cause double-loading with hidden img element', () => {
    const { container } = render(
      <AuthWall
        onLogin={mockOnLogin}
        imageUrl="https://example.com/test.jpg"
        title="Test Auth"
        open={true}
      />
    );

    // Ensure there's no hidden img element that would cause double-loading
    const hiddenImages = container.querySelectorAll('img[style*="display: none"]');
    expect(hiddenImages).toHaveLength(0);
  });
});