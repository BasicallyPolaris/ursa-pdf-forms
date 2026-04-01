import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error): void {
    this.setState({ hasError: true, error });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.props.fallback) {
      return this.props.fallback;
    }

    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center gap-2 p-4">
          <p className="text-xs text-destructive">
            {this.state.error?.message || "Unexpected error"}
          </p>
          <button
            onClick={this.handleReset}
            className="rounded-md border border-border px-2 py-1 text-[10px] text-muted-foreground hover:bg-accent"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundary };
