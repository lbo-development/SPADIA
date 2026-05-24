import type { ReactNode } from 'react';
import { C } from '@/constants/colors';

export type ModalProps = {
  title: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
  error?: string;
};

export function Modal({ title, icon, onClose, children, footer, maxWidth = 520, error }: ModalProps) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`
        .spadia-modal-body::-webkit-scrollbar { width: 6px; }
        .spadia-modal-body::-webkit-scrollbar-track { background: var(--surface2); border-radius: 3px; }
        .spadia-modal-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        .spadia-modal-body::-webkit-scrollbar-thumb:hover { background: var(--accent); }
      `}</style>
      <div
        style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
          width: '100%', maxWidth, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* En-tête */}
        <div style={{
          padding: '16px 22px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          {icon && (
            <div style={{
              width: 34, height: 34, borderRadius: 9, background: C.accent18,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {icon}
            </div>
          )}
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text, flex: 1 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, border: `1px solid ${C.border}`, borderRadius: 7,
              background: 'transparent', color: C.muted, fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Bannière d'erreur */}
        {error && (
          <div style={{
            padding: '10px 22px', borderBottom: `1px solid ${C.danger44}`,
            background: C.errorBg, color: C.danger, fontSize: 13, flexShrink: 0,
          }}>
            {error}
          </div>
        )}

        {/* Corps scrollable */}
        <div
          className="spadia-modal-body"
          style={{
            flex: 1, overflowY: 'auto', padding: '22px',
            scrollbarColor: `${C.border} ${C.surface2}`, scrollbarWidth: 'thin',
          }}
        >
          {children}
        </div>

        {/* Pied */}
        {footer != null && (
          <div style={{ padding: '12px 22px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
