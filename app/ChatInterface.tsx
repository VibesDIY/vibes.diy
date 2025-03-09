import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import type { ChatMessage, SessionDocument } from './types/chat';
import { useFireproof } from 'use-fireproof';
import SessionSidebar from './components/SessionSidebar';
import ChatHeader from './components/ChatHeader';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import QuickSuggestions from './components/QuickSuggestions';

interface ChatInterfaceProps {
  chatState: {
    messages: ChatMessage[];
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    input: string;
    setInput: React.Dispatch<React.SetStateAction<string>>;
    isGenerating: boolean;
    currentStreamedText: string;
    streamingCode: string;
    completedCode: string;
    isStreaming: boolean;
    inputRef: React.RefObject<HTMLTextAreaElement | null>;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    autoResizeTextarea: () => void;
    scrollToBottom: () => void;
    sendMessage: () => Promise<void>;
    parserState: React.MutableRefObject<{
      inCodeBlock: boolean;
      codeBlockContent: string;
      dependencies: Record<string, string>;
      displayText: string;
      on: (event: string, callback: Function) => void;
      removeAllListeners: () => void;
      write: (chunk: string) => void;
      end: () => void;
      reset: () => void;
    }>;
    completedMessage: string;
  };
  sessionId?: string | null;
  onSessionCreated?: (newSessionId: string) => void;
  onNewChat?: () => void;
  onCodeGenerated?: (code: string, dependencies?: Record<string, string>) => void;
}

