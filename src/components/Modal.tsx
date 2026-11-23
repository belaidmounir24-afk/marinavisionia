import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ open, title, onClose, children, footer }) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#080f18]/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-heading"
    >
      <div className="w-full max-w-md bg-[#19202a] border border-[#3a494b]/70 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#3a494b]/50 bg-[#151c25]">
          <h3 id="modal-heading" className="text-base font-semibold text-[#e0fdff] truncate">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre"
            className="w-8 h-8 rounded-lg bg-[#232a34] hover:bg-[#2e353f] flex items-center justify-center text-[#9eb2b8] hover:text-[#e0fdff] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto space-y-3">{children}</div>
        {footer && (
          <div className="px-5 py-3.5 border-t border-[#3a494b]/50 bg-[#151c25] flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
