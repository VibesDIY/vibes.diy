import { useEnvironment } from '../hooks/useEnvironment';

/**
 * Hook that returns true if the application is running in development mode
 * @returns {boolean} True if in development, false otherwise
 */
export const useIsDevelopment = (): boolean => {
  const environment = useEnvironment();
  return environment === 'development';
};
