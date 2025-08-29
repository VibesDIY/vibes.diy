import type { Meta, StoryObj } from "@storybook/react";
import React, { useState } from "react";
import StructuredMessage from "../app/components/StructuredMessage.js";
import type { Segment, ViewType } from "@vibes.diy/prompts";

// Mock wrapper component for Storybook
const StructuredMessageWrapper = ({
  segments,
  isStreaming = false,
  isLatestMessage = false,
  initialSelectedResponseId = "test-message-1",
}: {
  segments: Segment[];
  isStreaming?: boolean;
  isLatestMessage?: boolean;
  initialSelectedResponseId?: string;
}) => {
  const [selectedResponseId, setSelectedResponseId] = useState(
    initialSelectedResponseId,
  );
  const [mobilePreviewShown, setMobilePreviewShown] = useState(false);

  const mockNavigateToView = (view: ViewType) => {
    console.log(`Navigate to view: ${view}`);
  };

  const mockSetSelectedResponseId = (id: string) => {
    console.log(`Selected response ID: ${id}`);
    setSelectedResponseId(id);
  };

  const mockSetMobilePreviewShown = (shown: boolean) => {
    console.log(`Mobile preview shown: ${shown}`);
    setMobilePreviewShown(shown);
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Selected Response ID: {selectedResponseId} | Mobile Preview:{" "}
        {mobilePreviewShown.toString()}
      </div>
      <StructuredMessage
        segments={segments}
        isStreaming={isStreaming}
        messageId="test-message-1"
        setSelectedResponseId={mockSetSelectedResponseId}
        selectedResponseId={selectedResponseId}
        setMobilePreviewShown={mockSetMobilePreviewShown}
        rawText={segments.map((s) => s.content).join("\n\n")}
        navigateToView={mockNavigateToView}
        isLatestMessage={isLatestMessage}
      />
    </div>
  );
};

const meta = {
  title: "Components/StructuredMessage",
  component: StructuredMessageWrapper,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A component for displaying structured messages with markdown and code segments. Supports interactive code segments with selection, copying, and view navigation.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    segments: {
      description: "Array of segments (markdown/code) to display",
      control: "object",
    },
    isStreaming: {
      description: "Whether the message is currently streaming",
      control: "boolean",
    },
    isLatestMessage: {
      description:
        "Whether this is the latest message (shows streaming indicator)",
      control: "boolean",
    },
    initialSelectedResponseId: {
      description: "Initial selected response ID for highlighting",
      control: "text",
    },
  },
} satisfies Meta<typeof StructuredMessageWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

// Sample segments for stories
const markdownSegment: Segment = {
  type: "markdown",
  content: `I'll help you create a todo app. Here's what we'll build:

## Features
- Add new tasks
- Mark tasks as complete
- Delete tasks
- Filter by status

Let me start with the code:`,
};

const codeSegment: Segment = {
  type: "code",
  content: `import React, { useState } from 'react';

function TodoApp() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');

  const addTodo = () => {
    if (input.trim()) {
      setTodos([...todos, { 
        id: Date.now(), 
        text: input, 
        completed: false 
      }]);
      setInput('');
    }
  };

  const toggleTodo = (id) => {
    setTodos(todos.map(todo => 
      todo.id === id 
        ? { ...todo, completed: !todo.completed }
        : todo
    ));
  };

  const deleteTodo = (id) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Todo App</h1>
      
      <div className="flex mb-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          className="flex-1 p-2 border rounded"
          placeholder="Add a new todo..."
        />
        <button
          onClick={addTodo}
          className="ml-2 px-4 py-2 bg-blue-500 text-white rounded"
        >
          Add
        </button>
      </div>

      <ul className="space-y-2">
        {todos.map(todo => (
          <li key={todo.id} className="flex items-center">
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
              className="mr-2"
            />
            <span className={todo.completed ? 'line-through' : ''}>
              {todo.text}
            </span>
            <button
              onClick={() => deleteTodo(todo.id)}
              className="ml-auto px-2 py-1 bg-red-500 text-white rounded text-sm"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default TodoApp;`,
};

const shortCodeSegment: Segment = {
  type: "code",
  content: `const greeting = "Hello, World!";
console.log(greeting);`,
};

const longMarkdownSegment: Segment = {
  type: "markdown",
  content: `# Complete Todo Application

This todo application includes several advanced features:

## Core Functionality
1. **Task Management**: Add, edit, delete tasks
2. **Status Tracking**: Mark tasks as complete/incomplete
3. **Persistence**: Local storage integration
4. **Filtering**: View all, active, or completed tasks

## Technical Implementation
- **React Hooks**: useState, useEffect for state management
- **TypeScript**: Full type safety throughout
- **Tailwind CSS**: Responsive styling
- **Local Storage**: Data persistence between sessions

## Usage Instructions
1. Type your task in the input field
2. Press Enter or click Add to create the task
3. Click the checkbox to mark tasks complete
4. Use the Delete button to remove tasks
5. Filter tasks using the status buttons

The application is fully responsive and works across all devices.`,
};

// Empty/loading states
export const Loading: Story = {
  args: {
    segments: [],
    isStreaming: true,
    isLatestMessage: true,
  },
};

export const EmptySegments: Story = {
  args: {
    segments: [
      { type: "markdown", content: "" },
      { type: "code", content: "" },
    ],
    isStreaming: false,
  },
};

// Markdown only
export const MarkdownOnly: Story = {
  args: {
    segments: [markdownSegment],
    isStreaming: false,
  },
};

