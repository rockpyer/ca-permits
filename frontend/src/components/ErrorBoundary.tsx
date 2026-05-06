import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled app error', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-ink p-6 text-slate-100">
          <div className="border border-danger bg-danger/10 p-4">
            <h1 className="mb-2 text-lg font-semibold text-white">The app hit a rendering error.</h1>
            <p className="text-sm text-red-100">{this.state.error.message}</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
