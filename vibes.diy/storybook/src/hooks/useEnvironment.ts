import { useState, useEffect } from 'react';

const getEnvironment = (): 'development' | 'production' => {
  if (typeof window !== 'undefined' && (window as any).__VIBES_ENV__) {
    return (window as any).__VIBES_ENV__;
  }
  return 'production';
};

export const useEnvironment = () => {
  const [environment, setEnvironment] = useState(getEnvironment());

  useEffect(() => {
    const checkEnvironment = () => {
      const current = getEnvironment();
      if (current !== environment) {
        setEnvironment(current);
      }
    };

    // Check immediately
    checkEnvironment();

    // Then check periodically
    const interval = setInterval(checkEnvironment, 100);
    return () => clearInterval(interval);
  }, [environment]);

  return environment;
};
