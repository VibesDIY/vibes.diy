import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    console.log("ttitititii", props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    console.log("getDerivedStateFromError", error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    console.log(">>>>>>>", this.state);
    if (this.state.hasError && this.state.error) {
      const error = this.state.error;
      const message = "Oops!";
      const details = error.message || "An unexpected error occurred.";
      const stack = error.stack;

      return (
        <main className="container mx-auto p-4 pt-16">
          <h1 className="text-2xl font-bold mb-4">{message}</h1>
          <p className="mb-4 text-red-600">{details}</p>
          {stack && (
            <pre className="w-full overflow-x-auto p-4 bg-gray-100 dark:bg-gray-800 rounded">
              <code className="text-sm">{stack}</code>
            </pre>
          )}
        </main>
      );
    }

    return this.props.children;
  }
}
