import type { Preview } from '@storybook/react';
import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from '../src/store/store';
import { CSSVariablesSynchronizer } from '../src/components/CSSVariablesSynchronizer';
import '../src/styles/tokens.css';
import '../src/styles/design-tokens.css';
import '../src/styles/fonts.css';

const EnvironmentWrapper: React.FC<{ environment: string; children: React.ReactNode }> = ({ environment, children }) => {
  // Set synchronously before render so child components read the correct value immediately
  if (typeof window !== 'undefined') {
    (window as any).__VIBES_ENV__ = environment;
  }

  useEffect(() => {
    // Also set in effect for safety on re-renders
    if (typeof window !== 'undefined') {
      (window as any).__VIBES_ENV__ = environment;
    }
  }, [environment]);

  return <>{children}</>;
};

const withRedux = (Story: any, context: any) => {
  const environment = context.globals?.environment || context.parameters?.environment || 'production';

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <EnvironmentWrapper environment={environment}>
          <div style={{ fontFamily: 'var(--vibes-font-family)' }}>
            <CSSVariablesSynchronizer key={context.id} />
            <Story key={environment} />
          </div>
        </EnvironmentWrapper>
      </PersistGate>
    </Provider>
  );
};

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        {
          name: 'light',
          value: '#ffffff',
        },
        {
          name: 'dark',
          value: '#1a1a1a',
        },
      ],
    },
  },
  globalTypes: {
    environment: {
      name: 'Environment Mode',
      description: 'Toggle between development and production environments',
      defaultValue: 'development',
      toolbar: {
        title: 'Environment',
        icon: 'cog',
        items: [
          {
            value: 'development',
            icon: 'wrench',
            title: '🔧 Development',
            right: '(Shows dev indicators)'
          },
          {
            value: 'production',
            icon: 'check',
            title: '✓ Production',
            right: '(Hides dev indicators)'
          },
        ],
        showName: true,
        dynamicTitle: true,
      },
    },
  },
  decorators: [withRedux],
};

export default preview;