// ChatInterface component handles user input and displays chat messages
function ChatInterface({
  chatState,
  sessionId,
  onSessionCreated,
  onNewChat,
  onCodeGenerated,
}: ChatInterfaceProps) {
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [isShrinking, setIsShrinking] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const { database, useLiveQuery } = useFireproof('fireproof-chat-history');

  const {
    messages,
    setMessages,
    setInput,
    isGenerating,
    currentStreamedText,
    inputRef,
    autoResizeTextarea,
    sendMessage,
  } = chatState;

  // Query chat sessions ordered by timestamp (newest first)
  const { docs: sessions } = useLiveQuery('timestamp', {
    descending: true,
  });

  // Memoize handler functions to prevent re-renders
  const handleSelectSuggestion = useCallback(
    (suggestion: string) => {
      setInput(suggestion);
      // Focus the input after setting the value
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // Move cursor to the end
          const length = suggestion.length;
          inputRef.current.selectionStart = length;
          inputRef.current.selectionEnd = length;
        }
      }, 0);
    },
    [inputRef, setInput]
  );

  const toggleSidebar = useCallback(() => {
    setIsSidebarVisible((prev) => !prev);
  }, []);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  // Auto-resize textarea when input changes
  useEffect(() => {
    autoResizeTextarea();
  }, [autoResizeTextarea]);

  // Load session data when sessionId changes
  useEffect(() => {
    async function loadSessionData() {
      if (sessionId) {
        try {
          const sessionData = (await database.get(sessionId)) as SessionDocument;
          if (sessionData?.messages && Array.isArray(sessionData.messages)) {
            setMessages(sessionData.messages);
          }
        } catch (err) {
          console.error('Error loading session:', err);
        }
      }
    }

    loadSessionData();
  }, [sessionId, database, setMessages]);

  // Track streaming state to detect when streaming completes
  const wasGeneratingRef = useRef(isGenerating);

  // Save messages to Fireproof ONLY when streaming completes or on message count change
  useEffect(() => {
    async function saveSessionData() {
      // Only save when streaming just completed (wasGenerating was true, but isGenerating is now false)
      const streamingJustCompleted = wasGeneratingRef.current && !isGenerating;

      if (messages.length > 0 && streamingJustCompleted) {
        console.log('Saving completed session to Fireproof - streaming completed');

        // Extract title from first user message
        const firstUserMessage = messages.find((msg) => msg.type === 'user');
        const title = firstUserMessage
          ? `${firstUserMessage.text.substring(0, 50)}${firstUserMessage.text.length > 50 ? '...' : ''}`
          : 'Untitled Chat';

        try {
          // If we have a session ID, update it; otherwise create a new one
          const sessionData = {
            title,
            messages,
            timestamp: Date.now(),
            ...(sessionId ? { _id: sessionId } : {}),
          };

          const result = await database.put(sessionData);

          // If this was a new session, notify the parent component
          if (!sessionId && onSessionCreated) {
            onSessionCreated(result.id);
          }
        } catch (error) {
          console.error('Error saving session to Fireproof:', error);
        }
      }

      // Update ref for next comparison
      wasGeneratingRef.current = isGenerating;
    }

    saveSessionData();
  }, [isGenerating, messages, sessionId, database, onSessionCreated]);

  // Load a session from the sidebar
  const handleLoadSession = useCallback(
    async (session: SessionDocument) => {
      if (!session?._id) return;

      try {
        const sessionData = (await database.get(session._id)) as SessionDocument;
        if (sessionData?.messages && Array.isArray(sessionData.messages)) {
          setMessages(sessionData.messages);

          // Find the last AI message with code to update the editor
          const lastAiMessageWithCode = [...sessionData.messages]
            .reverse()
            .find((msg: ChatMessage) => msg.type === 'ai' && msg.code);

          // If we found an AI message with code, update the code view
          if (lastAiMessageWithCode?.code) {
            const dependencies = lastAiMessageWithCode.dependencies || {};
            console.log('Loading code from session:', lastAiMessageWithCode.code);

            // 1. Update local chatState
            chatState.streamingCode = lastAiMessageWithCode.code;
            chatState.completedCode = lastAiMessageWithCode.code;
            chatState.parserState.current.dependencies = dependencies;
            chatState.isStreaming = false;
            chatState.isGenerating = false;

            // Manually extract the UI code for app preview
            chatState.completedMessage = lastAiMessageWithCode.text || "Here's your app:";

            // 2. Call the onCodeGenerated callback to update parent state
            if (onCodeGenerated) {
              onCodeGenerated(lastAiMessageWithCode.code, dependencies);
              console.log('Called onCodeGenerated to update parent component');
            }
          }

          // Notify parent component of session change
          if (onSessionCreated) {
            onSessionCreated(session._id);
          }
        }
      } catch (err) {
        console.error('Error loading session:', err);
      }
    },
    [database, setMessages, onSessionCreated, chatState, onCodeGenerated]
  );

  // Function to handle starting a new chat
  const handleNewChat = useCallback(() => {
    // Start the shrinking animation
    setIsShrinking(true);

    // After animation completes, reset the state
    setTimeout(
      () => {
        // Use parent's onNewChat if provided
        if (onNewChat) {
          onNewChat();
        } else {
          setMessages([]);
          setInput('');
        }

        setIsShrinking(false);

        // Add a small bounce effect when the new chat appears
        setIsExpanding(true);
        setTimeout(() => {
          setIsExpanding(false);
        }, 300);

        // Refresh the page and navigate to the root URL
        window.location.href = '/';
      },
      500 + messages.length * 50
    ); // Account for staggered animation of messages
  }, [onNewChat, messages.length, setInput, setMessages, setIsShrinking, setIsExpanding]);

  // Memoize child components to prevent unnecessary re-renders
  const sessionSidebar = useMemo(
    () => (
      <SessionSidebar
        isVisible={isSidebarVisible}
        onToggle={toggleSidebar}
        onSelectSession={handleLoadSession}
      />
    ),
    [isSidebarVisible, toggleSidebar, handleLoadSession]
  );

  const chatHeader = useMemo(
    () => (
      <ChatHeader
        onToggleSidebar={toggleSidebar}
        onNewChat={handleNewChat}
        isGenerating={isGenerating}
      />
    ),
    [toggleSidebar, handleNewChat, isGenerating]
  );

  const messageList = useMemo(
    () => (
      <MessageList
        messages={messages}
        isGenerating={isGenerating}
        currentStreamedText={currentStreamedText}
        isShrinking={isShrinking}
        isExpanding={isExpanding}
      />
    ),
    [messages, isGenerating, currentStreamedText, isShrinking, isExpanding]
  );

  const quickSuggestions = useMemo(
    () => messages.length === 0 && <QuickSuggestions onSelectSuggestion={handleSelectSuggestion} />,
    [messages.length, handleSelectSuggestion]
  );

  const chatInput = useMemo(
    () => (
      <ChatInput
        input={input}
        setInput={setInput}
        isGenerating={isGenerating}
        onSend={sendMessage}
        autoResizeTextarea={autoResizeTextarea}
        inputRef={inputRef}
      />
    ),
    [input, setInput, isGenerating, sendMessage, autoResizeTextarea, inputRef]
  );

  return (
    <div className="flex h-full flex-col" style={{ overflow: 'hidden' }}>
      {/* SessionSidebar component */}
      {sessionSidebar}

      <div
        className="chat-interface bg-light-background-00 dark:bg-dark-background-00 flex h-full flex-col"
        style={{ overflow: 'hidden' }}
      >
        {/* Header */}
        {chatHeader}

        {/* Messages */}
        {messageList}

        {/* Quick access buttons */}
        {quickSuggestions}

        {/* Input area */}
        {chatInput}
      </div>
    </div>
  );
}

export default ChatInterface;
