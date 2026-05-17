import { useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { BrainCircuit, Copy, Code, Sliders, Check, Terminal, FileSpreadsheet } from 'lucide-react';
import styles from './AiScriptModal.module.css';

export default function AiScriptModal({ isOpen, onClose }) {
  const { files, applyJsonConfig } = useProject();
  const [activeTab, setActiveTab] = useState('prompt');
  const [copied, setCopied] = useState(false);
  const [jsonConfig, setJsonConfig] = useState(() => {
    return localStorage.getItem('excel_stitcher_ai_script') || '';
  });
  const [status, setStatus] = useState({ type: '', message: '' });
  
  // Track selected file IDs using an array state
  const [selectedFileIds, setSelectedFileIds] = useState(() => files.map(f => f.id));

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
      columns: f.headers.map(h => h.original) // Simpler, cleaner column list for AI reading!
    }))
  }, null, 2);

  // Template explaining block formats to feed into AI
  // Template explaining block formats to feed into AI
  const referenceDocs = `{
  "inputs": {
    "students_sheet": "STUDENTS.CSV",
    "mobiles_sheet": "PHONES.CSV"
  },
  "outputs": [
    {
      "output_name": "Stitched Output Year 1",
      "columns": [
        {
          "name": "STUDENT_NAME",
          "source": "students_sheet.name",
          "transforms": ["UPPER", "TRIM"]
        },
        {
          "name": "MOBILE_NUMBER",
          "source": "mobiles_sheet.mobile_number",
          "join": {
            "base_key": "students_sheet.name",
            "match_key": "mobiles_sheet.name"
          }
        },
        {
          "name": "ACADEMIC_YEAR",
          "source": "students_sheet.year",
          "filter": "{col} = '1st Year'"
        }
      ]
    },
    {
      "output_name": "Stitched Output Year 2",
      "columns": [
        {
          "name": "STUDENT_NAME",
          "source": "students_sheet.name",
          "transforms": ["UPPER", "TRIM"]
        },
        {
          "name": "ACADEMIC_YEAR",
          "source": "students_sheet.year",
          "filter": "{col} = '2nd Year'"
        }
      ]
    }
  ]
}`;

  const aiSystemPrompt = `You are an expert AI data architect for the Excel Stitcher visual pipeline editor.
Your job is to generate a valid declarative JSON configuration script that maps, joins, filters, or transforms imported files into one or more visual output sheets.

---
HERE IS THE CURRENT UPLOADED DATA SCHEMA:
${dynamicSchema}

---
HERE IS THE REFERENCE JSON FORMAT SCHEMA EXPLAINED:
1. "inputs": (object map) Key-value pairs representing "alias": "uploaded_file_name.csv". This maps friendly simple names to actual file names so you don't need temporary IDs.
2. "outputs": (array of objects) Represents one or more stitched output sheets to generate on the canvas.
   Each output object accepts:
   - "output_name": (string) Desired name of this stitched output sheet.
   - "columns": (array of objects) Represents output columns in order.
     Each column object accepts:
     - "name": (string) Desired header name in the stitched output.
     - "source": (string) Input column path in "alias_name.column_name" format, using the friendly alias declared in "inputs".
     - "transforms": (optional array of strings) String operations to apply. Choices: "UPPER", "LOWER", "TRIM".
     - "filter": (optional string) SQL WHERE condition applied on this column. Use {col} to represent values (e.g. "{col} = 'CS'").
     - "join": (optional object) If rows are mismatched/out-of-order, specify:
       {
         "base_key": "base_alias.column_name",
         "match_key": "matching_alias.column_name"
       }

---
TASK: Based on my request, generate ONLY the clean JSON configuration block. Do not write markdown wrappers (no backticks) or chat replies. Just pure, valid JSON!`;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(aiSystemPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(referenceDocs);
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
              
              <div className={styles.codeWrapper}>
                <div className={styles.codeHeader}>
                  <span>Config Schema Reference Template</span>
                  <button className={styles.copyBtn} onClick={handleCopyTemplate}>
                    {copied ? <Check size={14} className={styles.checkIcon} /> : <Copy size={14} />}
                    {copied ? 'Copied Template!' : 'Copy Template'}
                  </button>
                </div>
                <textarea 
                  readOnly 
                  className={styles.textareaReadOnly}
                  value={referenceDocs}
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
