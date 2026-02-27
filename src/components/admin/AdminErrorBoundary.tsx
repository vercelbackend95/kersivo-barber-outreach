import React from 'react';

type AdminErrorBoundaryProps = {
  children: React.ReactNode;
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
    console.error('Timeline rendering error:', error);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="admin-inline-error" role="alert">
          <p>Something went wrong in Timeline. Refresh page.</p>
          <button type="button" className="btn btn--secondary" onClick={this.handleReload}>Refresh page</button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AdminErrorBoundary;
