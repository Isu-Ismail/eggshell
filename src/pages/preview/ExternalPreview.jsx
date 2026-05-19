import { useEffect, useState, useRef } from 'react';
import { useSqlite } from '../../hooks/useSqlite';
import { buildMappingQuery } from '../../services/sqlBuilder';
import { Download, RefreshCw, Layers, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { AlertModal } from '../../components/ui/Modal';
import ExportModal from '../../components/canvas/ExportModal';
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
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportMode, setExportMode] = useState('csv');

  const channelRef = useRef(null);
  const pendingQueriesRef = useRef(new Map());

  const outputNodes = nodes.filter(n => n.type === 'outputNode');
  const sourceNodes = nodes.filter(n => n.type === 'sourceNode');
  const mappedOutputNodes = outputNodes.filter(node => edges.some(e => e.target === node.id));

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

  // End of helper methods

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

  // End of bulk export logic

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

          <button 
            className={styles.exportBtn} 
            onClick={() => {
              setExportMode('csv');
              setIsExportModalOpen(true);
            }}
            disabled={mappedOutputNodes.length === 0}
            title="Export compiled data layouts as CSV files or multi-sheet Excel workbooks"
          >
            <Download size={16} /> Export CSV / Excel
          </button>

          <button 
            className={styles.exportBtn} 
            style={{ background: '#3b82f6' }}
            onClick={() => {
              setExportMode('sqlite');
              setIsExportModalOpen(true);
            }}
            disabled={mappedOutputNodes.length === 0}
            title="Export compiled data layouts as tables in SQLite databases or SQL dump scripts"
          >
            <Download size={16} /> Export SQLite / SQL
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

      <ExportModal 
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        mode={exportMode}
        nodes={nodes}
        edges={edges}
        executeQuery={executeQueryRemote}
        setAlertState={setAlertState}
      />

      <AlertModal 
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        onClose={() => setAlertState({ ...alertState, isOpen: false })}
      />
    </div>
  );
}
