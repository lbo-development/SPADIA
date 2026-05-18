import type { ReactNode } from 'react';

const BG       = '#0E1117';
const SURFACE  = '#161B27';
const SURFACE2 = '#1C2333';
const BORDER   = '#232B3E';
const TEXT     = '#E8EDF5';
const MUTED    = '#6B7A99';
const ACCENT   = '#378ADD';

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
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`
        .spadia-modal-body::-webkit-scrollbar { width: 6px; }
        .spadia-modal-body::-webkit-scrollbar-track { background: ${SURFACE2}; border-radius: 3px; }
        .spadia-modal-body::-webkit-scrollbar-thumb { background: ${BORDER}; border-radius: 3px; }
        .spadia-modal-body::-webkit-scrollbar-thumb:hover { background: ${ACCENT}; }
      `}</style>
      <div
        style={{
          background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16,
          width: '100%', maxWidth, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* En-tête — figé */}
        <div style={{
          padding: '16px 22px', borderBottom: `1px solid ${BORDER}`,
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          {icon && (
            <div style={{
              width: 34, height: 34, borderRadius: 9, background: ACCENT + '18',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {icon}
            </div>
          )}
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TEXT, flex: 1 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, border: `1px solid ${BORDER}`, borderRadius: 7,
              background: 'transparent', color: MUTED, fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Bannière d'erreur — figée sous le titre */}
        {error && (
          <div style={{
            padding: '10px 22px', borderBottom: `1px solid #E0525244`,
            background: '#E0525218', color: '#E05252', fontSize: 13, flexShrink: 0,
          }}>
            {error}
          </div>
        )}

        {/* Corps — scrollable avec scrollbar thémée */}
        <div
          className="spadia-modal-body"
          style={{
            flex: 1, overflowY: 'auto', padding: '22px',
            scrollbarColor: `${BORDER} ${SURFACE2}`, scrollbarWidth: 'thin',
          }}
        >
          {children}
        </div>

        {/* Pied de page — figé */}
        {footer != null && (
          <div style={{ padding: '12px 22px', borderTop: `1px solid ${BORDER}`, flexShrink: 0 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// Réexportés pour usage sans import séparé
export { BG, SURFACE, SURFACE2, BORDER, TEXT, MUTED, ACCENT };
