import type { Meta, StoryObj } from "@storybook/react";
import React, { useRef, useState } from "react";
import ChatInput, { ChatInputRef } from "../app/components/ChatInput.js";
import type { ChatState } from "@vibes.diy/prompts";

// Mock wrapper component for Storybook
function ChatInputWrapper({
  initialInput = "",
  isStreaming = false,
  // placeholder = "I want to build...",
}: {
  initialInput?: string;
  isStreaming?: boolean;
  placeholder?: string;
}) {
  const [input, setInput] = useState(initialInput);
  const inputRef = useRef<ChatInputRef>(null);

  const mockChatState: ChatState = {
    isEmpty: input.length === 0,
    docs: [],
    input,
    setInput,
    isStreaming,
    codeReady: false,
    inputRef,
    sendMessage: async (text?: string) => {
      console.log("Mock sendMessage called with:", text || input);
    },
    saveCodeAsAiMessage: async () => "mock-id",
    title: "",
    addScreenshot: async () => {
      /* no-op */
    },
    sessionId: "mock-session",
    setSelectedResponseId: () => {
      /* no-op */
    },
    immediateErrors: [],
    advisoryErrors: [],
    addError: () => {
      /* no-op */
    },
    updateTitle: (_title: string, _isManual?: boolean): Promise<void> => {
      throw new Error("Function not implemented.");
    },
  };

  return (
    <ChatInput
      chatState={mockChatState}
      onSend={() => console.log("onSend called")}
    />
  );
}

const meta = {
  title: "Components/ChatInput",
  component: ChatInputWrapper,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A chat input component with auto-resizing textarea and submit functionality. Supports both controlled and uncontrolled usage.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    initialInput: {
      description: "Initial input text value",
      control: "text",
    },
    isStreaming: {
      description: "Whether the component is in streaming/loading state",
      control: "boolean",
    },
    placeholder: {
      description: "Placeholder text for the input",
      control: "text",
    },
  },
} satisfies Meta<typeof ChatInputWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default story
export const Default: Story = {
  args: {
    placeholder: "I want to build...",
  },
};

// With initial value
export const WithValue: Story = {
  args: {
    initialInput: "Create a todo app with React",
    placeholder: "I want to build...",
  },
};

// Streaming state
export const Streaming: Story = {
  args: {
    initialInput: "Building your app...",
    isStreaming: true,
    placeholder: "I want to build...",
  },
};

// Continue coding placeholder
export const ContinueCoding: Story = {
  args: {
    placeholder: "Continue coding...",
  },
};

// Long text example
export const LongText: Story = {
  args: {
    initialInput: `Create a comprehensive todo application with the following features:
- Add new tasks with categories
- Mark tasks as complete/incomplete  
- Filter tasks by status and category
- Search functionality
- Drag and drop reordering
- Local storage persistence
- Dark/light theme toggle
- Export tasks to JSON`,
    placeholder: "I want to build...",
  },
};

// Interactive example with ref
export const WithRefActions: Story = {
  render: (args: { isStreaming?: boolean }) => {
    const inputRef = useRef<ChatInputRef>(null);
    const [input, setInput] = useState("");

    const mockChatState: ChatState = {
      isEmpty: input.length === 0,
      docs: [],
      input,
      setInput,
      isStreaming: args.isStreaming || false,
      codeReady: false,
      inputRef,
      sendMessage: async (text?: string) => {
        console.log("Mock sendMessage called with:", text || input);
      },
      saveCodeAsAiMessage: async () => "mock-id",
      title: "",
      addScreenshot: async () => {
        /* no-op */
      },
      sessionId: "mock-session",
      setSelectedResponseId: () => {
        /* no-op */
      },
      immediateErrors: [],
      advisoryErrors: [],
      addError: () => {
        /* no-op */
      },
      updateTitle: (_title: string, _isManual?: boolean): Promise<void> => {
        throw new Error("Function not implemented.");
      },
    };

    const handleFocus = () => {
      inputRef.current?.focus();
    };

    const handleClickSubmit = () => {
      inputRef.current?.clickSubmit();
    };

    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            onClick={handleFocus}
            className="rounded bg-blue-500 px-3 py-1 text-white hover:bg-blue-600"
          >
            Focus Input
          </button>
          <button
            onClick={handleClickSubmit}
            className="rounded bg-green-500 px-3 py-1 text-white hover:bg-green-600"
          >
            Click Submit
          </button>
        </div>
        <ChatInput
          chatState={mockChatState}
          onSend={() => console.log("onSend called")}
          ref={inputRef}
        />
      </div>
    );
  },
  args: {
    placeholder: "Try the action buttons above...",
  },
};
