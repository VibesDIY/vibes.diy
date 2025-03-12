import { useEffect, useRef, memo, useCallback, useMemo } from 'react';
import type { ChatMessage, AiChatMessage } from '../types/chat';
import ReactMarkdown from 'react-markdown';
import StructuredMessage from './StructuredMessage';
import { useSessionMessages } from '../hooks/useSessionMessages';

interface MessageListProps {
  sessionId: string | null;
  isStreaming: () => boolean;
  isShrinking?: boolean;
  isExpanding?: boolean;
}

// Shared utility function for rendering markdown content
// Extracted outside the component to prevent recreation on each render
const renderMarkdownContent = (text: string) => {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
};

// Individual message component to optimize rendering
const Message = memo(
  ({
    message,
    index,
    isShrinking,
    isExpanding,
  }: {
    message: ChatMessage;
    index: number;
    isShrinking: boolean;
    isExpanding: boolean;
  }) => {
    const isAI = message.type === 'ai';
    const isUser = message.type === 'user';

    // Extract the specific properties for AI messages
    const aiMessage = message as AiChatMessage;

    return (
      <div
        data-testid={`message-${index}`}
        className={`flex flex-row ${isAI ? 'justify-start' : 'justify-end'} mb-4 px-4`}
      >
        <div
          className={`rounded-lg px-4 py-2 max-w-[85%] ${
            isAI
              ? 'bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100'
              : 'bg-blue-500 text-white dark:bg-blue-600 dark:text-white'
          } ${isShrinking ? 'animate-width-shrink' : isExpanding ? 'animate-width-expand' : ''}`}
        >
          {isAI ? (
            <StructuredMessage segments={aiMessage.segments || []} isStreaming={aiMessage.isStreaming} />
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p>{message.text}</p>
            </div>
          )}
        </div>
      </div>
    );
  }
);

function MessageList({
  sessionId,
  isStreaming,
  isShrinking = false,
  isExpanding = false,
}: MessageListProps) {
  // Use the hook to get messages directly instead of through props
  const { messages, isLoading } = useSessionMessages(sessionId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    try {
      // Only run scrollIntoView if the element exists and the function is available
      if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (error) {
      console.error('Error scrolling into view:', error);
    }
  }, [messages]);

  // Check if there's a streaming message
  const hasStreamingMessage = useMemo(() => {
    return messages.some((msg) => msg.type === 'ai' && (msg as AiChatMessage).isStreaming);
  }, [messages]);

  // Only show typing indicator when no streaming message with content is visible yet
  const showTypingIndicator = useMemo(() => {
    if (!isStreaming()) return false;

    // Log the current state of messages for debugging
    console.debug(
      `🔍 MESSAGE LIST DEBUG: Total messages=${messages.length}, isStreaming=${isStreaming()}`
    );

    // IMPORTANT: Check if any AI message has segments with actual content
    const hasAnyContent = messages.some(
      (msg) => {
        if (msg.type === 'ai') {
          const aiMsg = msg as AiChatMessage;
          const hasText = aiMsg.text.length > 0;
          
          // Check if the message has any segments with actual content
          const hasSegmentsWithContent = 
            Array.isArray(aiMsg.segments) && 
            aiMsg.segments.length > 0 && 
            aiMsg.segments.some(segment => 
              segment && segment.content && segment.content.trim().length > 0
            );
          
          // Log individual message details for debugging
          console.debug(
            `🔍 AI MESSAGE: text length=${aiMsg.text.length}, segments=${aiMsg.segments?.length || 0}, ` +
            `hasContent=${hasText || hasSegmentsWithContent}, isStreaming=${aiMsg.isStreaming}`
          );
          
          if (aiMsg.segments && aiMsg.segments.length > 0) {
            aiMsg.segments.forEach((segment, i) => {
              if (segment) {
                console.debug(
                  `  Segment ${i}: type=${segment.type}, content length=${segment.content?.length || 0}`
                );
              }
            });
          }
          
          return hasText || hasSegmentsWithContent;
        }
        return false;
      }
    );

    // We only want to show the typing indicator if there's no content at all
    const shouldShowTypingIndicator = !hasAnyContent;

    console.debug(
      `🔍 DECISION: hasAnyContent=${hasAnyContent}, showTypingIndicator=${shouldShowTypingIndicator}`
    );

    return shouldShowTypingIndicator;
  }, [isStreaming, messages]);

  // Memoize the message list to prevent unnecessary re-renders
  const messageElements = useMemo(() => {
    return messages.map((msg, i) => {
      // Create a key that changes when content changes
      let contentKey = msg.text?.length || 0;
      
      // For AI messages, use segments information
      if (msg.type === 'ai') {
        const aiMsg = msg as AiChatMessage;
        contentKey = aiMsg.segments?.reduce((total, segment) => {
          return total + (segment?.content?.length || 0);
        }, 0) || 0;
      }

      return (
        <Message
          key={`${msg.type}-${i}-${msg.timestamp || i}-${contentKey}`}
          message={msg}
          index={i}
          isShrinking={isShrinking}
          isExpanding={isExpanding}
        />
      );
    });
  }, [messages, isShrinking, isExpanding]);

  // Show loading state while messages are being fetched
  if (isLoading && sessionId) {
    return (
      <div className="messages bg-light-background-01 dark:bg-dark-background-01 flex flex-1 items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-2">
          <div className="flex gap-1">
            <span className="bg-light-primary dark:bg-dark-primary h-2 w-2 animate-bounce rounded-full [animation-delay:-0.3s]" />
            <span className="bg-light-primary dark:bg-dark-primary h-2 w-2 animate-bounce rounded-full [animation-delay:-0.15s]" />
            <span className="bg-light-primary dark:bg-dark-primary h-2 w-2 animate-bounce rounded-full" />
          </div>
          <span className="text-sm text-gray-500">Loading messages...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex-1 overflow-y-auto ${
        isShrinking ? 'animate-width-shrink' : isExpanding ? 'animate-width-expand' : ''
      }`}
      ref={messagesEndRef}
    >
      <div className="mx-auto flex min-h-full max-w-5xl flex-col py-4">
        {messages.length === 0 && !isStreaming() ? (
          <div className="text-accent-02 mx-auto max-w-2xl space-y-4 px-12 pt-8 text-center italic">
            <h2 className="mb-4 text-xl font-semibold">Welcome to Fireproof App Builder</h2>
            <p>Ask me to generate a web application for you</p>
            <p>
              Quickly create React apps in your browser, no setup required. Apps are sharable, or
              eject them to GitHub for easy deploys.{' '}
              <a
                href="https://github.com/fireproof-storage/ai-app-builder"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-00 hover:underline"
              >
                Fork and customize this app builder
              </a>
              , no backend required.
            </p>

            <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
              <h3 className="py-2 text-lg font-semibold">About Fireproof</h3>
              <p className="text-sm">
                Fireproof enables secure saving and sharing of your data, providing encrypted live
                synchronization and offline-first capabilities. Learn more about{' '}
                <a
                  href="https://use-fireproof.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-00 hover:underline"
                >
                  Fireproof
                </a>
                .
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col space-y-4">
            {messageElements}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

// Only re-render when necessary to improve performance
export default memo(MessageList, (prevProps, nextProps) => {
  // Don't re-render if these props haven't changed
  return (
    prevProps.sessionId === nextProps.sessionId &&
    prevProps.isStreaming() === nextProps.isStreaming() &&
    prevProps.isShrinking === nextProps.isShrinking &&
    prevProps.isExpanding === nextProps.isExpanding
  );
});