export const LongMarkdown: Story = {
  args: {
    segments: [longMarkdownSegment],
    isStreaming: false,
  },
};

// Code only
export const CodeOnly: Story = {
  args: {
    segments: [codeSegment],
    isStreaming: false,
  },
};

export const ShortCode: Story = {
  args: {
    segments: [shortCodeSegment],
    isStreaming: false,
  },
};

// Combined markdown and code
export const MarkdownAndCode: Story = {
  args: {
    segments: [markdownSegment, codeSegment],
    isStreaming: false,
  },
};

export const MultipleSegments: Story = {
  args: {
    segments: [
      markdownSegment,
      codeSegment,
      {
        type: "markdown",
        content:
          "This creates a fully functional todo application. You can now:",
      },
      {
        type: "markdown",
        content: `- Add new todos by typing and pressing Enter
- Mark todos as complete by clicking the checkbox
- Delete todos using the Delete button
- See a clean, responsive design

The app uses React hooks for state management and Tailwind for styling.`,
      },
    ],
    isStreaming: false,
  },
};

// Streaming states
export const StreamingMarkdown: Story = {
  args: {
    segments: [
      {
        type: "markdown",
        content: "I'm creating a todo app for you. Let me start with...",
      },
    ],
    isStreaming: true,
    isLatestMessage: true,
  },
};

export const StreamingWithCode: Story = {
  args: {
    segments: [markdownSegment, codeSegment],
    isStreaming: true,
    isLatestMessage: true,
  },
};

export const StreamingComplete: Story = {
  args: {
    segments: [
      markdownSegment,
      codeSegment,
      {
        type: "markdown",
        content:
          "The todo app is now complete! You can copy the code and use it in your project.",
      },
    ],
    isStreaming: true,
    isLatestMessage: true,
  },
};

// Selection states
export const Selected: Story = {
  args: {
    segments: [markdownSegment, codeSegment],
    isStreaming: false,
    initialSelectedResponseId: "test-message-1",
  },
};

export const NotSelected: Story = {
  args: {
    segments: [markdownSegment, codeSegment],
    isStreaming: false,
    initialSelectedResponseId: "different-message",
  },
};

// Complex realistic scenario
export const RealWorldExample: Story = {
  args: {
    segments: [
      {
        type: "markdown",
        content: `I'll create a modern todo application with TypeScript and Tailwind CSS. Here's the implementation:`,
      },
      {
        type: "code",
        content: `import React, { useState, useEffect } from 'react';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
  createdAt: Date;
}

type FilterType = 'all' | 'active' | 'completed';

const TodoApp: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  // Load todos from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('todos');
    if (saved) {
      setTodos(JSON.parse(saved));
    }
  }, []);

  // Save todos to localStorage whenever todos change
  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);

  const addTodo = () => {
    if (input.trim()) {
      const newTodo: Todo = {
        id: Date.now(),
        text: input.trim(),
        completed: false,
        createdAt: new Date(),
      };
      setTodos([newTodo, ...todos]);
      setInput('');
    }
  };

  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo => 
      todo.id === id 
        ? { ...todo, completed: !todo.completed }
        : todo
    ));
  };

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const filteredTodos = todos.filter(todo => {
    switch (filter) {
      case 'active': return !todo.completed;
      case 'completed': return todo.completed;
      default: return true;
    }
  });

  const completedCount = todos.filter(t => t.completed).length;
  const activeCount = todos.length - completedCount;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
          Todo App
        </h1>
        
        {/* Add todo input */}
        <div className="flex mb-6">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
            className="flex-1 p-3 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="What needs to be done?"
          />
          <button
            onClick={addTodo}
            className="px-6 py-3 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Add
          </button>
        </div>

        {/* Filter buttons */}
        <div className="flex mb-4 border-b">
          {(['all', 'active', 'completed'] as FilterType[]).map(filterType => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              className={\`flex-1 py-2 text-sm font-medium capitalize \${
                filter === filterType
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }\`}
            >
              {filterType}
            </button>
          ))}
        </div>

        {/* Todo list */}
        <div className="space-y-2 mb-4">
          {filteredTodos.map(todo => (
            <div
              key={todo.id}
              className="flex items-center p-3 bg-gray-50 rounded-md group"
            >
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span
                className={\`flex-1 \${
                  todo.completed
                    ? 'line-through text-gray-500'
                    : 'text-gray-800'
                }\`}
              >
                {todo.text}
              </span>
              <button
                onClick={() => deleteTodo(todo.id)}
                className="opacity-0 group-hover:opacity-100 ml-2 px-2 py-1 text-red-600 hover:bg-red-50 rounded text-sm transition-opacity"
              >
                Delete
              </button>
            </div>
          ))}
        </div>

        {/* Stats */}
        {todos.length > 0 && (
          <div className="text-center text-sm text-gray-600">
            {activeCount} active, {completedCount} completed
          </div>
        )}
      </div>
    </div>
  );
};

export default TodoApp;`,
      },
      {
        type: "markdown",
        content: `This todo application includes:

✅ **TypeScript** for type safety
✅ **Local Storage** persistence  
✅ **Filtering** by status
✅ **Statistics** tracking
✅ **Modern UI** with Tailwind CSS
✅ **Responsive** design

The app automatically saves your todos to localStorage and restores them when you reload the page. You can filter between all todos, active todos, or completed todos using the tabs.`,
      },
    ],
    isStreaming: false,
  },
};
