import React from 'react';
import styles from '../InspectorModal.module.css';

export default function MathInspector({
  localExpression,
  handleExpressionChange,
  handleFinishEditing,
  localRoundDecimals,
  handleRoundDecimalsChange
}) {
  return (
    <div className={styles.formGroup} style={{ gap: '14px' }}>
      <div className={styles.formGroup}>
        <label className={styles.label}>Mathematical Expression:</label>
        <input 
          type="text" 
          className={styles.input} 
          value={localExpression || ''} 
          onChange={handleExpressionChange}
          onBlur={() => handleFinishEditing('expression', localExpression, '{col1} + {col2}')}
          onKeyDown={(e) => { if (e.key === 'Enter') handleFinishEditing('expression', localExpression, '{col1} + {col2}'); }}
          placeholder="e.g. {col1} + {col2} * 1.1"
          title="Use {col1}, {col2}... to reference incoming connection variables"
        />
        <span className={styles.hint}>
          Tip: Write math expressions using standard operators: <code>+</code>, <code>-</code>, <code>*</code>, <code>/</code>, or parentheses. 
          Reference variables exactly as shown in the Connection Path (e.g. <code>{`{col1}`}</code>, <code>{`{col2}`}</code>).
          <br />
          Supports advanced math: <code>sin(x)</code>, <code>cos(x)</code>, <code>tan(x)</code>, <code>log(x)</code>, <code>ln(x)</code>, <code>exp(x)</code>, and constants: <code>pi</code>, <code>e</code>.
          <br />
          <strong style={{ color: '#ef4444' }}>Note:</strong> Any non-numeric values in these columns will cause the row to be safely skipped so your export does not crash.
        </span>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>Round Output Decimals (0 to 10):</label>
        <input 
          type="number" 
          className={styles.input} 
          min="0" 
          max="10" 
          value={localRoundDecimals} 
          onChange={(e) => {
            const val = e.target.value;
            if (val === '') {
              handleRoundDecimalsChange({ target: { value: '' } });
            } else {
              const numeric = Math.max(0, Math.min(10, parseInt(val, 10) || 0));
              handleRoundDecimalsChange({ target: { value: String(numeric) } });
            }
          }}
          placeholder="e.g. 2 (Leave blank for raw precision)"
        />
        <span className={styles.hint}>
          Specify fixed decimal points (0 to 10) to round the output. Leave blank to keep raw precision.
        </span>
      </div>
    </div>
  );
}
