import React from 'react';
import { Settings } from 'lucide-react';
import styles from '../InspectorModal.module.css';

export default function JoinInspector() {
  return (
    <div className={styles.joinDetails}>
      <p>
        <Settings size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} /> 
        <strong>Zero-Config Mode:</strong> This block connects two sheets automatically. Simply wire the base sheet key to the yellow base handle, the matching sheet key to the purple handle, and let the engine stitch them in order.
      </p>
    </div>
  );
}
