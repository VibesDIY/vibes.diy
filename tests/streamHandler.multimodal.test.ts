import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock call-ai to capture messages
const callAIMock = vi.fn();
vi.mock('call-ai', () => ({
  callAI: (...args: any[]) => callAIMock(...args),
}));

import { streamAI } from '../app/utils/streamHandler';

function makeFile(content = 'img'): File {
  const blob = new Blob([content], { type: 'image/png' });
  return new File([blob], 'a.png', { type: 'image/png' });
}

describe('streamAI multimodal', () => {
  beforeEach(() => {
    callAIMock.mockReset();
  });

  it('includes image_url segments when userImageIds provided', async () => {
    const db = {
      get: vi.fn().mockResolvedValue({
        _id: 'img1',
        _files: {
          image: { file: () => Promise.resolve(makeFile()), type: 'image/png' },
        },
      }),
    };

    callAIMock.mockResolvedValue('ok');

    await streamAI(
      'openai/gpt-4o-mini',
      'sys',
      [{ role: 'system', content: 's' } as any],
      'hello',
      () => {},
      'sk',
      'u',
      undefined,
      ['img1'],
      db
    );

    expect(callAIMock).toHaveBeenCalled();
    const [messages] = callAIMock.mock.calls[0];
    const last = messages[messages.length - 1];
    expect(Array.isArray(last.content)).toBe(true);
    // should include a text and an image_url
    expect(last.content.some((s: any) => s.type === 'text')).toBe(true);
    expect(last.content.some((s: any) => s.type === 'image_url')).toBe(true);
  });
});
