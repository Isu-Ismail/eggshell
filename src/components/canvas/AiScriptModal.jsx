import { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useSqlite } from '../../hooks/useSqlite';
import { BrainCircuit, Copy, Code, Sliders, Check, Terminal, FileSpreadsheet } from 'lucide-react';
import styles from './AiScriptModal.module.css';

export default function AiScriptModal({ isOpen, onClose }) {
  const { files, applyJsonConfig } = useProject();
  const { execute } = useSqlite();
  const [activeTab, setActiveTab] = useState('prompt');
  const [copied, setCopied] = useState(false);
  const [jsonConfig, setJsonConfig] = useState(() => {
    return localStorage.getItem('excel_stitcher_ai_script') || '';
  });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [selectedSchemaKey, setSelectedSchemaKey] = useState('full');
  
  // Track selected file IDs using an array state
  const [selectedFileIds, setSelectedFileIds] = useState(() => files.map(f => f.id));
  const [filePreviews, setFilePreviews] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    const fetchPreviews = async () => {
      if (!execute) return;
      const previews = {};
      for (const id of selectedFileIds) {
        try {
          const res = await execute(`SELECT * FROM ${id} LIMIT 2`);
          const rows = Array.isArray(res) ? res : (res?.rows || []);
          previews[id] = rows.map(r => {
            const { __row_id, ...rest } = r;
            return rest;
          });
        } catch (e) {
          console.error("Failed to fetch preview", e);
        }
      }
      setFilePreviews(previews);
    };
    fetchPreviews();
  }, [selectedFileIds, execute, isOpen]);

  if (!isOpen) return null;

  // Toggle selection handler
  const handleToggleFile = (fileId) => {
    setSelectedFileIds(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId) 
        : [...prev, fileId]
    );
  };

  // Generate dynamic schema based ONLY on checked files
  const selectedFiles = files.filter(f => selectedFileIds.includes(f.id));
  const dynamicSchema = JSON.stringify({
    uploaded_files: selectedFiles.map((f, idx) => ({
      file_number: idx + 1,
      file_name: f.fileName,
      row_count: f.rowCount,
      columns: f.headers.map(h => h.original), // Simpler, cleaner column list for AI reading!
      example_data: filePreviews[f.id] || []
    }))
  }, null, 2);

  // Template explaining block formats to feed into AI
  // Template explaining block formats to feed into AI
  const referenceDocs = `{
  "blocks": [
    {
      "id": "students_sheet",
      "type": "sourceNode",
      "customName": "students_alias",
      "fileName": "STUDENTS.CSV"
    },
    {
      "id": "phones_sheet",
      "type": "sourceNode",
      "customName": "phones_alias",
      "fileName": "PHONES.CSV"
    },
    {
      "id": "join_students_phones",
      "type": "joinNode"
    },
    {
      "id": "trim_name",
      "type": "transformNode",
      "operation": "TRIM"
    },
    {
      "id": "upper_name",
      "type": "transformNode",
      "operation": "UPPER"
    },
    {
      "id": "custom_grade_calc",
      "type": "transformNode",
      "operation": "CUSTOM",
      "script": "(CAST({col} AS REAL) / \\"students_alias\\".\\"total_possible_marks\\") * 100"
    },
    {
      "id": "math_scores",
      "type": "mathNode",
      "expression": "{col1} + {col2}"
    },
    {
      "id": "filter_scores",
      "type": "filterNode",
      "condition": "{col} >= 50"
    },
    {
      "id": "output_report",
      "type": "outputNode",
      "name": "Stitched Student Report",
      "columns": [
        {
          "id": "col_student_name",
          "name": "STUDENT_NAME"
        },
        {
          "id": "col_phone_number",
          "name": "PHONE_NUMBER"
        },
        {
          "id": "col_grade_percentage",
          "name": "GRADE_PERCENTAGE"
        },
        {
          "id": "col_combined_marks",
          "name": "COMBINED_MARKS"
        }
      ]
    }
  ],
  "connections": [
    {
      "source": "students_sheet.name",
      "target": "join_students_phones.base"
    },
    {
      "source": "phones_sheet.student_name",
      "target": "join_students_phones.match"
    },
    {
      "source": "students_sheet.name",
      "target": "trim_name.input"
    },
    {
      "source": "trim_name.output",
      "target": "upper_name.input"
    },
    {
      "source": "upper_name.output",
      "target": "output_report.col_student_name"
    },
    {
      "source": "phones_sheet.mobile_number",
      "target": "output_report.col_phone_number"
    },
    {
      "source": "students_sheet.score_science",
      "target": "math_scores.input"
    },
    {
      "source": "students_sheet.score_maths",
      "target": "math_scores.input"
    },
    {
      "source": "math_scores.output",
      "target": "filter_scores.input"
    },
    {
      "source": "filter_scores.output",
      "target": "output_report.col_combined_marks"
    },
    {
      "source": "students_sheet.marks_obtained",
      "target": "custom_grade_calc.input"
    },
    {
      "source": "custom_grade_calc.output",
      "target": "output_report.col_grade_percentage"
    }
  ]
}`;

  const REFERENCE_SCHEMAS = {
    full: referenceDocs,
    sourceNode: `{
  "id": "attendance_sheet",
  "type": "sourceNode",
  "fileName": "file5_student_attendance.xlsx",
  "customName": "attendance_sheet"
}`,
    transformNode: `{
  "id": "transform_trim_name",
  "type": "transformNode",
  "operation": "TRIM",
  "script": "(CAST({col} AS REAL) / \\"attendance_sheet\\".\\"Total Classes Taken\\") * 100",
  "customName": "trimmed_name_alias"
}`,
    mathNode: `{
  "id": "math_percentage",
  "type": "mathNode",
  "expression": "({col2} / {col1}) * 100",
  "decimals": 2,
  "customName": "percentage_alias"
}`,
    filterNode: `{
  "id": "filter_shortage",
  "type": "filterNode",
  "condition": "{col} < 75",
  "passThroughIndex": 0,
  "customName": "shortage_filter_alias"
}`,
    conditionNode: `{
  "id": "condition_status",
  "type": "conditionNode",
  "newColumnName": "status",
  "expression": "{col} < 75",
  "trueValue": "Shortage",
  "falseValue": "Allowed",
  "rules": [
    {
      "operator": "<",
      "value": "75",
      "thenVal": "Shortage"
    }
  ],
  "elseVal": "Allowed",
  "customName": "status_alias"
}`,
    joinNode: `{
  "blocks": [
    {
      "id": "join_students_phones",
      "type": "joinNode"
    }
  ],
  "connections": [
    {
      "source": "students_sheet.name",
      "target": "join_students_phones.base"
    },
    {
      "source": "phones_sheet.student_name",
      "target": "join_students_phones.match"
    }
  ]
}`,
    outputNode: `{
  "id": "output_report",
  "type": "outputNode",
  "name": "Stitched Student Report",
  "columns": [
    {
      "id": "col_student_name",
      "name": "STUDENT_NAME"
    },
    {
      "id": "col_phone_number",
      "name": "PHONE_NUMBER"
    }
  ]
}`
  };

  const aiSystemPrompt = `You are an expert AI data architect for the EggShell visual pipeline editor.
Your job is to generate a valid declarative JSON configuration script representing a node-based data flow graph with blocks and connections.

---
HERE IS THE CURRENT UPLOADED DATA SCHEMA WITH EXAMPLE ROWS:
${dynamicSchema}

---
HERE IS THE REFERENCE JSON FORMAT SCHEMA EXPLAINED:
The configuration JSON contains two root fields: "blocks" (array) and "connections" (array).

1. "blocks": Represents all processing nodes in the data pipeline.
   Each block accepts:
   - "id": (string) Unique ID for this block (e.g. "source_1", "trim_name", "output_1").
   - "type": (string) Node type. Choices:
     * "sourceNode": Import a source spreadsheet. Requires:
       - "fileName": (string) Original file name (e.g. "STUDENTS.CSV").
       - "customName": (optional string) Friendly table alias (e.g. "students_alias").
     * "transformNode": Basic column formatting. Requires:
       - "operation": (string) Operation to apply. Choices: "UPPER", "LOWER", "TRIM", or "CUSTOM".
       - "script": (optional string) If operation is "CUSTOM", a custom SQLite select script using {col} for the incoming column, e.g., "(CAST({col} AS REAL) / \\"students_alias\\".\\"total_possible_marks\\") * 100".
       - "customName": (optional string) Friendly variable alias.
     * "mathNode": Math formulas. Requires:
       - "expression": (string) Equation using numbered inputs, e.g. "({col2} / {col1}) * 100".
       - "decimals": (optional number) Number of decimal places to round (0-10).
       - "customName": (optional string) Friendly variable alias.
     * "filterNode": Keep rows matching a condition. Requires:
       - "condition": (string) SQLite WHERE clause condition (e.g. "{col} >= 50").
       - "passThroughIndex": (optional number, defaults to 0) Index of input column to pass forward.
       - "customName": (optional string) Friendly variable alias.
     * "conditionNode": Evaluates rules to create a column. Requires:
       - "newColumnName": (optional string) Name of the column.
       - "expression": (string, alternative format) e.g. "{col} < 75".
       - "trueValue": (string, alternative format) e.g. "Shortage".
       - "falseValue": (string, alternative format) e.g. "Allowed".
       - "rules": (optional array of objects) Standard condition rules:
         * "operator": (string) e.g. "<", ">", "=", "!=", "CONTAINS".
         * "value": (string) Comparison target value.
         * "thenVal": (string) Result value if condition matches.
       - "elseVal": (optional string) Fallback result value.
       - "customName": (optional string) Friendly variable alias.
     * "joinNode": Left join two files. No other fields required.
     * "outputNode": Visual output sheet. Requires:
       - "name": (string) Sheet sheet name.
       - "columns": (array of objects) Represents output columns in order. Each column requires:
         - "id": (string) Unique ID for the column (e.g. "out_name", "out_grade").
         - "name": (string) Header name displayed in the output.

2. "connections": An array of objects defining data flow.
   Each connection object requires:
   - "source": (string) Source node ID and output handle formatted as "node_id.handle".
     * For "sourceNode", the handle is the original raw column header name (e.g. "source_1.classes_attended").
     * For processing nodes ("transformNode", "mathNode", "filterNode"), the output handle is always "output" (e.g. "trim_name.output").
   - "target": (string) Target node ID and input handle formatted as "node_id.handle".
     * For processing nodes ("transformNode", "mathNode", "filterNode"), the input handle is always "input" (e.g. "trim_name.input").
     * For "joinNode", target handles are "base" (primary sheet key column) and "match" (lookup sheet key column).
     * For "outputNode", the target handle is the column's unique ID (e.g. "output_1.out_name").

---
REFERENCE JSON SCHEMA EXAMPLE:
${referenceDocs}

---
TASK: Based on my request, please explain your thought process and then provide the JSON configuration block. You may use markdown.`;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(aiSystemPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(REFERENCE_SCHEMAS[selectedSchemaKey]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    setStatus({ type: '', message: '' });
    if (!jsonConfig.trim()) {
      setStatus({ type: 'error', message: 'Configuration text is empty.' });
      return;
    }

    const res = applyJsonConfig(jsonConfig);
    if (res.success) {
      setStatus({ type: 'success', message: 'Pipeline configuration loaded successfully! Canvas re-wired.' });
      setTimeout(() => {
        onClose();
        setStatus({ type: '', message: '' });
      }, 1500);
    } else {
      setStatus({ type: 'error', message: `Parse Error: ${res.error || 'Invalid JSON format.'}` });
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>
            <BrainCircuit size={18} className={styles.headerIcon} /> AI Scripting & Config Panel
          </h3>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        <div className={styles.tabsRow}>
          <button 
            className={`${styles.tab} ${activeTab === 'prompt' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('prompt')}
          >
            <BrainCircuit size={13} /> Copy AI Prompt
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'reference' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('reference')}
          >
            <Code size={13} /> JSON Reference Spec
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'apply' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('apply')}
          >
            <Sliders size={13} /> Paste JSON Config
          </button>
        </div>

        <div className={styles.body}>
          {activeTab === 'prompt' && (
            <div className={styles.tabContent}>
              <p className={styles.helpText}>
                Select the files below to include in your AI data context. The system prompt will auto-generate in real-time. Feed it directly to ChatGPT/Gemini to write your configuration script!
              </p>

              {/* PocketBase Style Interactive Checkbox Selection Card Grid */}
              <div className={styles.fileSelectorZone}>
                <div className={styles.selectorHeader}>Select Sheets for AI Context:</div>
                <div className={styles.checkboxGrid}>
                  {files.length > 0 ? (
                    files.map((file, idx) => {
                      const isChecked = selectedFileIds.includes(file.id);
                      return (
                        <label 
                          key={file.id} 
                          className={`${styles.checkboxLabel} ${isChecked ? styles.checkedCard : ''}`}
                        >
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => handleToggleFile(file.id)}
                            className={styles.realCheckbox}
                          />
                          <div className={styles.customCheckWrapper}>
                            <span className={styles.fileNum}>File {idx + 1}</span>
                            <span className={styles.fileName} title={file.fileName}>{file.fileName}</span>
                            <span className={styles.colCount}>{file.headers.length} Columns</span>
                          </div>
                        </label>
                      );
                    })
                  ) : (
                    <div className={styles.noFilesPrompt}>
                      <FileSpreadsheet size={16} /> No files uploaded yet. Please import sheets first.
                    </div>
                  )}
                </div>
              </div>
              
              <div className={styles.codeWrapper}>
                <div className={styles.codeHeader}>
                  <span>Auto-Generated AI Prompt Context</span>
                  <button className={styles.copyBtn} onClick={handleCopyPrompt} disabled={files.length === 0}>
                    {copied ? <Check size={14} className={styles.checkIcon} /> : <Copy size={14} />}
                    {copied ? 'Copied!' : 'Copy Prompt Context'}
                  </button>
                </div>
                <textarea 
                  readOnly 
                  className={styles.textareaReadOnly}
                  value={aiSystemPrompt}
                />
              </div>
            </div>
          )}

          {activeTab === 'reference' && (
            <div className={styles.tabContent}>
              <p className={styles.helpText}>
                Use this simple, human-readable grammar format to control output headings, data transforms, and key-based Left Joins via a config script.
              </p>
              
              <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>Select Block / Schema Spec:</label>
                <select 
                  value={selectedSchemaKey} 
                  onChange={(e) => setSelectedSchemaKey(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    backgroundColor: '#ffffff',
                    fontSize: '12px',
                    color: '#374151',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="full">Full Pipeline Schema Example</option>
                  <option value="sourceNode">Source Block (sourceNode)</option>
                  <option value="transformNode">Transform Block (transformNode)</option>
                  <option value="mathNode">Math Block (mathNode)</option>
                  <option value="filterNode">Filter Block (filterNode)</option>
                  <option value="conditionNode">Conditional Block (conditionNode)</option>
                  <option value="joinNode">Join Block (joinNode)</option>
                  <option value="outputNode">Output Block (outputNode)</option>
                </select>
              </div>

              <div className={styles.codeWrapper}>
                <div className={styles.codeHeader}>
                  <span>{
                    selectedSchemaKey === 'full' ? 'Config Schema Reference Template' : 
                    selectedSchemaKey === 'sourceNode' ? 'Source Block Spec' :
                    selectedSchemaKey === 'transformNode' ? 'Transform Block Spec' :
                    selectedSchemaKey === 'mathNode' ? 'Math Block Spec' :
                    selectedSchemaKey === 'filterNode' ? 'Filter Block Spec' :
                    selectedSchemaKey === 'conditionNode' ? 'Conditional Block Spec' :
                    selectedSchemaKey === 'joinNode' ? 'Join Block Spec' :
                    'Output Block Spec'
                  }</span>
                  <button className={styles.copyBtn} onClick={handleCopyTemplate}>
                    {copied ? <Check size={14} className={styles.checkIcon} /> : <Copy size={14} />}
                    {copied ? 'Copied Spec!' : 'Copy Spec'}
                  </button>
                </div>
                <textarea 
                  readOnly 
                  className={styles.textareaReadOnly}
                  value={REFERENCE_SCHEMAS[selectedSchemaKey]}
                />
              </div>
            </div>
          )}

          {activeTab === 'apply' && (
            <div className={styles.tabContent}>
              <p className={styles.helpText}>
                Paste the configuration JSON script generated by your AI below and click <strong>"Apply Configuration Script"</strong>. The visual programming canvas will automatically wipe, spawn the required blocks, and wire them up instantly!
              </p>
              
              <div className={styles.textareaWrapper}>
                <textarea 
                  className={styles.textareaConfig} 
                  placeholder='Paste your JSON config script here... e.g. { "output_name": "My Stitched File", "columns": [...] }'
                  value={jsonConfig}
                  onChange={e => {
                    const val = e.target.value;
                    setJsonConfig(val);
                    localStorage.setItem('excel_stitcher_ai_script', val);
                  }}
                />
              </div>

              {status.message && (
                <div className={`${styles.alert} ${status.type === 'error' ? styles.alertError : styles.alertSuccess}`}>
                  <Terminal size={14} className={styles.alertIcon} />
                  <span>{status.message}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            Close Panel
          </button>
          
          {activeTab === 'apply' && (
            <button className={styles.applyBtn} onClick={handleApply}>
              Apply Configuration Script
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
