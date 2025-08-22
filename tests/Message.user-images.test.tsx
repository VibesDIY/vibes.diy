import { vi, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Message from '../app/components/Message';
import type { ChatMessageDocument } from '../app/types/chat';
import { MockThemeProvider } from './utils/MockThemeProvider';

// Override the use-fireproof mock for this test to return image files
vi.mock('use-fireproof', () => {
  const db = {
    get: vi.fn().mockResolvedValue({
      _id: 'img1',
      _files: {
        image: {
          file: () =>
            Promise.resolve(new File([new Blob(['abc'])], 'a.png', { type: 'image/png' })),
          type: 'image/png',
        },
      },
    }),
  };
  return {
    useFireproof: vi.fn().mockReturnValue({ database: db }),
  };
});

// jsdom shim for createObjectURL
// @ts-ignore
global.URL.createObjectURL = global.URL.createObjectURL || (() => 'blob://test');

describe('Message renders user images', () => {
  it('shows attached images under user message', async () => {
    const msg: ChatMessageDocument = {
      _id: 'm1',
      type: 'user',
      session_id: 's1',
      text: 'Here is an image',
      created_at: Date.now(),
      images: ['img1'],
    } as any;

    render(
      <MockThemeProvider>
        <Message
          message={msg}
          isStreaming={false}
          setSelectedResponseId={() => {}}
          selectedResponseId=""
          setMobilePreviewShown={() => {}}
          navigateToView={() => {}}
        />
      </MockThemeProvider>
    );

    // The image element should render (ImgFile inside Message)
    const imgs = await screen.findAllByRole('img');
    // At least one image should exist (preview or message image)
    expect(imgs.length).toBeGreaterThan(0);
  });
});
