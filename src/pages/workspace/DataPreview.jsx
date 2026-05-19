import { useEffect, useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useSqlite } from '../../hooks/useSqlite';
import { buildMappingQuery } from '../../services/sqlBuilder';
import { Download, ChevronDown, ChevronUp } from 'lucide-react';
import { AlertModal } from '../../components/ui/Modal';
import ExportModal from '../../components/canvas/ExportModal';
import styles from './DataPreview.module.css';

export default function DataPreview() {
  const { nodes, edges, dbVersion } = useProject();
  const { execute } = useSqlite();
  const [previewData, setPreviewData] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [limit, setLimit] = useState(10);
  const [alertState, setAlertState] = useState({ isOpen: false, title: '', message: '' });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedOutputId, setSelectedOutputId] = useState('');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportMode, setExportMode] = useState('csv');

  const outputNodes = nodes.filter(n => n.type === 'outputNode');
  const mappedOutputNodes = outputNodes.filter(node => edges.some(e => e.target === node.id));

  // Sync selectedOutputId with existing nodes
  useEffect(() => {
    if (outputNodes.length > 0) {
      if (!selectedOutputId || !outputNodes.some(n => n.id === selectedOutputId)) {
        setSelectedOutputId(outputNodes[0].id);
      }
    } else {
      setSelectedOutputId('');
    }
  }, [nodes, selectedOutputId, outputNodes]);

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
          const res = await execute(query + ` LIMIT ${limit}`);
          let rows = Array.isArray(res) ? res : (res?.rows || []);

          if (rows && rows.length > 0) {
            setPreviewData(rows);
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
        console.error("Preview error", err);
        setErrorMsg(err.message || "SQL Error: Check browser console");
      }
    };
    
    fetchPreview();
  }, [nodes, edges, execute, limit, selectedOutputId, dbVersion]);

  // Selected node mapping status for visual UI preview indicators
  const selectedNode = outputNodes.find(n => n.id === selectedOutputId);
  const isSelectedNodeMapped = edges.some(e => e.target === selectedOutputId);

  return (
    <div className={`${styles.previewPanel} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3>Live Preview</h3>
          
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

          {previewData.length > 0 && !isCollapsed && (
            <button 
              onClick={() => setLimit(l => l + 20)} 
              className={styles.loadMoreBtn}
              style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '700' }}
            >
              Load More
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {!isCollapsed && (
            <>
              <button 
                className={styles.exportCsvBtn} 
                onClick={() => {
                  setExportMode('csv');
                  setIsExportModalOpen(true);
                }}
                disabled={mappedOutputNodes.length === 0 || previewData.length === 0}
                title="Export compiled data layouts as CSV files or multi-sheet Excel workbooks"
              >
                <Download size={16} /> Export CSV / Excel
              </button>
              <button 
                className={styles.exportSqlBtn} 
                onClick={() => {
                  setExportMode('sqlite');
                  setIsExportModalOpen(true);
                }}
                disabled={mappedOutputNodes.length === 0 || previewData.length === 0}
                title="Export compiled data layouts as tables in SQLite databases or SQL dump scripts"
              >
                <Download size={16} /> Export SQLite / SQL
              </button>
            </>
          )}
          <button 
            className={styles.toggleBtn} 
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expand Preview" : "Collapse Preview"}
          >
            {isCollapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>
      
      {!isCollapsed && (
        <>
          {errorMsg ? (
            <div className={styles.empty} style={{ color: '#ef4444' }}>
              {errorMsg}
            </div>
          ) : previewData.length > 0 ? (
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
          ) : (
            <div className={styles.empty}>
              {selectedNode 
                ? `Connect columns to the "${selectedNode.data.name}" Output Node to see a preview.`
                : 'Connect columns to an Output Node to see a preview.'}
            </div>
          )}
        </>
      )}
      
      {/* Gorgeous Neobrutalist Bulk Export Selection Modal */}
      <ExportModal 
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        mode={exportMode}
        nodes={nodes}
        edges={edges}
        executeQuery={execute}
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
