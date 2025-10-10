import { useState, useEffect } from 'react';
import ImageGeneratorExample from './ImageGeneratorExample';
import TodoListExample from './TodoListExample';
import VibesGeneratorExample from './VibesGeneratorExample';
import VibeControlExample from './VibeControlExample';
import { ShareExample } from './ShareExample';
import './App.css';
import VibeAuthWallExample from './VibeAuthWallExample';
import MountVibesAppExample from './MountVibesAppExample';

type ExampleKey =
  | 'home'
  | 'image-generator'
  | 'todo-list'
  | 'vibes-generator'
  | 'vibe-control'
  | 'share'
  | 'vibe-auth-wall'
  | 'mount-vibes-app';

function App() {
  const [currentExample, setCurrentExample] = useState<ExampleKey>(() => {
    // Initialize from URL path
    const path = window.location.pathname;
    if (path === '/mount-vibes-app') {
      return 'mount-vibes-app';
    } else if (path === '/vibe-control') {
      return 'vibe-control';
    }
    return 'home';
  });

  // Handle URL changes and browser back button
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/mount-vibes-app') {
        setCurrentExample('mount-vibes-app');
      } else if (path === '/vibe-control') {
        setCurrentExample('vibe-control');
      } else {
        setCurrentExample('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Update URL when example changes
  const handleExampleChange = (example: ExampleKey) => {
    setCurrentExample(example);

    if (example === 'mount-vibes-app') {
      window.history.pushState({}, '', '/mount-vibes-app');
    } else if (example === 'vibe-control') {
      window.history.pushState({}, '', '/vibe-control');
    } else {
      window.history.pushState({}, '', '/');
    }
  };

  const examples = [
    {
      key: 'vibes-generator' as const,
      title: 'Vibes Generator',
      description: 'Generate React components from text prompts using AI',
      component: <VibesGeneratorExample />,
    },
    {
      key: 'image-generator' as const,
      title: 'Image Generator',
      description: 'Generate and edit images with AI using the ImgGen component',
      component: <ImageGeneratorExample />,
    },
    {
      key: 'todo-list' as const,
      title: 'Todo List',
      description: 'A real-time todo list with Fireproof data persistence and sync',
      component: <TodoListExample />,
    },
    {
      key: 'share' as const,
      title: 'Share Example',
      description: 'Todo list with database sharing functionality using authentication tokens',
      component: <ShareExample />,
    },
    {
      key: 'vibe-control' as const,
      title: 'Vibe Control',
      description: 'Floating action button with overlay - works in React and vanilla JS',
      component: <VibeControlExample setCurrentExample={handleExampleChange} />,
    },
    {
      key: 'vibe-auth-wall' as const,
      title: 'Vibe Auth Wall',
      description: 'Authentication wall',
      component: <VibeAuthWallExample />,
    },
    {
      key: 'mount-vibes-app' as const,
      title: 'Mount Vibes App',
      description: 'Test unified mountVibesApp function with DOM wrapping',
      component: <MountVibesAppExample setCurrentExample={handleExampleChange} />,
    },
  ];

  const renderHome = () => (
    <div className="container">
      <h1>Use Vibes Examples</h1>
      <p style={{ marginBottom: '2rem', color: '#666', fontSize: '1.1rem' }}>
        Explore different examples showcasing the capabilities of use-vibes components.
      </p>

      <div
        className="examples-grid"
        style={{
          display: 'grid',
          gap: '1.5rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          marginBottom: '2rem',
        }}
      >
        {examples.map((example) => (
          <div
            key={example.key}
            className="example-card"
            style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '1.5rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              backgroundColor: '#fff',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
            onClick={() => handleExampleChange(example.key)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>{example.title}</h3>
            <p style={{ margin: '0', color: '#666', lineHeight: '1.5' }}>{example.description}</p>
            <div
              style={{
                marginTop: '1rem',
                color: '#007acc',
                fontSize: '0.9rem',
                fontWeight: '500',
              }}
            >
              View Example →
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: '1.5rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e9ecef',
        }}
      >
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>About Use Vibes</h3>
        <p style={{ margin: '0', color: '#666', lineHeight: '1.5' }}>
          Use Vibes is a library that transforms any DOM element into an AI-powered micro-app. These
          examples demonstrate various components and patterns you can use in your applications.
        </p>
      </div>
    </div>
  );

  const renderExample = () => {
    const example = examples.find((e) => e.key === currentExample);
    if (!example) return renderHome();

    return (
      <div>
        <div
          style={{
            padding: '1rem 0',
            borderBottom: '1px solid #eee',
            marginBottom: '1rem',
          }}
        >
          <button
            onClick={() => handleExampleChange('home')}
            style={{
              background: 'none',
              border: 'none',
              color: '#007acc',
              cursor: 'pointer',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            ← Back to Examples
          </button>
        </div>
        {example.component}
      </div>
    );
  };

  return currentExample === 'home' ? renderHome() : renderExample();
}

export default App;
