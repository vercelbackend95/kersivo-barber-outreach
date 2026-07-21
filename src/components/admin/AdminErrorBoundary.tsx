import React from 'react';

type AdminErrorBoundaryProps = {
  children: React.ReactNode;
  /** Optional label for the failure message (default: Timeline). */
  label?: string;
  /** When set, show a dismiss/close action instead of only full-page reload. */
  onDismiss?: () => void;
  dismissLabel?: string;
};

type AdminErrorBoundaryState = {
  hasError: boolean;
};

class AdminErrorBoundary extends React.Component<AdminErrorBoundaryProps, AdminErrorBoundaryState> {
  state: AdminErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AdminErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Admin panel rendering error:', error);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleDismiss = () => {
    this.setState({ hasError: false });
    this.props.onDismiss?.();
  };

  render() {
    if (this.state.hasError) {
      const label = this.props.label ?? 'Timeline';
      return (
        <div className="admin-inline-error" role="alert">
          <p>Something went wrong in {label}. {this.props.onDismiss ? 'Close and try again.' : 'Refresh page.'}</p>
          {this.props.onDismiss ? (
            <button type="button" className="btn btn--secondary" onClick={this.handleDismiss}>
              {this.props.dismissLabel ?? 'Close'}
            </button>
          ) : (
            <button type="button" className="btn btn--secondary" onClick={this.handleReload}>
              Refresh page
            </button>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default AdminErrorBoundary;
