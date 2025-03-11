import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChatHeader from '../app/components/ChatHeader';
import SessionSidebar from '../app/components/SessionSidebar';
import MessageList from '../app/components/MessageList';
import type { ChatMessage } from '../app/types/chat';

// Mock dependencies
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

vi.mock('use-fireproof', () => ({
  useFireproof: () => ({
    database: {},
    useLiveQuery: () => ({ docs: [] }),
  }),
}));

// Create mock functions we can control
const onOpenSidebar = vi.fn();
const onToggleSidebar = vi.fn();
const onNewChat = vi.fn();
const onClose = vi.fn();
let isGeneratingValue = false;

describe('Component Rendering', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isGeneratingValue = false;
  });

  describe('ChatHeader', () => {
    it('renders without crashing', () => {
      render(
        <ChatHeader
          onOpenSidebar={onOpenSidebar}
          onNewChat={onNewChat}
          isGenerating={isGeneratingValue}
        />
      );
      expect(screen.getByLabelText('New Chat')).toBeInTheDocument();
    });

    it('applies tooltip classes correctly', () => {
      const { container } = render(
        <ChatHeader
          onOpenSidebar={onOpenSidebar}
          onNewChat={onNewChat}
          isGenerating={isGeneratingValue}
        />
      );

      // Check if the button has the peer class
      const button = screen.getByLabelText('New Chat');
      expect(button).toHaveClass('peer');

      // Check if the tooltip has correct classes
      const tooltip = container.querySelector('.absolute.top-full');
      expect(tooltip).toHaveClass('peer-hover:opacity-100');
    });

    it('disables new chat button when generating', () => {
      isGeneratingValue = true;
      render(
        <ChatHeader
          onOpenSidebar={onOpenSidebar}
          onNewChat={onNewChat}
          isGenerating={isGeneratingValue}
        />
      );
      expect(screen.getByLabelText('New Chat')).toBeDisabled();
    });
  });

  describe('SessionSidebar', () => {
    it('renders in hidden state', () => {
      const { container } = render(
        <SessionSidebar isVisible={false} onClose={onClose} />
      );
      // Check that it has the hidden class
      expect(container.firstChild).toHaveClass('-translate-x-full');
    });

    it('renders in visible state', () => {
      const { container } = render(
        <SessionSidebar isVisible={true} onClose={onClose} />
      );
      expect(container.firstChild).toHaveClass('translate-x-0');

      // Check that content is rendered when visible
      expect(screen.getByText('App History')).toBeInTheDocument();
    });

    it('shows empty state when no sessions', () => {
      render(
        <SessionSidebar isVisible={true} onClose={onClose} />
      );
      expect(screen.getByText('No saved sessions yet')).toBeInTheDocument();
    });
  });

  describe('MessageList', () => {
    it('renders empty list', () => {
      const { container } = render(
        <MessageList messages={[]} isGenerating={false} />
      );
      expect(container.querySelector('.messages')).toBeInTheDocument();
    });

    it('renders messages correctly', () => {
      const messages: ChatMessage[] = [
        { text: 'Hello', type: 'user' },
        { 
          text: 'Hi there', 
          type: 'ai',
          segments: [{ type: 'markdown', content: 'Hi there' }]
        },
      ];
      render(<MessageList messages={messages} isGenerating={false} />);
      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('Hi there')).toBeInTheDocument();
    });

    it('renders AI typing indicator when generating', () => {
      render(<MessageList messages={[]} isGenerating={true} />);
      expect(screen.getByText('Thinking')).toBeInTheDocument();
    });

    it('renders streaming message', () => {
      const messages: ChatMessage[] = [
        { 
          text: 'I am thinking...', 
          type: 'ai',
          segments: [{ type: 'markdown', content: 'I am thinking...' }],
          isStreaming: true
        }
      ];
      render(
        <MessageList messages={messages} isGenerating={true} />
      );
      expect(screen.getByText('I am thinking...')).toBeInTheDocument();
    });
  });
});
