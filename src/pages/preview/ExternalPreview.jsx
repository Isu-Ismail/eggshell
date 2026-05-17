import { useEffect, useState, useRef } from 'react';
import { useSqlite } from '../../hooks/useSqlite';
import { buildMappingQuery } from '../../services/sqlBuilder';
import { Download, RefreshCw, Layers, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { AlertModal } from '../../components/ui/Modal';
import styles from './ExternalPreview.module.css';

export default function ExternalPreview() {
  const { execute } = useSqlite();
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  
  const [previewData, setPreviewData] = useState([]);
  const [columnOrder, setColumnOrder] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'DEFAULT' }); // ASC, DESC, DEFAULT
  
  const [errorMsg, setErrorMsg] = useState(null);
  const [limit, setLimit] = useState(10);
  const [alertState, setAlertState] = useState({ isOpen: false, title: '', message: '' });
  const [selectedOutputId, setSelectedOutputId] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBulkExportModalOpen, setIsBulkExportModalOpen] = useState(false);
  const [selectedBulkOutputIds, setSelectedBulkOutputIds] = useState({});

  const channelRef = useRef(null);
  const pendingQueriesRef = useRef(new Map());

  const outputNodes = nodes.filter(n => n.type === 'outputNode');
  const sourceNodes = nodes.filter(n => n.type === 'sourceNode');

  // Initialize Broadcast Channel to listen to the Main tab
  useEffect(() => {
    const channel = new BroadcastChannel('stitcher_sync');
    channelRef.current = channel;

    channel.onmessage = (event) => {
      const { type, id, nodes: syncedNodes, edges: syncedEdges, res, error } = event.data;

      if (type === 'STATE_UPDATE') {
        setIsSyncing(true);
        setNodes(syncedNodes || []);
        setEdges(syncedEdges || []);
        setTimeout(() => setIsSyncing(false), 300);
      } else if (type === 'QUERY_RESULT') {
        const callback = pendingQueriesRef.current.get(id);
        if (callback) {
          callback({ res, error });
          pendingQueriesRef.current.delete(id);
        }
      }
    };

    // Request current workspace state immediately on mount
    channel.postMessage({ type: 'REQUEST_STATE' });

    return () => {
      channel.close();
    };
  }, []);

  // Sync selectedOutputId with synced output nodes & source nodes
  useEffect(() => {
    if (outputNodes.length > 0 || sourceNodes.length > 0) {
      if (!selectedOutputId) {
        if (outputNodes.length > 0) {
          setSelectedOutputId(outputNodes[0].id);
        } else {
          setSelectedOutputId(`source_${sourceNodes[0].id}`);
        }
      } else {
        const isOutputValid = outputNodes.some(n => n.id === selectedOutputId);
        const isSourceValid = sourceNodes.some(n => `source_${n.id}` === selectedOutputId);
        if (!isOutputValid && !isSourceValid) {
          if (outputNodes.length > 0) {
            setSelectedOutputId(outputNodes[0].id);
          } else if (sourceNodes.length > 0) {
            setSelectedOutputId(`source_${sourceNodes[0].id}`);
          } else {
            setSelectedOutputId('');
          }
        }
      }
    } else {
      setSelectedOutputId('');
    }
  }, [nodes, selectedOutputId, outputNodes, sourceNodes]);

  // Reset column order and sorting when switching active sheet/output
  useEffect(() => {
    setColumnOrder([]);
    setSortConfig({ key: null, direction: 'DEFAULT' });
  }, [selectedOutputId]);

  // Execute query via Broadcast Channel proxy to use the Main Tab's SQLite connection
  const executeQueryRemote = (query) => {
    return new Promise((resolve, reject) => {
      if (!channelRef.current) {
        reject(new Error("Sync channel not active"));
        return;
      }
      const queryId = `q_${Math.random().toString(36).substr(2, 9)}`;
      pendingQueriesRef.current.set(queryId, ({ res, error }) => {
        if (error) reject(new Error(error));
        else resolve(res);
      });
      channelRef.current.postMessage({ type: 'EXECUTE_QUERY', id: queryId, query });
    });
  };

  // Helper to compile the active base SQLite query with sorting rules
  const getBaseQuery = (applySort = true) => {
    if (!selectedOutputId) return null;
    
    let query = '';
    if (selectedOutputId.startsWith('source_')) {
      const sourceId = selectedOutputId.replace('source_', '');
      query = `SELECT * FROM "${sourceId}"`;
    } else {
      query = buildMappingQuery(nodes, edges, selectedOutputId);
    }
    
    if (query && applySort && sortConfig.key && sortConfig.direction !== 'DEFAULT') {
      // Safely order by lowercase column alias in SQLite for robust case-insensitive alphabetical sorting
      query += ` ORDER BY LOWER("${sortConfig.key}") ${sortConfig.direction}`;
    }
    return query;
  };

  // Fetch Preview whenever state, selected node, sorting, or limit changes
  useEffect(() => {
    if (!selectedOutputId || (edges.length === 0 && !selectedOutputId.startsWith('source_')) || nodes.length === 0) {
      setPreviewData([]);
      setErrorMsg(null);
      setColumnOrder([]);
      return;
    }

    const fetchPreview = async () => {
      try {
        const query = getBaseQuery(true);
        if (query) {
          const res = await executeQueryRemote(query + ` LIMIT ${limit}`);
          if (res && res.length > 0) {
            setPreviewData(res);
            setErrorMsg(null);
            
            // Set default column order if not set yet or has column mismatch
            const databaseColumns = Object.keys(res[0]);
            if (columnOrder.length === 0 || !databaseColumns.every(k => columnOrder.includes(k)) || columnOrder.length !== databaseColumns.length) {
              setColumnOrder(databaseColumns);
            }
          } else {
            setPreviewData([]);
            setErrorMsg(null);
            setColumnOrder([]);
          }
        } else {
          setPreviewData([]);
          setErrorMsg(null);
          setColumnOrder([]);
        }
      } catch (err) {
        console.error("Preview sync error", err);
        setErrorMsg(err.message || "SQL Error: Check main canvas page");
      }
    };

    fetchPreview();
  }, [nodes, edges, limit, selectedOutputId, sortConfig]);

  const handleExport = async () => {
    if (!selectedOutputId) return;
    const query = getBaseQuery(true); // Respects row sorting in database
    if (!query) return;

    let suggestedFileName = 'stitched_output.csv';
    if (selectedOutputId.startsWith('source_')) {
      const sourceId = selectedOutputId.replace('source_', '');
      const srcNode = sourceNodes.find(n => n.id === sourceId);
      suggestedFileName = srcNode 
        ? `raw_${srcNode.data.fileName.trim().toLowerCase().replace(/\s+/g, '_')}`
        : 'raw_source.csv';
      if (!suggestedFileName.endsWith('.csv')) suggestedFileName += '.csv';
    } else {
      const selectedNode = outputNodes.find(n => n.id === selectedOutputId);
      suggestedFileName = selectedNode 
        ? `${selectedNode.data.name.trim().toLowerCase().replace(/\s+/g, '_')}.csv`
        : 'stitched_output.csv';
    }

    try {
      let fileHandle = null;
      if (window.showSaveFilePicker) {
        try {
          fileHandle = await window.showSaveFilePicker({
            suggestedName: suggestedFileName,
            types: [{
              description: 'CSV File',
              accept: { 'text/csv': ['.csv'] },
            }],
          });
        } catch (err) {
          return;
        }
      }

      const batchSize = 10000;
      let offset = 0;
      let hasMore = true;
      let isFirstBatch = true;
      let fullCsvBlobData = [];

      let writable = null;
      if (fileHandle) {
        writable = await fileHandle.createWritable();
      }

      while (hasMore) {
        const batchQuery = `${query} LIMIT ${batchSize} OFFSET ${offset}`;
        const res = await executeQueryRemote(batchQuery);
        
        if (res && res.length > 0) {
          let chunkStr = '';
          const cols = columnOrder.length > 0 ? columnOrder : Object.keys(res[0]);
          
          if (isFirstBatch) {
            chunkStr += cols.map(c => `"${c.replace(/"/g, '""')}"`).join(',') + '\n';
            isFirstBatch = false;
          }
          
          for (const row of res) {
             const rowVals = cols.map(c => {
                const str = String(row[c] ?? '');
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                  return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
             });
             chunkStr += rowVals.join(',') + '\n';
          }
          
          if (writable) {
             await writable.write(chunkStr);
          } else {
             fullCsvBlobData.push(chunkStr);
          }
          
          offset += batchSize;
        } else {
          hasMore = false;
        }
      }

      if (writable) {
        await writable.close();
      } else {
        const blob = new Blob(fullCsvBlobData, { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", suggestedFileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Export failure", err);
      setAlertState({ 
        isOpen: true, 
        title: "Export Failed", 
        message: err.message || "Failed to download CSV compiled output." 
      });
    }
  };

  const moveColumn = (colName, direction) => {
    const idx = columnOrder.indexOf(colName);
    if (idx === -1) return;
    
    const newOrder = [...columnOrder];
    if (direction === 'left' && idx > 0) {
      newOrder[idx] = newOrder[idx - 1];
      newOrder[idx - 1] = colName;
    } else if (direction === 'right' && idx < newOrder.length - 1) {
      newOrder[idx] = newOrder[idx + 1];
      newOrder[idx + 1] = colName;
    }
    setColumnOrder(newOrder);
  };

  const toggleSort = (colName) => {
    setSortConfig(prev => {
      if (prev.key !== colName) {
        return { key: colName, direction: 'ASC' };
      } else if (prev.direction === 'ASC') {
        return { key: colName, direction: 'DESC' };
      } else {
        return { key: null, direction: 'DEFAULT' };
      }
    });
  };

  const handleResetDefault = () => {
    setSortConfig({ key: null, direction: 'DEFAULT' });
    if (previewData.length > 0) {
      setColumnOrder(Object.keys(previewData[0]));
    }
  };

  // Bulk Export Handlers
  const handleToggleBulkNode = (nodeId) => {
    setSelectedBulkOutputIds(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  const handleToggleAllBulk = () => {
    const allMapped = outputNodes.filter(n => edges.some(e => e.target === n.id));
    const anyUnselected = allMapped.some(n => !selectedBulkOutputIds[n.id]);
    
    const nextMap = {};
    if (anyUnselected) {
      allMapped.forEach(n => {
        nextMap[n.id] = true;
      });
    }
    setSelectedBulkOutputIds(nextMap);
  };

  const isAllBulkSelected = outputNodes
    .filter(n => edges.some(e => e.target === n.id))
    .every(n => !!selectedBulkOutputIds[n.id]);

  const handleBulkExport = async () => {
    const activeTargets = Object.entries(selectedBulkOutputIds)
      .filter(([_, checked]) => checked)
      .map(([id]) => id);

    if (activeTargets.length === 0) {
      setAlertState({ 
        isOpen: true, 
        title: "Export Cancelled", 
        message: "Please select at least one visual output file to export." 
      });
      return;
    }

    setIsBulkExportModalOpen(false);
    let successCount = 0;
    let failedCount = 0;

    for (const outputId of activeTargets) {
      const query = buildMappingQuery(nodes, edges, outputId);
      if (!query) {
        failedCount++;
        continue;
      }

      const node = outputNodes.find(n => n.id === outputId);
      const suggestedFileName = node 
        ? `${node.data.name.trim().toLowerCase().replace(/\s+/g, '_')}.csv`
        : 'stitched_output.csv';

      try {
        const batchSize = 10000;
        let offset = 0;
        let hasMore = true;
        let isFirstBatch = true;
        let fullCsvBlobData = [];

        while (hasMore) {
          const batchQuery = `${query} LIMIT ${batchSize} OFFSET ${offset}`;
          const res = await executeQueryRemote(batchQuery);
          
          if (res && res.length > 0) {
            let chunkStr = '';
            if (isFirstBatch) {
              const cols = Object.keys(res[0]);
              chunkStr += cols.map(c => `"${c.replace(/"/g, '""')}"`).join(',') + '\n';
              isFirstBatch = false;
            }
            
            for (const row of res) {
               const rowVals = Object.values(row).map(v => {
                  const str = String(v ?? '');
                  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                  }
                  return str;
               });
               chunkStr += rowVals.join(',') + '\n';
            }
            
            fullCsvBlobData.push(chunkStr);
            offset += batchSize;
          } else {
            hasMore = false;
          }
        }

        const blob = new Blob(fullCsvBlobData, { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", suggestedFileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        successCount++;
      } catch (err) {
        console.error(`Failed to remote export ${outputId}`, err);
        failedCount++;
      }
    }

    if (failedCount > 0) {
      setAlertState({ 
        isOpen: true, 
        title: "Bulk Export Complete (with warnings)", 
        message: `Successfully exported ${successCount} files. ${failedCount} files failed or had empty columns.` 
      });
    } else {
      setAlertState({ 
        isOpen: true, 
        title: "Success", 
        message: `Successfully exported all ${successCount} selected output files!` 
      });
    }
  };

  const selectedNode = selectedOutputId.startsWith('source_')
    ? sourceNodes.find(n => n.id === selectedOutputId.replace('source_', ''))
    : outputNodes.find(n => n.id === selectedOutputId);

  const isSelectedNodeMapped = selectedOutputId.startsWith('source_')
    ? true
    : edges.some(e => e.target === selectedOutputId);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <Layers size={24} className={styles.logoIcon} />
          <div>
            <h1>Stitcher Preview Monitor</h1>
            <p className={styles.syncIndicator}>
              <span className={`${styles.statusDot} ${isSyncing ? styles.pulse : ''}`} />
              {isSyncing ? "Syncing canvas..." : "Live Synced with Canvas Tab"}
            </p>
          </div>
        </div>

        <div className={styles.actions}>
          {(outputNodes.length > 0 || sourceNodes.length > 0) && (
            <select 
              className={styles.selectDropdown}
              value={selectedOutputId}
              onChange={e => setSelectedOutputId(e.target.value)}
              title="Select dataset to preview"
            >
              {outputNodes.length > 0 && (
                <optgroup label="Stitched Outputs">
                  {outputNodes.map(node => (
                    <option key={node.id} value={node.id}>
                      {node.data.name || 'Unnamed Output'}
                    </option>
                  ))}
                </optgroup>
              )}
              {sourceNodes.length > 0 && (
                <optgroup label="Original Uploaded Files">
                  {sourceNodes.map(node => (
                    <option key={node.id} value={`source_${node.id}`}>
                      {node.data.fileName || 'Unnamed File'} (Raw Input)
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          )}

          {previewData.length > 0 && (
            <>
              <button onClick={() => setLimit(l => l + 20)} className={styles.loadMoreBtn}>
                Load More
              </button>
              
              <button 
                onClick={handleResetDefault} 
                className={styles.resetBtn}
                title="Reset column order and row sort back to original default"
              >
                <RotateCcw size={16} /> Reset Default
              </button>
            </>
          )}

          {outputNodes.length > 1 && (
            <button 
              className={styles.bulkLaunchBtn} 
              onClick={() => setIsBulkExportModalOpen(true)}
              title="Export multiple stitched outputs in bulk"
            >
              <Download size={16} /> Export Multiple
            </button>
          )}

          <button 
            className={styles.exportBtn} 
            onClick={handleExport} 
            disabled={!selectedOutputId || !isSelectedNodeMapped}
            title="Download currently active preview dataset matching your customized column order and sorting"
          >
            <Download size={16} /> Export to CSV
          </button>
        </div>
      </header>

      <main className={styles.content}>
        {errorMsg ? (
          <div className={styles.errorCard}>
            <h3>Compilation Error</h3>
            <p>{errorMsg}</p>
          </div>
        ) : previewData.length > 0 && columnOrder.length > 0 ? (
          <div className={styles.tableCard}>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {columnOrder.map((col, idx) => {
                      const isSorted = sortConfig.key === col;
                      const direction = sortConfig.direction;
                      
                      return (
                        <th key={col}>
                          <div className={styles.thContent}>
                            <span 
                              className={styles.thLabel} 
                              onClick={() => toggleSort(col)}
                              title="Click to sort by this column"
                            >
                              {col}
                              {isSorted && direction === 'ASC' && <ArrowUp size={11} className={styles.sortIcon} />}
                              {isSorted && direction === 'DESC' && <ArrowDown size={11} className={styles.sortIcon} />}
                            </span>
                            
                            <div className={styles.columnMoveBtns}>
                              <button 
                                onClick={() => moveColumn(col, 'left')} 
                                disabled={idx === 0}
                                title="Move column left"
                                className={styles.columnMoveBtn}
                              >
                                <ArrowLeft size={10} />
                              </button>
                              <button 
                                onClick={() => moveColumn(col, 'right')} 
                                disabled={idx === columnOrder.length - 1}
                                title="Move column right"
                                className={styles.columnMoveBtn}
                              >
                                <ArrowRight size={10} />
                              </button>
                            </div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, i) => (
                    <tr key={i}>
                      {columnOrder.map((col, j) => (
                        <td key={j}>{row[col] ?? ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.tableFooter}>
              Showing first {previewData.length} records.
            </div>
          </div>
        ) : (
          <div className={styles.emptyCard}>
            <RefreshCw size={48} className={styles.emptyIcon} />
            <h2>No Wired Columns Detected</h2>
            <p>
              {selectedOutputId.startsWith('source_')
                ? "Awaiting data load..."
                : selectedNode 
                  ? `Connect columns to the "${selectedNode.data.name}" output layout on your main canvas tab to populate this preview.`
                  : "Awaiting workspace connections. Open the Excel Stitcher canvas and drag wire links from source columns to target outputs."
              }
            </p>
          </div>
        )}
      </main>

      {/* Gorgeous Neobrutalist Bulk Export Selection Modal */}
      {isBulkExportModalOpen && (
        <div className={styles.bulkModalOverlay} onClick={() => setIsBulkExportModalOpen(false)}>
          <div className={styles.bulkModal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.bulkModalHeader}>Export Stitched Files</h3>
            
            <div className={styles.bulkSelectAllRow} onClick={handleToggleAllBulk}>
              <input 
                type="checkbox" 
                checked={isAllBulkSelected} 
                onChange={handleToggleAllBulk}
                onClick={e => e.stopPropagation()}
              />
              <span className={styles.bulkSelectAllText}>
                {isAllBulkSelected ? "Deselect All Outputs" : "Select All Outputs"}
              </span>
            </div>

            <div className={styles.bulkList}>
              {outputNodes.map(node => {
                const isSelected = !!selectedBulkOutputIds[node.id];
                const isMapped = edges.some(e => e.target === node.id);
                return (
                  <div 
                    key={node.id} 
                    className={styles.bulkItem} 
                    onClick={() => isMapped && handleToggleBulkNode(node.id)}
                    style={{ opacity: isMapped ? 1 : 0.5, cursor: isMapped ? 'pointer' : 'not-allowed' }}
                  >
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      disabled={!isMapped} 
                      onChange={() => handleToggleBulkNode(node.id)}
                      onClick={e => e.stopPropagation()}
                    />
                    <span 
                      className={styles.bulkItemLabel}
                      title={node.data.name || 'Unnamed Output'}
                    >
                      {node.data.name || 'Unnamed Output'} {!isMapped && ' (Empty / Unmapped)'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className={styles.bulkActions}>
              <button 
                className={styles.bulkCancelBtn} 
                onClick={() => setIsBulkExportModalOpen(false)}
              >
                Cancel
              </button>
              <button 
                className={styles.bulkExportBtn} 
                onClick={handleBulkExport}
              >
                Export Selected
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertModal 
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        onClose={() => setAlertState({ ...alertState, isOpen: false })}
      />
    </div>
  );
}
