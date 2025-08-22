import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatInput from '../app/components/ChatInput';
import type { ChatState } from '../app/types/chat';
import { MockThemeProvider } from './utils/MockThemeProvider';

describe('ChatInput image attachments', () => {
  let mockChatState: ChatState;
  const onSend = vi.fn();
  const inputRef = { current: null } as any;

  beforeEach(() => {
    vi.resetAllMocks();
    mockChatState = {
      isEmpty: true,
      input: '',
      isStreaming: false,
      inputRef,
      docs: [],
      setInput: vi.fn(),
      sendMessage: vi.fn(),
      saveCodeAsAiMessage: vi.fn().mockResolvedValue('test-message-id'),
      codeReady: false,
      title: '',
      updateTitle: vi.fn(),
      addScreenshot: vi.fn(),
      setSelectedResponseId: vi.fn(),
      selectedSegments: [],
      immediateErrors: [],
      advisoryErrors: [],
      addError: vi.fn(),
      sessionId: 's1',
      // image state
      attachedImages: [],
      attachImages: vi.fn().mockResolvedValue(['img1']),
      removeAttachedImage: vi.fn().mockResolvedValue(undefined),
      clearAttachedImages: vi.fn(),
    } as unknown as ChatState;
  });

  it('calls attachImages when selecting files via the button', async () => {
    render(
      <MockThemeProvider>
        <ChatInput chatState={mockChatState} onSend={onSend} />
      </MockThemeProvider>
    );

    // The input is hidden; query it by type
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    // Simulate user picking a file
    const file = new File([new Blob(['abc'])], 'a.png', { type: 'image/png' });
    // Fire change event with files
    await fireEvent.change(fileInput, { target: { files: [file] } });

    expect(mockChatState.attachImages).toHaveBeenCalled();
  });

  it('supports drag-and-drop to attach images', async () => {
    render(
      <MockThemeProvider>
        <ChatInput chatState={mockChatState} onSend={onSend} />
      </MockThemeProvider>
    );

    const textArea = screen.getByPlaceholderText('I want to build...');
    const file = new File([new Blob(['abc'])], 'a.png', { type: 'image/png' });
    const data = {
      dataTransfer: {
        files: [file],
      },
    } as any;

    await fireEvent.drop(textArea, data);

    expect(mockChatState.attachImages).toHaveBeenCalled();
  });

  it('renders ImagePreview and removes images', async () => {
    mockChatState.attachedImages = [
      { id: 'img1', previewUrl: 'blob://1', mimeType: 'image/png' },
      { id: 'img2', previewUrl: 'blob://2', mimeType: 'image/jpeg' },
    ];

    render(
      <MockThemeProvider>
        <ChatInput chatState={mockChatState} onSend={onSend} />
      </MockThemeProvider>
    );

    // Two remove buttons exist
    const removeBtns = screen.getAllByRole('button', { name: /remove image/i });
    expect(removeBtns.length).toBe(2);
    await fireEvent.click(removeBtns[0]);
    expect(mockChatState.removeAttachedImage).toHaveBeenCalledWith('img1');
  });
});
