import { useEffect, useState, useRef } from 'react';
import { useSqlite } from '../../hooks/useSqlite';
import { buildMappingQuery } from '../../services/sqlBuilder';
import { Download, RefreshCw, Layers } from 'lucide-react';
import { AlertModal } from '../../components/ui/Modal';
import styles from './ExternalPreview.module.css';

export default function ExternalPreview() {
  const { execute } = useSqlite();
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  
  const [previewData, setPreviewData] = useState([]);
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

  // Sync selectedOutputId with synced output nodes
  useEffect(() => {
    if (outputNodes.length > 0) {
      if (!selectedOutputId || !outputNodes.some(n => n.id === selectedOutputId)) {
        setSelectedOutputId(outputNodes[0].id);
      }
    } else {
      setSelectedOutputId('');
    }
  }, [nodes, selectedOutputId, outputNodes]);

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

  // Fetch Preview whenever state, selected node, or limit changes
  useEffect(() => {
    if (!selectedOutputId || edges.length === 0 || nodes.length === 0) {
      setPreviewData([]);
      setErrorMsg(null);
      return;
    }

    const fetchPreview = async () => {
      try {
        const query = buildMappingQuery(nodes, edges, selectedOutputId);
        if (query) {
          const res = await executeQueryRemote(query + ` LIMIT ${limit}`);
          if (res && res.length > 0) {
            setPreviewData(res);
            setErrorMsg(null);
          } else {
            setPreviewData([]);
            setErrorMsg(null);
          }
        } else {
          setPreviewData([]);
          setErrorMsg(null);
        }
      } catch (err) {
        console.error("Preview sync error", err);
        setErrorMsg(err.message || "SQL Error: Check main canvas page");
      }
    };

    fetchPreview();
  }, [nodes, edges, limit, selectedOutputId]);

  const handleExport = async () => {
    if (!selectedOutputId) return;
    const query = buildMappingQuery(nodes, edges, selectedOutputId);
    if (!query) return;

    const selectedNode = outputNodes.find(n => n.id === selectedOutputId);
    const suggestedFileName = selectedNode 
      ? `${selectedNode.data.name.trim().toLowerCase().replace(/\s+/g, '_')}.csv`
      : 'stitched_output.csv';

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
          if (isFirstBatch) {
            const cols = Object.keys(res[0]);
            chunkStr += cols.join(',') + '\n';
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

      setAlertState({ isOpen: true, title: "Success", message: "Export complete! Your stitched data has been saved." });
    } catch (err) {
      console.error("Remote export error", err);
      setAlertState({ isOpen: true, title: "Export Failed", message: err.message || "Failed to export data." });
    }
  };

  // Initialize bulk selection when modal opens
  useEffect(() => {
    if (isBulkExportModalOpen) {
      const initial = {};
      outputNodes.forEach(node => {
        initial[node.id] = true;
      });
      setSelectedBulkOutputIds(initial);
    }
  }, [isBulkExportModalOpen, nodes]);

  const isAllBulkSelected = outputNodes.length > 0 && outputNodes.every(n => !!selectedBulkOutputIds[n.id]);

  const handleToggleAllBulk = () => {
    const next = {};
    const selectVal = !isAllBulkSelected;
    outputNodes.forEach(node => {
      next[node.id] = selectVal;
    });
    setSelectedBulkOutputIds(next);
  };

  const handleToggleBulkNode = (nodeId) => {
    setSelectedBulkOutputIds(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  const handleBulkExport = async () => {
    const selectedIds = Object.keys(selectedBulkOutputIds).filter(id => selectedBulkOutputIds[id]);
    if (selectedIds.length === 0) {
      setAlertState({ isOpen: true, title: "Export Failed", message: "Please select at least one output to export." });
      return;
    }

    setIsBulkExportModalOpen(false);

    let successCount = 0;
    let failedCount = 0;
    
    for (const outputId of selectedIds) {
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
              chunkStr += cols.join(',') + '\n';
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

  const selectedNode = outputNodes.find(n => n.id === selectedOutputId);
  const isSelectedNodeMapped = edges.some(e => e.target === selectedOutputId);

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
          {outputNodes.length > 0 && (
            <select 
              className={styles.selectDropdown}
              value={selectedOutputId}
              onChange={e => setSelectedOutputId(e.target.value)}
              title="Select output layout to preview"
            >
              {outputNodes.map(node => (
                <option key={node.id} value={node.id}>
                  {node.data.name || 'Unnamed Output'}
                </option>
              ))}
            </select>
          )}

          {previewData.length > 0 && (
            <button onClick={() => setLimit(l => l + 20)} className={styles.loadMoreBtn}>
              Load More
            </button>
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
        ) : previewData.length > 0 ? (
          <div className={styles.tableCard}>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {Object.keys(previewData[0]).map(col => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((val, j) => (
                        <td key={j}>{val}</td>
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
              {selectedNode 
                ? `Connect columns to the "${selectedNode.data.name}" output layout on your main canvas tab to populate this preview.`
                : "Awaiting workspace connections. Open the Excel Stitcher canvas and drag wire links from source columns to target outputs."}
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
