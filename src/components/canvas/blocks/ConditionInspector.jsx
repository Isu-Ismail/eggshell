import React from 'react';
import { Trash2 } from 'lucide-react';
import styles from '../InspectorModal.module.css';

export default function ConditionInspector({
  localNewColumnName,
  handleNewColumnNameChange,
  handleFinishEditing,
  localRules,
  handleRuleChange,
  removeRule,
  addRule,
  localElseVal,
  handleElseValChange
}) {
  return (
    <div className={styles.formGroup} style={{ gap: '14px' }}>
      <div className={styles.formGroup}>
        <label className={styles.label}>New Column Name:</label>
        <input 
          type="text" 
          className={styles.input} 
          value={localNewColumnName} 
          onChange={handleNewColumnNameChange}
          onBlur={() => handleFinishEditing('newColumnName', localNewColumnName, 'output_col')}
          onKeyDown={(e) => { if (e.key === 'Enter') handleFinishEditing('newColumnName', localNewColumnName, 'output_col'); }}
          placeholder="e.g. amount or weight_category"
        />
        <span className={styles.hint}>The name of the new column to append (lowercase, no spaces).</span>
      </div>

      <div className={styles.rulesSection}>
        <h5 className={styles.rulesSectionTitle}>Conditional Rules (If/Else-If)</h5>
        {localRules.map((rule, idx) => (
          <div key={idx} className={styles.ruleRow}>
            <span className={styles.ruleLabel}>IF &#123;col&#125;</span>
            <select 
              className={styles.ruleSelect}
              value={rule.operator}
              onChange={(e) => handleRuleChange(idx, 'operator', e.target.value)}
            >
              <option value="=">=</option>
              <option value="!=">!=</option>
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value=">=">&gt;=</option>
              <option value="<=">&lt;=</option>
              <option value="CONTAINS">CONTAINS</option>
            </select>
            <input 
              type="text" 
              className={styles.ruleInput}
              value={rule.value}
              onChange={(e) => handleRuleChange(idx, 'value', e.target.value)}
              placeholder="val"
            />
            <span className={styles.ruleLabel}>THEN</span>
            <input 
              type="text" 
              className={styles.ruleInput}
              value={rule.thenVal}
              onChange={(e) => handleRuleChange(idx, 'thenVal', e.target.value)}
              placeholder="result"
            />
            {localRules.length > 1 && (
              <button 
                className={styles.ruleDelBtn}
                onClick={() => removeRule(idx)}
                title="Remove Rule"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
        <button className={styles.addRuleBtn} onClick={addRule}>
          + Add Rule
        </button>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>ELSE Default Value:</label>
        <input 
          type="text" 
          className={styles.input} 
          value={localElseVal} 
          onChange={handleElseValChange}
          onBlur={() => handleFinishEditing('elseVal', localElseVal, '0')}
          onKeyDown={(e) => { if (e.key === 'Enter') handleFinishEditing('elseVal', localElseVal, '0'); }}
          placeholder="e.g. 0 or normal"
        />
        <span className={styles.hint}>The default fallback value written if none of the above conditions match.</span>
      </div>
    </div>
  );
}
