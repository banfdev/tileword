import type { ReactNode } from 'react';

type ModalProps = { title: string; onClose: () => void; children: ReactNode };

export function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "#000000bb",
      backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "fadeIn 0.2s ease",
    }}>
      <div style={{
        background: "#13131f",
        border: "1px solid #ffffff18",
        borderRadius: 20,
        padding: "32px 36px",
        maxWidth: 560,
        width: "90%",
        maxHeight: "80vh",
        overflowY: "auto",
        boxShadow: "0 32px 80px #000000cc",
        animation: "slideUp 0.25s ease",
        position: "relative",
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 16, right: 16,
          background: "#ffffff0f", border: "1px solid #ffffff18",
          color: "#ffffff66", borderRadius: 8,
          width: 32, height: 32, cursor: "pointer", fontSize: 16,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>×</button>
        <div style={{
          fontFamily: "'Noto Serif SC', serif",
          fontSize: 22, fontWeight: 800,
          color: "#f0c060", marginBottom: 20,
          letterSpacing: "0.04em",
        }}>{title}</div>
        {children}
      </div>
    </div>
  );
}
