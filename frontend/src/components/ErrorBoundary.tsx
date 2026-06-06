import { Component, type ReactNode } from 'react';
import { C } from '@/constants/colors';

interface Props  { children: ReactNode; fallback?: ReactNode; }
interface State  { hasError: boolean; message: string; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  private reset = () => this.setState({ hasError: false, message: '' });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback)  return this.props.fallback;

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', gap: 16, padding: 32, background: C.bg,
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.text }}>
          Une erreur inattendue s'est produite.
        </p>
        {this.state.message && (
          <pre style={{ margin: 0, fontSize: 11, color: C.muted, maxWidth: 480, whiteSpace: 'pre-wrap', wordBreak: 'break-word', textAlign: 'center' }}>
            {this.state.message}
          </pre>
        )}
        <button
          onClick={this.reset}
          style={{ padding: '8px 20px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13, cursor: 'pointer' }}
        >
          Réessayer
        </button>
      </div>
    );
  }
}
