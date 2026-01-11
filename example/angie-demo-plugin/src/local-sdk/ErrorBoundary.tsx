/**
 * OMISSION FIX: DeepSeek Suggestion - "Error Boundaries"
 * Prevents the entire WP Admin from breaking if the Chat UI crashes.
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Angie UI Crashed:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 m-4 border border-red-200 bg-red-50 rounded-lg text-red-900 font-sans">
          <h2 className="font-bold text-lg mb-2">Angie encountered an error.</h2>
          <p className="text-sm mb-4">The assistant crashed, but your WordPress site is safe.</p>
          <div className="bg-white p-2 rounded border text-xs font-mono overflow-auto max-h-32 mb-4">
            {this.state.error?.toString()}
          </div>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            Restart Assistant
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
