import type { ComponentChildren, JSX } from 'preact';
import { useId, useRef } from 'preact/hooks';
import { useT } from '../context';
import { useEntrance, useNavScope } from '../hooks';
import { Store, useStore } from '../store';
import { Button } from './Basics';

export interface ModalProps {
  readonly title: string;
  readonly children?: ComponentChildren;
  /** Escape, the back intent, and a backdrop tap call this. */
  readonly onClose: () => void;
  readonly role?: 'dialog' | 'alertdialog';
}

/** Modal (spec 8.3, 8.4): a backdrop and a panel that scale in; traps focus; gives it back on close. */
export function Modal(props: ModalProps): JSX.Element {
  const panel = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEntrance(backdrop, 'backdropIn');
  useEntrance(panel, 'panelOpen');
  useNavScope(panel, { onBack: props.onClose, trap: true });
  return (
    <div class="cd-screen" style={{ zIndex: 20 }}>
      <div ref={backdrop} class="cd-backdrop" onClick={props.onClose} aria-hidden="true" />
      <div
        ref={panel}
        class="cd-panel cd-modal"
        role={props.role ?? 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        data-role="modal"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            props.onClose();
          }
        }}
      >
        <h2 class="cd-title" id={titleId}>
          {props.title}
        </h2>
        {props.children}
      </div>
    </div>
  );
}

export interface ConfirmDialogProps {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly danger?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** Confirm dialog: Cancel is focused first, so a stray Enter never confirms a destructive action. */
export function ConfirmDialog(props: ConfirmDialogProps): JSX.Element {
  const t = useT();
  return (
    <Modal title={props.title} onClose={props.onCancel} role="alertdialog">
      <p class="cd-body">{props.message}</p>
      <div class="cd-row">
        <Button autofocus sound="back" onClick={props.onCancel}>
          {props.cancelLabel ?? t('common.cancel')}
        </Button>
        <Button variant={props.danger === true ? 'danger' : 'primary'} onClick={props.onConfirm}>
          {props.confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

/** Side sheet: slides in from the right with the gentle spring; fades under reduced motion. */
export function SideSheet(props: {
  readonly title: string;
  readonly children?: ComponentChildren;
  readonly onClose: () => void;
}): JSX.Element {
  const t = useT();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEntrance(panel, 'sideSheetOpen');
  useNavScope(panel, { onBack: props.onClose, trap: true });
  return (
    <div class="cd-screen" style={{ zIndex: 20 }}>
      <div class="cd-backdrop" onClick={props.onClose} aria-hidden="true" />
      <div
        ref={panel}
        class="cd-panel cd-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            props.onClose();
          }
        }}
      >
        <h2 class="cd-title" id={titleId}>
          {props.title}
        </h2>
        {props.children}
        <Button sound="back" onClick={props.onClose}>
          {t('common.close')}
        </Button>
      </div>
    </div>
  );
}

export interface ToastItem {
  readonly id: number;
  readonly message: string;
  readonly tone: 'default' | 'success' | 'danger';
}

export const TOAST_MS = 3000;

/** Toast list state; the host renders it and removes each toast after three seconds. */
export class ToastQueue {
  readonly items = new Store<readonly ToastItem[]>([]);
  private next = 1;

  show(message: string, tone: ToastItem['tone'] = 'default'): void {
    this.items.update((items) => [...items.slice(-2), { id: this.next++, message, tone }]);
  }

  dismiss(id: number): void {
    this.items.update((items) => items.filter((t) => t.id !== id));
  }
}

function ToastView(props: { readonly toast: ToastItem; readonly onDone: () => void }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useEntrance(ref, 'toastIn');
  const timer = useRef(0);
  if (timer.current === 0 && typeof window !== 'undefined') {
    timer.current = window.setTimeout(props.onDone, TOAST_MS);
  }
  return (
    <div
      ref={ref}
      class="cd-toast"
      data-tone={props.toast.tone}
      role={props.toast.tone === 'danger' ? 'alert' : 'status'}
    >
      {props.toast.message}
    </div>
  );
}

/** Toast host: drops toasts from the top (220 ms), auto-dismisses after 3 s. */
export function ToastHost(props: { readonly queue: ToastQueue }): JSX.Element {
  const items = useStore(props.queue.items);
  return (
    <div class="cd-toasts" aria-live="polite">
      {items.map((toast) => (
        <ToastView
          key={toast.id}
          toast={toast}
          onDone={() => {
            props.queue.dismiss(toast.id);
          }}
        />
      ))}
    </div>
  );
}
