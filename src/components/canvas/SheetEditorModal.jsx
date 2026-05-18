import { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useSqlite } from '../../hooks/useSqlite';
import { X, Plus, RotateCcw, Trash2, CheckCircle } from 'lucide-react';
import { sanitizeColumnName } from '../../utils/helpers';
import styles from './SheetEditorModal.module.css';

export default function SheetEditorModal({ fileId, isOpen, onClose }) {
  const { 
    files, 
    renameFileColumn, 
    deleteFileColumn, 
    updateFileRowCount, 
    restoreFileOriginals 
  } = useProject();
  
  const { execute } = useSqlite();
  
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('Saved to DB');

  // Synchronize active file when fileId changes
  useEffect(() => {
    if (fileId) {
      const activeFile = files.find(f => f.id === fileId);
      setFile(activeFile || null);
    }
  }, [fileId, files]);

  // Load database rows when the modal is opened or active file changes
  useEffect(() => {
    if (isOpen && fileId) {
      loadData();
    }
  }, [isOpen, fileId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await execute(`SELECT * FROM "${fileId}"`);
      setRows(res || []);
    } catch (err) {
      console.error("Failed to load sheet data", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !file) return null;

  const handleCellChange = (rowId, colSanitized, value) => {
    // Immediate local UI state update to keep typing fluid and responsive
    setRows(prev => prev.map(r => r.__row_id === rowId ? { ...r, [colSanitized]: value } : r));
    setSaveStatus('Saving changes...');
  };

  const handleCellBlur = async (rowId, colSanitized, value) => {
    try {
      const escaped = String(value).replace(/'/g, "''");
      await execute(`UPDATE "${fileId}" SET "${colSanitized}" = '${escaped}' WHERE __row_id = ${rowId}`);
      setSaveStatus('Saved to DB');
    } catch (err) {
      console.error("Failed to update cell value", err);
      setSaveStatus('Error saving');
    }
  };

  const handleDeleteRow = async (rowId) => {
    try {
      await execute(`DELETE FROM "${fileId}" WHERE __row_id = ${rowId}`);
      const updated = rows.filter(r => r.__row_id !== rowId);
      setRows(updated);
      updateFileRowCount(fileId, updated.length);
      setSaveStatus('Row deleted');
    } catch (err) {
      console.error("Failed to delete row", err);
    }
  };

  const handleAddRow = async () => {
    try {
      const colNames = file.headers.map(h => `"${h.sanitized}"`).join(", ");
      const emptyVals = file.headers.map(() => "''").join(", ");
      await execute(`INSERT INTO "${fileId}" (${colNames}) VALUES (${emptyVals})`);
      
      // Reload and update stats
      const res = await execute(`SELECT * FROM "${fileId}"`);
      const newRows = res || [];
      setRows(newRows);
      updateFileRowCount(fileId, newRows.length);
      setSaveStatus('Row added');
    } catch (err) {
      console.error("Failed to add row", err);
    }
  };

  const handleColumnNameChange = async (header, newOriginal) => {
    if (!newOriginal || newOriginal.trim() === '') return;
    if (newOriginal === header.original) return;

    try {
      const newSanitized = sanitizeColumnName(newOriginal);
      
      // SQLite Alter Table rename
      await execute(`ALTER TABLE "${fileId}" RENAME COLUMN "${header.sanitized}" TO "${newSanitized}"`);
      if (execute) {
        // Also rename in backup if needed, but keeping backup clean is fine
      }

      const newHeaders = file.headers.map(h => h.id === header.id ? { ...h, original: newOriginal, sanitized: newSanitized } : h);
      renameFileColumn(fileId, header.sanitized, newSanitized, newOriginal, newHeaders);
      
      // Reload to ensure cell keys match updated sanitized columns
      await loadData();
      setSaveStatus('Column renamed');
    } catch (err) {
      console.error("Failed to rename column", err);
      alert("Failed to rename column. Verify if a column with this name already exists.");
    }
  };

  const handleDeleteColumn = async (header) => {
    if (file.headers.length <= 1) {
      alert("Cannot delete the last column of a sheet.");
      return;
    }
    
    if (!confirm(`Are you sure you want to permanently delete column "${header.original}" from this sheet?`)) return;

    try {
      await execute(`ALTER TABLE "${fileId}" DROP COLUMN "${header.sanitized}"`);
      
      const newHeaders = file.headers.filter(h => h.id !== header.id);
      deleteFileColumn(fileId, header.sanitized, newHeaders);
      
      await loadData();
      setSaveStatus('Column deleted');
    } catch (err) {
      console.error("Failed to drop column", err);
    }
  };

  const handleResetToDefault = async () => {
    if (!confirm("Are you sure you want to revert all changes made to this sheet? This will restore the original file contents and column headers.")) return;

    try {
      setLoading(true);
      await execute(`DROP TABLE IF EXISTS "${fileId}"`);
      await execute(`CREATE TABLE "${fileId}" AS SELECT * FROM "backup_${fileId}"`);
      
      // Restore contexts
      restoreFileOriginals(fileId, file.originalHeaders, file.originalRowCount);
      
      // Reload data
      const res = await execute(`SELECT * FROM "${fileId}"`);
      setRows(res || []);
      setSaveStatus('Restored to default');
    } catch (err) {
      console.error("Failed to restore default sheet table", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Header Section */}
        <div className={styles.header}>
          <div className={styles.titleInfo}>
            <h2>Excel Database Editor</h2>
            <span className={styles.fileName}>{file.fileName}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close Editor">
            <X size={20} />
          </button>
        </div>

        {/* Action Panel */}
        <div className={styles.actionPanel}>
          <div className={styles.panelLeft}>
            <button className={styles.actionBtn} onClick={handleAddRow} title="Add a new blank row at the bottom">
              <Plus size={16} /> Add New Row
            </button>
            <button className={styles.resetBtn} onClick={handleResetToDefault} title="Reset sheet back to original upload state">
              <RotateCcw size={16} /> Reset to Default
            </button>
          </div>

          <div className={styles.panelRight}>
            <div className={styles.saveBadge}>
              <CheckCircle size={14} className={styles.saveIcon} />
              <span>{saveStatus}</span>
            </div>
            <div className={styles.stats}>
              {rows.length} rows × {file.headers.length} columns
            </div>
          </div>
        </div>

        {/* Main Grid View */}
        <div className={styles.body}>
          {loading ? (
            <div className={styles.loaderContainer}>
              <div className={styles.loader}></div>
              <span>Reading database rows...</span>
            </div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {file.headers.map(header => (
                      <th key={header.id} className={styles.th}>
                        <div className={styles.headerColWrapper}>
                          <input 
                            type="text"
                            className={styles.headerInput}
                            defaultValue={header.original}
                            onBlur={(e) => handleColumnNameChange(header, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.target.blur();
                            }}
                            title="Click to rename column"
                          />
                          <button 
                            className={styles.colDelBtn} 
                            onClick={() => handleDeleteColumn(header)}
                            title="Delete Column permanently"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className={styles.actionTh}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={file.headers.length + 1} className={styles.emptyCell}>
                        No rows found in this sheet. Click "Add New Row" to populate data!
                      </td>
                    </tr>
                  ) : (
                    rows.map(row => (
                      <tr key={row.__row_id} className={styles.tr}>
                        {file.headers.map(header => (
                          <td key={header.id} className={styles.td}>
                            <input 
                              type="text"
                              className={styles.cellInput}
                              value={row[header.sanitized] !== undefined ? row[header.sanitized] : ''}
                              onChange={(e) => handleCellChange(row.__row_id, header.sanitized, e.target.value)}
                              onBlur={(e) => handleCellBlur(row.__row_id, header.sanitized, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.target.blur();
                              }}
                            />
                          </td>
                        ))}
                        <td className={styles.tdAction}>
                          <button 
                            className={styles.rowDelBtn}
                            onClick={() => handleDeleteRow(row.__row_id)}
                            title="Delete this row"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
