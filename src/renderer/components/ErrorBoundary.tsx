import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    // Sanitize: don't show raw file paths or stack traces
    const message = error.message
      ? error.message.replace(/\/[^\s:'"]+/g, (m) => m.split('/').pop() || m)
      : 'An unexpected error occurred';
    return { hasError: true, errorMessage: message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full p-8">
          <div className="text-center space-y-3 max-w-md">
            <div className="text-sm font-medium text-status-error">
              Something went wrong
            </div>
            <p className="text-xs text-text-muted">
              {this.props.fallbackMessage || this.state.errorMessage}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs text-text-secondary transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
