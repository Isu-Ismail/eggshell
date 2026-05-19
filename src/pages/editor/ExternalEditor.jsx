import { useState, useEffect, useRef } from 'react';
import { useSqlite } from '../../hooks/useSqlite';
import { 
  X, Plus, RotateCcw, Trash2, CheckCircle, 
  Search, ArrowLeft, ArrowRight, ArrowUpDown, ChevronUp, ChevronDown, Database 
} from 'lucide-react';
import { sanitizeColumnName } from '../../utils/helpers';
import { ConfirmModal, AlertModal } from '../../components/ui/Modal';
import styles from './ExternalEditor.module.css';

export default function ExternalEditor() {
  const { execute } = useSqlite();
  
  const [fileId, setFileId] = useState('');
  const [files, setFiles] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [file, setFile] = useState(null);
  
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('Synced');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchColumn, setSearchColumn] = useState('ALL');
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'DEFAULT' }); // ASC, DESC, DEFAULT

  // Pagination states
  const [limit, setLimit] = useState(100);
  const [totalMatched, setTotalMatched] = useState(0);
  const [addedRows, setAddedRows] = useState([]);

  // Custom Modal States
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [alertConfig, setAlertConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
  });

  const channelRef = useRef(null);
  const fileIdRef = useRef('');

  const showConfirm = (title, message, onConfirm) => {
    setConfirmConfig({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        closeConfirm();
      }
    });
  };

  const closeConfirm = () => {
    setConfirmConfig(prev => ({ ...prev, isOpen: false }));
  };

  const showAlert = (title, message) => {
    setAlertConfig({
      isOpen: true,
      title,
      message,
    });
  };

  const closeAlert = () => {
    setAlertConfig(prev => ({ ...prev, isOpen: false }));
  };

  // parse fileId from URL query parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('fileId');
    if (id) {
      setFileId(id);
      fileIdRef.current = id;
    }
  }, []);

  // Sync ref to prevent stale closures inside BroadcastChannel message listener
  useEffect(() => {
    fileIdRef.current = fileId;
  }, [fileId]);

  // Initialize Broadcast Channel to sync workspace state with Main Tab
  useEffect(() => {
    const channel = new BroadcastChannel('stitcher_sync');
    channelRef.current = channel;

    channel.onmessage = (event) => {
      const { type, nodes: syncedNodes, edges: syncedEdges, files: syncedFiles } = event.data;

      if (type === 'STATE_UPDATE') {
        if (syncedFiles) {
          setFiles(prev => {
            const activeId = fileIdRef.current;
            const activePrev = prev.find(f => f.id === activeId);
            if (activePrev) {
              const mapped = syncedFiles.map(f => f.id === activeId ? activePrev : f);
              return JSON.stringify(prev) === JSON.stringify(mapped) ? prev : mapped;
            }
            return JSON.stringify(prev) === JSON.stringify(syncedFiles) ? prev : syncedFiles;
          });
        }
        if (syncedNodes) {
          setNodes(prev => JSON.stringify(prev) === JSON.stringify(syncedNodes) ? prev : syncedNodes);
        }
        if (syncedEdges) {
          setEdges(prev => JSON.stringify(prev) === JSON.stringify(syncedEdges) ? prev : syncedEdges);
        }
      }
    };

    // Request current workspace state from main tab
    channel.postMessage({ type: 'REQUEST_STATE' });

    return () => {
      channel.close();
    };
  }, []);

  // Sync active file when files context gets loaded/synced
  useEffect(() => {
    if (fileId && files.length > 0) {
      const activeFile = files.find(f => f.id === fileId);
      setFile(activeFile || null);
    }
  }, [fileId, files]);

  // Load database rows whenever filters, sorting, active file, or limit changes
  useEffect(() => {
    if (fileId && file) {
      loadData();
    }
  }, [fileId, file, searchQuery, searchColumn, sortConfig, limit]);

  // Reset limit back to 100 on filter or sort updates
  useEffect(() => {
    setLimit(100);
  }, [searchQuery, searchColumn, sortConfig]);

  // Reset added rows whenever file or query/filter parameters update
  useEffect(() => {
    setAddedRows([]);
  }, [fileId, searchQuery, searchColumn, sortConfig]);

  const loadData = async () => {
    if (!fileId) return;
    try {
      if (rows.length === 0) {
        setLoading(true);
      }
      
      // Build SQLite Search WHERE clause
      let whereClause = '';
      if (searchQuery.trim() !== '') {
        const escapedSearch = searchQuery.replace(/'/g, "''");
        if (searchColumn === 'ALL') {
          const orConditions = file.headers.map(h => `"${h.sanitized}" LIKE '%${escapedSearch}%'`).join(' OR ');
          whereClause = `WHERE (${orConditions})`;
        } else {
          whereClause = `WHERE "${searchColumn}" LIKE '%${escapedSearch}%'`;
        }
      }

      // Build SQLite ORDER BY clause
      let orderClause = '';
      if (sortConfig.key && sortConfig.direction !== 'DEFAULT') {
        orderClause = `ORDER BY LOWER("${sortConfig.key}") ${sortConfig.direction}`;
      }

      // Count total matched records
      const countRes = await execute(`SELECT COUNT(*) as cnt FROM "${fileId}" ${whereClause}`);
      const count = countRes?.[0]?.cnt || 0;
      setTotalMatched(count);

      // Fetch limited records
      const query = `SELECT * FROM "${fileId}" ${whereClause} ${orderClause} LIMIT ${limit}`;
      const res = await execute(query);
      setRows(res || []);

      // Self-cleaning: remove from addedRows if they have been loaded natively in res
      if (res && res.length > 0) {
        setAddedRows(prev => prev.filter(added => !res.some(r => r.__row_id === added.__row_id)));
      }
    } catch (err) {
      console.error("Failed to query editor rows from SQLite", err);
    } finally {
      setLoading(false);
    }
  };

  const syncWorkspaceToMain = (updatedFiles, updatedNodes, updatedEdges = edges) => {
    if (channelRef.current) {
      channelRef.current.postMessage({ 
        type: 'SYNC_WORKSPACE', 
        files: updatedFiles, 
        nodes: updatedNodes, 
        edges: updatedEdges 
      });
      channelRef.current.postMessage({ type: 'DB_MUTATED' });
      // Trigger a state update broadcast so preview tabs refresh too
      channelRef.current.postMessage({ type: 'REQUEST_STATE' });
    }
  };

  if (!file) {
    return (
      <div className={styles.emptyContainer}>
        <div className={styles.emptyCard}>
          <h2>Excel Database Editor</h2>
          <p>No active file selected, or waiting to synchronize with your main workspace tab...</p>
          <div className={styles.spinner}></div>
        </div>
      </div>
    );
  }

  const handleCellChange = (rowId, colSanitized, value) => {
    setRows(prev => prev.map(r => r.__row_id === rowId ? { ...r, [colSanitized]: value } : r));
    setAddedRows(prev => prev.map(r => r.__row_id === rowId ? { ...r, [colSanitized]: value } : r));
    setSaveStatus('Saving changes...');
  };

  const handleCellBlur = async (rowId, colSanitized, value) => {
    try {
      const escaped = String(value).replace(/'/g, "''");
      await execute(`UPDATE "${fileId}" SET "${colSanitized}" = '${escaped}' WHERE __row_id = ${rowId}`);
      setSaveStatus('Saved');
      if (channelRef.current) {
        channelRef.current.postMessage({ type: 'DB_MUTATED' });
      }
    } catch (err) {
      console.error("Failed to update cell value in SQLite", err);
      setSaveStatus('Error saving');
    }
  };

  const handleDeleteRow = (rowId) => {
    showConfirm(
      "Delete Row",
      "Are you sure you want to permanently delete this row? This cannot be undone.",
      async () => {
        try {
          await execute(`DELETE FROM "${fileId}" WHERE __row_id = ${rowId}`);
          
          setRows(prev => prev.filter(r => r.__row_id !== rowId));
          setAddedRows(prev => prev.filter(r => r.__row_id !== rowId));
          setTotalMatched(prev => Math.max(0, prev - 1));
          
          // Update global context rowCount
          const newFiles = files.map(f => f.id === fileId ? { ...f, rowCount: f.rowCount - 1 } : f);
          setFiles(newFiles);
          syncWorkspaceToMain(newFiles, nodes);
          setSaveStatus('Row deleted');
        } catch (err) {
          console.error(err);
        }
      }
    );
  };

  const handleAddRow = async () => {
    try {
      const colNames = file.headers.map(h => `"${h.sanitized}"`).join(", ");
      const emptyVals = file.headers.map(() => "''").join(", ");
      await execute(`INSERT INTO "${fileId}" (${colNames}) VALUES (${emptyVals})`);
      
      // Select the newly added row and immediately place it inside our addedRows list!
      const lastRowRes = await execute(`SELECT * FROM "${fileId}" WHERE __row_id = last_insert_rowid()`);
      if (lastRowRes && lastRowRes.length > 0) {
        setAddedRows(prev => [...prev, lastRowRes[0]]);
        setTotalMatched(prev => prev + 1);
      }
      
      const newFiles = files.map(f => f.id === fileId ? { ...f, rowCount: f.rowCount + 1 } : f);
      setFiles(newFiles);
      syncWorkspaceToMain(newFiles, nodes);
      setSaveStatus('Row added');

      // Scroll the grid wrapper to show newly added row
      setTimeout(() => {
        const wrapper = document.querySelector(`.${styles.tableWrapper}`);
        if (wrapper) {
          wrapper.scrollTo({ top: wrapper.scrollHeight, behavior: 'smooth' });
        }
      }, 100);
    } catch (err) {
      console.error(err);
    }
  };

  const handleColumnNameChange = async (header, newOriginal) => {
    if (!newOriginal || newOriginal.trim() === '') return;
    if (newOriginal === header.original) return;

    try {
      const newSanitized = sanitizeColumnName(newOriginal);
      
      // ALTER SQLite column
      await execute(`ALTER TABLE "${fileId}" RENAME COLUMN "${header.sanitized}" TO "${newSanitized}"`);
      
      // Re-map column order state if sorted
      if (sortConfig.key === header.sanitized) {
        setSortConfig({ ...sortConfig, key: newSanitized });
      }

      // Update workspace states
      const newHeaders = file.headers.map(h => h.id === header.id ? { ...h, original: newOriginal, sanitized: newSanitized } : h);
      const newFiles = files.map(f => f.id === fileId ? { ...f, headers: newHeaders } : f);
      const newNodes = nodes.map(n => n.id === fileId ? { ...n, data: { ...n.data, headers: newHeaders } } : n);
      const newEdges = edges.map(e => (e.source === fileId && e.sourceHandle === header.sanitized) ? { ...e, sourceHandle: newSanitized } : e);
      
      setFiles(newFiles);
      setNodes(newNodes);
      setEdges(newEdges);
      syncWorkspaceToMain(newFiles, newNodes, newEdges);

      setSaveStatus('Column renamed');
    } catch (err) {
      console.error("Failed to rename SQLite column", err);
      showAlert("Rename Failed", "Failed to rename column. Verify if a column with this name already exists.");
    }
  };

  const handleDeleteColumn = async (header) => {
    if (file.headers.length <= 1) {
      showAlert("Cannot Delete Column", "Cannot delete the last column of a sheet.");
      return;
    }
    
    showConfirm(
      "Delete Column",
      `Are you sure you want to permanently delete column "${header.original}" from the database?`,
      async () => {
        try {
          await execute(`ALTER TABLE "${fileId}" DROP COLUMN "${header.sanitized}"`);
          
          // Update global context states
          const newHeaders = file.headers.filter(h => h.id !== header.id);
          const newFiles = files.map(f => f.id === fileId ? { ...f, headers: newHeaders } : f);
          const newNodes = nodes.map(n => n.id === fileId ? { ...n, data: { ...n.data, headers: newHeaders } } : n);
          
          // Filter out deleted wire connections
          const cleanEdges = edges.filter(e => !(e.source === fileId && e.sourceHandle === header.sanitized));

          setFiles(newFiles);
          setNodes(newNodes);
          setEdges(cleanEdges);
          syncWorkspaceToMain(newFiles, newNodes, cleanEdges);

          setSaveStatus('Column deleted');
        } catch (err) {
          console.error("Failed to drop column in SQLite", err);
        }
      }
    );
  };

  // Move Column visually (Left/Right swaps)
  const handleMoveColumn = (index, direction) => {
    const targetIndex = direction === 'LEFT' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= file.headers.length) return;

    const newHeaders = [...file.headers];
    const temp = newHeaders[index];
    newHeaders[index] = newHeaders[targetIndex];
    newHeaders[targetIndex] = temp;

    const newFiles = files.map(f => f.id === fileId ? { ...f, headers: newHeaders } : f);
    const newNodes = nodes.map(n => n.id === fileId ? { ...n, data: { ...n.data, headers: newHeaders } } : n);

    setFiles(newFiles);
    setNodes(newNodes);
    syncWorkspaceToMain(newFiles, newNodes);
    setSaveStatus('Column reordered');
  };

  const handleSortToggle = (colSanitized) => {
    setSortConfig(prev => {
      if (prev.key !== colSanitized) {
        return { key: colSanitized, direction: 'ASC' };
      }
      if (prev.direction === 'ASC') {
        return { key: colSanitized, direction: 'DESC' };
      }
      if (prev.direction === 'DESC') {
        return { key: null, direction: 'DEFAULT' };
      }
      return { key: colSanitized, direction: 'ASC' };
    });
  };

  const handleResetToDefault = () => {
    showConfirm(
      "Reset Sheet Data",
      "Are you sure you want to revert all edits? This restores the original file content and column layouts.",
      async () => {
        try {
          setLoading(true);
          await execute(`DROP TABLE IF EXISTS "${fileId}"`);
          await execute(`CREATE TABLE "${fileId}" AS SELECT * FROM "backup_${fileId}"`);
          
          // Restore files context
          const originalHeaders = JSON.parse(JSON.stringify(file.originalHeaders || file.headers));
          const originalRowCount = file.originalRowCount !== undefined ? file.originalRowCount : file.rowCount;

          const newFiles = files.map(f => f.id === fileId ? {
            ...f,
            headers: originalHeaders,
            rowCount: originalRowCount
          } : f);

          const newNodes = nodes.map(n => n.id === fileId ? {
            ...n,
            data: { ...n.data, headers: originalHeaders }
          } : n);

          setFiles(newFiles);
          setNodes(newNodes);
          syncWorkspaceToMain(newFiles, newNodes);

          // Reset local pagination/added lists
          setAddedRows([]);
          setLimit(100);

          // Reload
          await loadData();
          setSaveStatus('Restored');
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
    );
  };

  return (
    <div className={styles.container}>
      {/* Upper Navigation Banner */}
      <div className={styles.navbar}>
        <div className={styles.navbarLeft}>
          <div className={styles.editorIcon}><Database size={18} /></div>
          <div>
            <h1>Standalone Database Spreadsheet Editor</h1>
            {files.length > 0 ? (
              <select 
                className={styles.fileSelectDropdown}
                value={fileId}
                onChange={(e) => {
                  setFileId(e.target.value);
                  const url = new URL(window.location);
                  url.searchParams.set('fileId', e.target.value);
                  window.history.pushState({}, '', url);
                }}
                title="Select different input file to edit"
              >
                {files.map(f => (
                  <option key={f.id} value={f.id}>{f.fileName}</option>
                ))}
              </select>
            ) : (
              <span className={styles.fileName}>{file.fileName}</span>
            )}
          </div>
        </div>

        <div className={styles.navbarRight}>
          <div className={styles.saveBadge}>
            <CheckCircle size={14} className={styles.saveIcon} />
            <span>{saveStatus}</span>
          </div>
          <div className={styles.stats}>
            {rows.length} rows found • {file.headers.length} columns
          </div>
          <button className={styles.closeBtn} onClick={() => window.close()} title="Close standalone tab">
            <X size={18} /> Close Tab
          </button>
        </div>
      </div>

      {/* Control Panel (Search, Sort, CRUD Controls) */}
      <div className={styles.controlPanel}>
        <div className={styles.panelLeft}>
          <button className={styles.actionBtn} onClick={handleAddRow} title="Add a blank row at the bottom">
            <Plus size={16} /> Add New Row
          </button>
          <button className={styles.resetBtn} onClick={handleResetToDefault} title="Wipe modifications and reset to backup">
            <RotateCcw size={16} /> Reset Sheet
          </button>
        </div>

        <div className={styles.searchSection}>
          <div className={styles.searchIconWrapper}>
            <Search size={16} />
          </div>
          <input 
            type="text"
            className={styles.searchInput}
            placeholder="Search rows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select 
            className={styles.searchSelect}
            value={searchColumn}
            onChange={(e) => setSearchColumn(e.target.value)}
            title="Choose search target column"
          >
            <option value="ALL">All Columns</option>
            {file.headers.map(h => (
              <option key={h.id} value={h.sanitized}>{h.original.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Editor Grid */}
      <div className={styles.gridContainer}>
        {loading ? (
          <div className={styles.loaderContainer}>
            <div className={styles.loader}></div>
            <span>Synchronizing SQLite rows...</span>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {file.headers.map((header, index) => {
                    const isSorted = sortConfig.key === header.sanitized;
                    return (
                      <th key={header.id} className={styles.th}>
                        <div className={styles.headerWrapper}>
                          {/* Reorder Arrows */}
                          <div className={styles.reorderControls}>
                            <button 
                              className={styles.reorderBtn}
                              disabled={index === 0}
                              onClick={() => handleMoveColumn(index, 'LEFT')}
                              title="Move Column Left"
                            >
                              <ArrowLeft size={10} />
                            </button>
                            <button 
                              className={styles.reorderBtn}
                              disabled={index === file.headers.length - 1}
                              onClick={() => handleMoveColumn(index, 'RIGHT')}
                              title="Move Column Right"
                            >
                              <ArrowRight size={10} />
                            </button>
                          </div>

                          {/* Editable Header Name */}
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

                          {/* Sort Actions */}
                          <div className={styles.headerActions}>
                            <button 
                              className={`${styles.sortBtn} ${isSorted ? styles.sortBtnActive : ''}`}
                              onClick={() => handleSortToggle(header.sanitized)}
                              title="Toggle Sorting (A-Z / Z-A)"
                            >
                              {isSorted ? (
                                sortConfig.direction === 'ASC' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                              ) : (
                                <ArrowUpDown size={12} />
                              )}
                            </button>
                            <button 
                              className={styles.colDelBtn}
                              onClick={() => handleDeleteColumn(header)}
                              title="Delete Column"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </th>
                    );
                  })}
                  <th className={styles.actionTh}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && addedRows.length === 0 ? (
                  <tr>
                    <td colSpan={file.headers.length + 1} className={styles.emptyCell}>
                      No rows match your query. Clear search inputs or add a row!
                    </td>
                  </tr>
                ) : (
                  <>
                    {/* 1. Render Main Paginated Rows */}
                    {rows.map(row => (
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
                    ))}

                    {/* 2. Conditionally Render the Load More row inside table tbody */}
                    {rows.length < (totalMatched - addedRows.length) && (
                      <tr className={styles.loadMoreRow}>
                        <td colSpan={file.headers.length + 1} className={styles.loadMoreTd}>
                          <div className={styles.loadMoreContainerInner}>
                            <button 
                              className={styles.loadMoreBtn}
                              onClick={() => setLimit(prev => prev + 100)}
                              title="Load the next 100 spreadsheet rows"
                            >
                              Load More Rows (Showing {rows.length} of {totalMatched - addedRows.length})
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* 3. Render Newly Added Rows (staying at the bottom for instant edits) */}
                    {addedRows.map(row => (
                      <tr key={row.__row_id} className={styles.addedRow}>
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
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={closeConfirm}
      />

      <AlertModal 
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        onClose={closeAlert}
      />
    </div>
  );
}
