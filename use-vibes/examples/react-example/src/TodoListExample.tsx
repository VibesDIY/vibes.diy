import { useEffect, useState } from 'react';
import type { DocBase } from 'use-vibes';
import { useFireproof } from 'use-vibes';
import './App.css';

// Define interface for todo documents
interface TodoDocument extends DocBase {
  type: 'todo';
  text: string;
  completed: boolean;
  created: number;
  updated?: number;
}

function TodoListExample() {
  const [newTodoText, setNewTodoText] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  // Use Fireproof - starts local-first, then automatically syncs when logged in
  const { useLiveQuery, database, attach } = useFireproof('TodoApp-100');

  // Debug logging for attach state
  useEffect(() => {
    console.log('Attach state:', attach?.state);
    if (attach?.ctx?.tokenAndClaims) {
      console.log('Token state:', attach.ctx.tokenAndClaims.state);
    }
  }, [attach]);

  // Get all todos sorted by creation date
  const { docs: allTodos } = useLiveQuery<TodoDocument>('type', {
    key: 'todo',
    descending: true,
  });

  // Filter todos based on current filter
  const filteredTodos = allTodos.filter((todo) => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true; // 'all'
  });

  const activeTodoCount = allTodos.filter((todo) => !todo.completed).length;
  const completedTodoCount = allTodos.filter((todo) => todo.completed).length;

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;

    const newTodo: Omit<TodoDocument, '_id'> = {
      type: 'todo',
      text: newTodoText.trim(),
      completed: false,
      created: Date.now(),
    };

    try {
      await database.put(newTodo);
      setNewTodoText('');
    } catch (error) {
      console.error('Failed to add todo:', error);
    }
  };

  const handleToggleTodo = async (todo: TodoDocument) => {
    try {
      await database.put({
        ...todo,
        completed: !todo.completed,
        updated: Date.now(),
      });
    } catch (error) {
      console.error('Failed to toggle todo:', error);
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    try {
      await database.del(todoId);
    } catch (error) {
      console.error('Failed to delete todo:', error);
    }
  };

  const handleEditTodo = async (todo: TodoDocument, newText: string) => {
    if (!newText.trim()) return;

    try {
      await database.put({
        ...todo,
        text: newText.trim(),
        updated: Date.now(),
      });
    } catch (error) {
      console.error('Failed to edit todo:', error);
    }
  };

  const handleClearCompleted = async () => {
    const completedTodos = allTodos.filter((todo) => todo.completed);
    try {
      await Promise.all(completedTodos.map((todo) => database.del(todo._id)));
    } catch (error) {
      console.error('Failed to clear completed todos:', error);
    }
  };

  return (
    <div className="container">
      <h1>Todo List</h1>
      <p style={{ marginBottom: '2rem', color: '#666' }}>
        A simple todo list using Fireproof for real-time data sync and persistence.
      </p>

      {/* Sync info */}
      <div
        style={{
          marginBottom: '2rem',
          padding: '1rem',
          backgroundColor: '#f0f8ff',
          borderRadius: '4px',
          border: '1px solid #b0d4ff',
        }}
      >
        <span style={{ color: '#0066cc' }}>
          Sign in with Clerk to sync your todos across devices
        </span>
      </div>

      {/* Add new todo form */}
      <form onSubmit={handleAddTodo} style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            placeholder="What needs to be done?"
            style={{
              flex: 1,
              padding: '0.75rem',
              border: '2px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem',
            }}
          />
          <button
            type="submit"
            disabled={!newTodoText.trim()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#007acc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: 'pointer',
              opacity: !newTodoText.trim() ? 0.5 : 1,
            }}
          >
            Add
          </button>
        </div>
      </form>

      {/* Filter buttons */}
      {allTodos.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1rem',
            justifyContent: 'center',
          }}
        >
          {(['all', 'active', 'completed'] as const).map((filterType) => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #ddd',
                backgroundColor: filter === filterType ? '#007acc' : 'white',
                color: filter === filterType ? 'white' : '#333',
                borderRadius: '4px',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {filterType} {filterType === 'active' && `(${activeTodoCount})`}
              {filterType === 'completed' && `(${completedTodoCount})`}
            </button>
          ))}
        </div>
      )}

      {/* Todo list */}
      <div style={{ marginBottom: '2rem' }}>
        {filteredTodos.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: '#999',
              padding: '2rem',
              fontStyle: 'italic',
            }}
          >
            {allTodos.length === 0 ? 'No todos yet. Add one above!' : `No ${filter} todos.`}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filteredTodos.map((todo) => (
              <TodoItem
                key={todo._id}
                todo={todo}
                onToggle={() => handleToggleTodo(todo)}
                onDelete={() => handleDeleteTodo(todo._id)}
                onEdit={(newText) => handleEditTodo(todo, newText)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sync status indicator */}
      {attach?.state === 'attached' && attach?.ctx?.tokenAndClaims?.state === 'ready' && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#d4edda',
            borderRadius: '4px',
            border: '1px solid #c3e6cb',
            color: '#155724',
            fontSize: '0.9rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>✓ Syncing across devices</span>
          <button
            onClick={() => {
              const tokenAndClaims = attach?.ctx?.tokenAndClaims;
              if (tokenAndClaims?.state === 'ready' && tokenAndClaims?.reset) {
                tokenAndClaims.reset();
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#155724',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: '0.85rem',
            }}
          >
            Sign Out
          </button>
        </div>
      )}

      {/* Sync state indicators */}
      {attach?.state === 'attaching' && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#fff3cd',
            borderRadius: '4px',
            border: '1px solid #ffeaa7',
            color: '#856404',
            fontSize: '0.9rem',
          }}
        >
          <span>⏳ Connecting to sync service...</span>
        </div>
      )}

      {attach?.state === 'error' && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#f8d7da',
            borderRadius: '4px',
            border: '1px solid #f5c6cb',
            color: '#721c24',
            fontSize: '0.9rem',
          }}
        >
          <span>❌ Sync connection failed. Please try again.</span>
        </div>
      )}

      {/* Stats and actions */}
      {allTodos.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '4px',
            fontSize: '0.9rem',
            color: '#666',
          }}
        >
          <span>
            {activeTodoCount} {activeTodoCount === 1 ? 'item' : 'items'} left
          </span>
          {completedTodoCount > 0 && (
            <button
              onClick={handleClearCompleted}
              style={{
                background: 'none',
                border: 'none',
                color: '#dc3545',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Clear completed ({completedTodoCount})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// TodoItem component for individual todo rendering
interface TodoItemProps {
  todo: TodoDocument;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: (text: string) => void;
}

function TodoItem({ todo, onToggle, onDelete, onEdit }: TodoItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(todo.text);

  const handleSave = () => {
    onEdit(editText);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditText(todo.text);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem',
        border: '1px solid #ddd',
        borderRadius: '4px',
        backgroundColor: todo.completed ? '#f8f9fa' : 'white',
      }}
    >
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={onToggle}
        style={{ cursor: 'pointer' }}
      />

      {isEditing ? (
        <input
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          autoFocus
          style={{
            flex: 1,
            padding: '0.25rem',
            border: '1px solid #007acc',
            borderRadius: '2px',
          }}
        />
      ) : (
        <span
          onDoubleClick={() => setIsEditing(true)}
          style={{
            flex: 1,
            textDecoration: todo.completed ? 'line-through' : 'none',
            color: todo.completed ? '#999' : '#333',
            cursor: 'pointer',
          }}
        >
          {todo.text}
        </span>
      )}

      <button
        onClick={() => setIsEditing(!isEditing)}
        style={{
          padding: '0.25rem 0.5rem',
          border: '1px solid #ddd',
          backgroundColor: 'white',
          borderRadius: '2px',
          cursor: 'pointer',
          fontSize: '0.8rem',
        }}
      >
        {isEditing ? '✓' : '✏️'}
      </button>

      <button
        onClick={onDelete}
        style={{
          padding: '0.25rem 0.5rem',
          border: '1px solid #dc3545',
          backgroundColor: 'white',
          color: '#dc3545',
          borderRadius: '2px',
          cursor: 'pointer',
          fontSize: '0.8rem',
        }}
      >
        ✗
      </button>
    </div>
  );
}

export default TodoListExample;
