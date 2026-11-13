import { Component } from 'react';
import { RefreshCw } from 'lucide-react';

// If a screen ever crashes, show a calm message with a reload button
// instead of a blank page or raw error text.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('[KLG] screen crashed', error, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="login">
        <div className="card login-card crash-card" role="alert">
          <h1>Something went wrong</h1>
          <p className="muted">This screen could not open. Your orders are safe. Tap reload to continue.</p>
          <button className="btn btn-primary btn-block" onClick={() => { this.setState({ failed: false }); window.location.reload(); }}>
            <RefreshCw size={16} /> Reload
          </button>
        </div>
      </div>
    );
  }
}
