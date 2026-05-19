import React from 'react';
import styles from '../InspectorModal.module.css';

export default function FilterInspector({
  localCondition,
  handleConditionChange,
  handleFinishEditing,
  localPassThroughIndex,
  handlePassThroughIndexChange,
  upstreamSources
}) {
  return (
    <div className={styles.formGroup} style={{ gap: '14px' }}>
      <div className={styles.formGroup}>
        <label className={styles.label}>WHERE Filter Condition:</label>
        <input 
          type="text" 
          className={styles.input} 
          value={localCondition || ''} 
          onChange={handleConditionChange}
          onBlur={() => handleFinishEditing('condition', localCondition, '{col1} IS NOT NULL')}
          onKeyDown={(e) => { if (e.key === 'Enter') handleFinishEditing('condition', localCondition, '{col1} IS NOT NULL'); }}
          placeholder="e.g. {col1} > {col2}"
        />
        <span className={styles.hint}>
          Tip: Reference inputs using <code>{`{col1}`}</code>, <code>{`{col2}`}</code>, etc. matching the order in the Connection Path above!
          {upstreamSources.length <= 1 && <span> (Or simply use <code>{`{col}`}</code>).</span>}
        </span>
      </div>

      {upstreamSources.length > 1 && (
        <div className={styles.formGroup} style={{ marginTop: '4px' }}>
          <label className={styles.label}>Select Output Flow Column:</label>
          <select 
            className={styles.select} 
            value={localPassThroughIndex || 0} 
            onChange={handlePassThroughIndexChange}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '13px',
              fontWeight: '500',
              color: '#374151',
              backgroundColor: '#fff'
            }}
          >
            {upstreamSources.map((src, idx) => (
              <option key={idx} value={idx}>
                {src.customName 
                  ? `{col${idx + 1}} / {${src.customName}} — ${src.columnName} (${src.fileName.replace(/\.[^/.]+$/, "")})`
                  : `{col${idx + 1}} — ${src.columnName} (${src.fileName.replace(/\.[^/.]+$/, "")})`}
              </option>
            ))}
          </select>
          <span className={styles.hint}>
            Since multiple columns feed into this filter, specify which one should flow out to downstream blocks.
          </span>
        </div>
      )}
    </div>
  );
}
