import { useState, useEffect } from 'react';
import { Download, X, CheckSquare, Square, FileSpreadsheet, Database } from 'lucide-react';
import ExcelJS from 'exceljs';
import initSqlJs from 'sql.js';
import { buildMappingQuery } from '../../services/sqlBuilder';
import { sanitizeColumnName } from '../../utils/helpers';
import styles from './ExportModal.module.css';

export default function ExportModal({ 
  isOpen, 
  onClose, 
  mode, // 'csv' or 'sqlite'
  nodes, 
  edges, 
  executeQuery, 
  setAlertState 
}) {
  const [selectedNodes, setSelectedNodes] = useState({});
  const [combineAsCollection, setCombineAsCollection] = useState(true);
  const [format, setFormat] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');

  const outputNodes = nodes.filter(n => n.type === 'outputNode');
  const mappedOutputNodes = outputNodes.filter(node => edges.some(e => e.target === node.id));

  // Initialize selection
  useEffect(() => {
    if (isOpen) {
      const initial = {};
      mappedOutputNodes.forEach(node => {
        initial[node.id] = true;
      });
      setSelectedNodes(initial);
      
      // Default formats based on mode
      if (mode === 'csv') {
        setFormat('xlsx'); // Excel combined is default
        setCombineAsCollection(true);
      } else {
        setFormat('sqlite');
        setCombineAsCollection(true);
      }
    }
  }, [isOpen, mode, nodes, edges]);

  // Adjust options based on state
  useEffect(() => {
    if (mode === 'csv') {
      if (combineAsCollection) {
        setFormat('xlsx');
      } else {
        setFormat('csv');
      }
    }
  }, [combineAsCollection, mode]);

  if (!isOpen) return null;

  const handleToggleNode = (nodeId) => {
    setSelectedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  const handleToggleAll = () => {
    const anyUnselected = mappedOutputNodes.some(n => !selectedNodes[n.id]);
    const next = {};
    mappedOutputNodes.forEach(n => {
      next[n.id] = anyUnselected;
    });
    setSelectedNodes(next);
  };

  const isAllSelected = mappedOutputNodes.length > 0 && mappedOutputNodes.every(n => !!selectedNodes[n.id]);

  const runExport = async () => {
    const selectedIds = Object.keys(selectedNodes).filter(id => selectedNodes[id]);
    if (selectedIds.length === 0) {
      setAlertState({ 
        isOpen: true, 
        title: "Export Failed", 
        message: "Please select at least one output node to export." 
      });
      return;
    }

    setIsExporting(true);
    setExportProgress('Starting export...');

    try {
      if (mode === 'csv') {
        if (combineAsCollection && format === 'xlsx') {
          await exportAsCombinedExcel(selectedIds);
        } else {
          await exportAsIndividualCSVs(selectedIds);
        }
      } else {
        if (format === 'sqlite' || format === 'db') {
          await exportAsSQLite(selectedIds, combineAsCollection, format);
        } else if (format === 'sql') {
          await exportAsSQLScript(selectedIds, combineAsCollection);
        }
      }
      onClose();
    } catch (err) {
      console.error(err);
      setAlertState({
        isOpen: true,
        title: "Export Error",
        message: err.message || "An error occurred during export."
      });
    } finally {
      setIsExporting(false);
      setExportProgress('');
    }
  };

  // Helper to fetch all rows for a query in batches
  const fetchAllRows = async (query, tableName) => {
    const batchSize = 5000;
    let offset = 0;
    let hasMore = true;
    let allRows = [];

    while (hasMore) {
      setExportProgress(`Fetching rows for ${tableName}... (${offset} loaded)`);
      const batchQuery = `${query} LIMIT ${batchSize} OFFSET ${offset}`;
      const res = await executeQuery(batchQuery);
      const rows = Array.isArray(res) ? res : (res?.rows || []);

      if (rows && rows.length > 0) {
        allRows = allRows.concat(rows);
        offset += batchSize;
        if (rows.length < batchSize) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }
    return allRows;
  };

  // 1. Export as Excel Workbook (multiple sheets)
  const exportAsCombinedExcel = async (selectedIds) => {
    const workbook = new ExcelJS.Workbook();
    
    for (const outputId of selectedIds) {
      const node = mappedOutputNodes.find(n => n.id === outputId);
      const sheetName = node ? node.data.name.replace(/[*?:/[\]\\]/g, '') : 'Sheet'; // Excel sheet name constraints
      const query = buildMappingQuery(nodes, edges, outputId);
      
      if (!query) continue;
      
      const rows = await fetchAllRows(query, sheetName);
      if (rows.length === 0) continue;

      const worksheet = workbook.addWorksheet(sheetName.substring(0, 31)); // Max 31 chars
      const columns = Object.keys(rows[0]);
      
      worksheet.columns = columns.map(col => ({ header: col, key: col }));
      worksheet.addRows(rows);

      // Style Header Row (Neobrutalist slate)
      const headerRow = worksheet.getRow(1);
      headerRow.height = 26;
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '1F2937' } // Slate Gray matching EggShell branding
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.border = {
          top: { style: 'thin', color: { argb: '111827' } },
          left: { style: 'thin', color: { argb: '111827' } },
          bottom: { style: 'medium', color: { argb: '111827' } },
          right: { style: 'thin', color: { argb: '111827' } }
        };
      });

      // Style Data Rows & set Heights
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          row.height = 20;
          row.eachCell((cell) => {
            cell.font = { name: 'Arial', size: 10 };
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            cell.border = {
              top: { style: 'thin', color: { argb: 'E5E7EB' } },
              left: { style: 'thin', color: { argb: 'E5E7EB' } },
              bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
              right: { style: 'thin', color: { argb: 'E5E7EB' } }
            };
          });
        }
      });

      // Autofit Column Widths (evaluating all cells in each column)
      worksheet.columns.forEach((column) => {
        let maxColumnLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          let cellLength = 0;
          if (cell.value !== null && cell.value !== undefined) {
            let valStr = '';
            if (typeof cell.value === 'object') {
              if (cell.value.result !== undefined) {
                valStr = cell.value.result.toString();
              } else if (cell.value.richText) {
                valStr = cell.value.richText.map(t => t.text || '').join('');
              } else {
                valStr = JSON.stringify(cell.value);
              }
            } else {
              valStr = cell.value.toString();
            }
            cellLength = valStr.length;
          }
          if (cellLength > maxColumnLength) {
            maxColumnLength = cellLength;
          }
        });
        // Set padded width between 12 and 50 characters
        column.width = Math.max(12, Math.min(50, maxColumnLength + 4));
      });
    }

    setExportProgress('Generating Excel file...');
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    downloadBlob(blob, 'eggshell_collection.xlsx');
  };

  // 2. Export as Individual CSV Files
  const exportAsIndividualCSVs = async (selectedIds) => {
    for (const outputId of selectedIds) {
      const node = mappedOutputNodes.find(n => n.id === outputId);
      const name = node ? node.data.name.trim().toLowerCase().replace(/\s+/g, '_') : 'output';
      const query = buildMappingQuery(nodes, edges, outputId);
      
      if (!query) continue;

      const rows = await fetchAllRows(query, name);
      if (rows.length === 0) continue;

      let csvContent = '';
      const cols = Object.keys(rows[0]);
      csvContent += cols.map(c => `"${c.replace(/"/g, '""')}"`).join(',') + '\n';

      for (const row of rows) {
        const rowVals = cols.map(c => {
          const str = String(row[c] ?? '');
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        });
        csvContent += rowVals.join(',') + '\n';
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, `${name}.csv`);
    }
  };

  // 3. Export as SQLite File
  const exportAsSQLite = async (selectedIds, combine, extension = 'sqlite') => {
    setExportProgress('Initializing database engine...');
    const SQL = await initSqlJs({
      locateFile: file => `https://unpkg.com/sql.js@1.14.1/dist/${file}`
    });

    if (combine) {
      const dbInstance = new SQL.Database();
      
      for (const outputId of selectedIds) {
        const node = mappedOutputNodes.find(n => n.id === outputId);
        const tableName = node ? sanitizeColumnName(node.data.name) : 'output_table';
        const query = buildMappingQuery(nodes, edges, outputId);
        
        if (!query) continue;

        const rows = await fetchAllRows(query, tableName);
        if (rows.length === 0) continue;

        const cols = Object.keys(rows[0]);
        const colDefs = cols.map(c => `"${sanitizeColumnName(c)}" TEXT`).join(', ');
        
        dbInstance.run(`CREATE TABLE "${tableName}" (${colDefs});`);

        // Batch inserts
        const batchSize = 100;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const colNames = cols.map(c => `"${sanitizeColumnName(c)}"`).join(", ");
          const valuesArr = batch.map(row => {
            const vals = cols.map(c => `'${String(row[c] ?? "").replace(/'/g, "''")}'`);
            return `(${vals.join(', ')})`;
          });
          dbInstance.run(`INSERT INTO "${tableName}" (${colNames}) VALUES ${valuesArr.join(', ')};`);
        }
      }

      setExportProgress('Saving SQLite database file...');
      const binaryData = dbInstance.export();
      const blob = new Blob([binaryData], { type: 'application/x-sqlite3' });
      downloadBlob(blob, `eggshell_collection.${extension}`);
    } else {
      // Individual DB files
      for (const outputId of selectedIds) {
        const node = mappedOutputNodes.find(n => n.id === outputId);
        const tableName = node ? sanitizeColumnName(node.data.name) : 'output_table';
        const query = buildMappingQuery(nodes, edges, outputId);
        
        if (!query) continue;

        const rows = await fetchAllRows(query, tableName);
        if (rows.length === 0) continue;

        const dbInstance = new SQL.Database();
        const cols = Object.keys(rows[0]);
        const colDefs = cols.map(c => `"${sanitizeColumnName(c)}" TEXT`).join(', ');
        dbInstance.run(`CREATE TABLE "${tableName}" (${colDefs});`);

        // Batch inserts
        const batchSize = 100;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const colNames = cols.map(c => `"${sanitizeColumnName(c)}"`).join(", ");
          const valuesArr = batch.map(row => {
            const vals = cols.map(c => `'${String(row[c] ?? "").replace(/'/g, "''")}'`);
            return `(${vals.join(', ')})`;
          });
          dbInstance.run(`INSERT INTO "${tableName}" (${colNames}) VALUES ${valuesArr.join(', ')};`);
        }

        const binaryData = dbInstance.export();
        const blob = new Blob([binaryData], { type: 'application/x-sqlite3' });
        downloadBlob(blob, `${tableName}.${extension}`);
      }
    }
  };

  // 4. Export as SQL Dump Script (.sql file)
  const exportAsSQLScript = async (selectedIds, combine) => {
    let combinedSqlContent = '';

    for (const outputId of selectedIds) {
      const node = mappedOutputNodes.find(n => n.id === outputId);
      const tableName = node ? sanitizeColumnName(node.data.name) : 'output_table';
      const query = buildMappingQuery(nodes, edges, outputId);
      
      if (!query) continue;

      const rows = await fetchAllRows(query, tableName);
      if (rows.length === 0) continue;

      const cols = Object.keys(rows[0]);
      const colDefs = cols.map(c => `  "${sanitizeColumnName(c)}" TEXT`).join(',\n');
      
      let tableSql = `-- SQLite schema dump for ${tableName}\n`;
      tableSql += `CREATE TABLE IF NOT EXISTS "${tableName}" (\n${colDefs}\n);\n\n`;

      const colNames = cols.map(c => `"${sanitizeColumnName(c)}"`).join(", ");
      
      for (const row of rows) {
        const vals = cols.map(c => `'${String(row[c] ?? "").replace(/'/g, "''")}'`);
        tableSql += `INSERT INTO "${tableName}" (${colNames}) VALUES (${vals.join(', ')});\n`;
      }
      tableSql += `\n\n`;

      if (combine) {
        combinedSqlContent += tableSql;
      } else {
        const blob = new Blob([tableSql], { type: 'text/plain;charset=utf-8;' });
        downloadBlob(blob, `${tableName}.sql`);
      }
    }

    if (combine && combinedSqlContent) {
      const blob = new Blob([combinedSqlContent], { type: 'text/plain;charset=utf-8;' });
      downloadBlob(blob, 'eggshell_collection.sql');
    }
  };

  const downloadBlob = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            {mode === 'csv' ? <FileSpreadsheet className={styles.icon} /> : <Database className={styles.icon} />}
            <h3>{mode === 'csv' ? 'Export Data (CSV/Excel)' : 'Export Database (SQLite/SQL)'}</h3>
          </div>
          <button className={styles.closeBtn} onClick={onClose} disabled={isExporting}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          {mappedOutputNodes.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No mapped output nodes found on the canvas. Connect some source columns to your target output nodes to enable exporting!</p>
            </div>
          ) : (
            <>
              {/* Output Selection */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h4>Select Outputs to Include</h4>
                  <button className={styles.selectAllBtn} onClick={handleToggleAll} disabled={isExporting}>
                    {isAllSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                
                <div className={styles.nodesList}>
                  {mappedOutputNodes.map(node => (
                    <div 
                      key={node.id} 
                      className={`${styles.nodeItem} ${selectedNodes[node.id] ? styles.nodeItemSelected : ''}`}
                      onClick={() => !isExporting && handleToggleNode(node.id)}
                    >
                      {selectedNodes[node.id] ? <CheckSquare size={16} /> : <Square size={16} />}
                      <span>{node.data.name || 'Unnamed Output'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Export Options */}
              <div className={styles.section}>
                <h4>Export Options</h4>
                
                <div className={styles.optionRow}>
                  <label className={styles.checkboxLabel}>
                    <input 
                      type="checkbox" 
                      checked={combineAsCollection} 
                      onChange={e => setCombineAsCollection(e.target.checked)}
                      disabled={isExporting || (mode === 'csv' && format === 'xlsx')} // xlsx is always combined
                    />
                    <span>Add as Collections (Combine into a single file)</span>
                  </label>
                </div>

                <div className={styles.optionRow}>
                  <label className={styles.selectLabel}>Export Format:</label>
                  <select 
                    value={format} 
                    onChange={e => {
                      setFormat(e.target.value);
                      if (mode === 'csv' && e.target.value === 'xlsx') {
                        setCombineAsCollection(true);
                      }
                    }}
                    disabled={isExporting}
                    className={styles.select}
                  >
                    {mode === 'csv' ? (
                      <>
                        <option value="xlsx">Excel Workbook (.xlsx)</option>
                        <option value="csv">Individual CSV Files (.csv)</option>
                      </>
                    ) : (
                      <>
                        <option value="sqlite">SQLite Database File (.sqlite)</option>
                        <option value="db">SQLite Database File (.db)</option>
                        <option value="sql">SQL Dump Script (.sql)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {isExporting && (
                <div className={styles.progressContainer}>
                  <div className={styles.spinner} />
                  <p>{exportProgress}</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose} disabled={isExporting}>
            Cancel
          </button>
          <button 
            className={styles.exportBtn} 
            onClick={runExport} 
            disabled={isExporting || mappedOutputNodes.length === 0}
          >
            <Download size={16} /> {isExporting ? 'Exporting...' : 'Start Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
