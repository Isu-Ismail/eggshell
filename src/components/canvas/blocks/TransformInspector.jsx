import React from 'react';
import styles from '../InspectorModal.module.css';

export default function TransformInspector({
  localType,
  handleTypeChange,
  localScript,
  handleScriptChange,
  handleFinishEditing,
  upstreamSources
}) {
  return (
    <div className={styles.formGroup}>
      <label className={styles.label}>Transformation Type:</label>
      <select 
        className={styles.select} 
        value={localType || 'UPPER'} 
        onChange={handleTypeChange}
      >
        <option value="UPPER">UPPERCASE (AA)</option>
        <option value="LOWER">lowercase (aa)</option>
        <option value="TRIM">TRIM (Auto)</option>
        <option value="SERIAL_NO">Serial Number (1, 2, 3...)</option>
        <option value="CUSTOM">Custom Script</option>
      </select>

      {localType === 'SERIAL_NO' && (
        <div className={styles.scriptGroup}>
          <span className={styles.hint} style={{ color: '#10b981', fontWeight: 700 }}>
            ⚡ Auto Generator Enabled: This block will automatically calculate and output a sequential row number (1, 2, 3...) for every record in your output spreadsheet!
          </span>
        </div>
      )}

      {localType === 'CUSTOM' && (
        <div className={styles.scriptGroup}>
          <label className={styles.label}>Custom Expression:</label>
          <input 
            type="text" 
            className={styles.input} 
            value={localScript || ''} 
            onChange={handleScriptChange}
            onBlur={() => handleFinishEditing('script', localScript, '{col}')}
            onKeyDown={(e) => { if (e.key === 'Enter') handleFinishEditing('script', localScript, '{col}'); }}
            placeholder="e.g. {col1} || ' ' || {col2}"
            title="Use {col1}, {col2} to represent input values"
          />
          <span className={styles.hint}>
            Tip: Reference input columns using <code>{`{col1}`}</code>, <code>{`{col2}`}</code>, etc. matching the order in the Connection Path above!
            {upstreamSources.length <= 1 && <span> (Or simply use <code>{`{col}`}</code>).</span>}
          </span>
        </div>
      )}
    </div>
  );
}
