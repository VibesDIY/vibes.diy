import { useEffect, useState } from 'react';
import { useFireproof } from 'use-vibes';

interface Todo {
  _id?: string;
  text: string;
  completed: boolean;
}

export function ShareExample() {
  const { database, useLiveQuery, syncEnabled } = useFireproof('todos-shared-abc1');
  const todos = useLiveQuery<Todo>('_id', { limit: 15 }).docs;
  const [newTodo, setNewTodo] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  // Listen for share success/error events
  useEffect(() => {
    const handleShareSuccess = (e: Event) => {
      const customEvent = e as CustomEvent;
      const result = customEvent.detail;
      setShareSuccess(result.message || `Successfully shared with ${result.email}`);
      setShareEmail(''); // Clear input after success
      setIsSharing(false);
    };

    const handleShareError = (e: Event) => {
      const customEvent = e as CustomEvent;
      const error = customEvent.detail.error;
      setShareError(error instanceof Error ? error.message : 'Failed to share');
      setIsSharing(false);
    };

    document.addEventListener('vibes-share-success', handleShareSuccess);
    document.addEventListener('vibes-share-error', handleShareError);

    return () => {
      document.removeEventListener('vibes-share-success', handleShareSuccess);
      document.removeEventListener('vibes-share-error', handleShareError);
    };
  }, []);

  const addTodo = async () => {
    if (!newTodo.trim()) return;
    await database.put({ text: newTodo, completed: false });
    setNewTodo('');
  };

  const toggleTodo = async (todo: Todo) => {
    if (!todo._id) return;
    await database.put({ ...todo, completed: !todo.completed });
  };

  const handleShare = () => {
    if (!shareEmail.trim()) {
      setShareError('Please enter an email address');
      return;
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shareEmail)) {
      setShareError('Please enter a valid email address');
      return;
    }

    setIsSharing(true);
    setShareError(null);
    setShareSuccess(null);

    // Dispatch custom event to trigger share
    document.dispatchEvent(
      new CustomEvent('vibes-share-request', {
        detail: {
          email: shareEmail,
          role: 'member',
          right: 'write',
        },
      })
    );
  };

  const handleEnableSync = () => {
    document.dispatchEvent(new CustomEvent('vibes-sync-enable'));
  };

  const handleDisableSync = () => {
    document.dispatchEvent(new CustomEvent('vibes-sync-disable'));
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Todo List with Sharing</h1>

      <div style={{ marginBottom: '20px' }}>
        <p>
          Sync Status:{' '}
          <strong style={{ color: syncEnabled ? 'green' : 'red' }}>
            {syncEnabled ? 'Enabled' : 'Disabled'}
          </strong>
        </p>
        {!syncEnabled && (
          <button
            onClick={handleEnableSync}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Enable Sync
          </button>
        )}
        {syncEnabled && (
          <button
            onClick={handleDisableSync}
            style={{
              padding: '10px 20px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Disable Sync
          </button>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          placeholder="Add a new todo..."
          style={{
            padding: '10px',
            width: '70%',
            marginRight: '10px',
            borderRadius: '4px',
            border: '1px solid #ccc',
          }}
        />
        <button
          onClick={addTodo}
          style={{
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Add
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '10px' }}>Share with Others</h3>
        {!syncEnabled && (
          <p style={{ color: '#dc3545', fontSize: '14px', marginBottom: '10px' }}>
            Please enable sync before sharing
          </p>
        )}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <input
            type="email"
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleShare()}
            placeholder="Enter email address..."
            disabled={!syncEnabled}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '4px',
              border: '1px solid #ccc',
            }}
          />
          <button
            onClick={handleShare}
            disabled={!syncEnabled || isSharing}
            style={{
              padding: '10px 20px',
              backgroundColor: syncEnabled ? '#ffc107' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: syncEnabled ? 'pointer' : 'not-allowed',
            }}
          >
            {isSharing ? 'Sharing...' : 'Share'}
          </button>
        </div>
        {shareSuccess && (
          <div
            style={{
              padding: '10px',
              backgroundColor: '#d4edda',
              border: '1px solid #c3e6cb',
              borderRadius: '4px',
              marginTop: '10px',
            }}
          >
            <p style={{ margin: '0', color: '#155724' }}>
              <strong>✓ Success:</strong> {shareSuccess}
            </p>
          </div>
        )}
        {shareError && (
          <div
            style={{
              padding: '10px',
              backgroundColor: '#f8d7da',
              border: '1px solid #f5c6cb',
              borderRadius: '4px',
              marginTop: '10px',
              color: '#721c24',
            }}
          >
            <strong>✗ Error:</strong> {shareError}
          </div>
        )}
      </div>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {todos.map((todo) => (
          <li
            key={todo._id}
            style={{
              padding: '10px',
              marginBottom: '5px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            onClick={() => toggleTodo(todo)}
          >
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo)}
              style={{ marginRight: '10px' }}
            />
            <span
              style={{
                textDecoration: todo.completed ? 'line-through' : 'none',
                color: todo.completed ? '#6c757d' : '#212529',
              }}
            >
              {todo.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
