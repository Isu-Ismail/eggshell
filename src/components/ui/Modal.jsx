import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import styles from './Modal.module.css';

export function ConfirmModal({ isOpen, title, message, onConfirm, onCancel }) {
  if (!isOpen) return null;
  return createPortal(
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3>{title}</h3>
          <button onClick={onCancel} className={styles.closeBtn}><X size={18} /></button>
        </div>
        <div className={styles.body}>
          <p>{message}</p>
        </div>
        <div className={styles.footer}>
          <button onClick={onCancel} className={styles.cancelBtn}>Cancel</button>
          <button onClick={onConfirm} className={styles.confirmBtn}>Confirm</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function AlertModal({ isOpen, title, message, onClose }) {
  if (!isOpen) return null;
  return createPortal(
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3>{title}</h3>
          <button onClick={onClose} className={styles.closeBtn}><X size={18} /></button>
        </div>
        <div className={styles.body}>
          <p>{message}</p>
        </div>
        <div className={styles.footer}>
          <button onClick={onClose} className={styles.confirmBtn}>Okay</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
