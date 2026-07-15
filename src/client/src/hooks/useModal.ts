import { useEffect, useRef, useCallback } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Manages modal accessibility: focus trap, Escape-to-close, focus restoration.
 * Attach the returned ref to the dialog container element.
 */
export function useModal(isOpen: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Capture the element that was focused before the modal opened
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;
      // Move focus into the dialog on next tick (after render)
      const timer = setTimeout(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const first = dialog.querySelector<HTMLElement>(FOCUSABLE);
        if (first) first.focus();
        else dialog.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      // Restore focus to the trigger element
      const trigger = triggerRef.current as HTMLElement | null;
      if (trigger && typeof trigger.focus === 'function') {
        trigger.focus();
      }
      triggerRef.current = null;
    }
  }, [isOpen]);

  // Escape key and focus trap
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  return { dialogRef, handleKeyDown };
}
