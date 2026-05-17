import { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useProject } from '../../context/ProjectContext';
import { Trash2, Copy, Eye, EyeOff, Download } from 'lucide-react';
import styles from './OutputNode.module.css';

export default function OutputNode({ id, data }) {
  const [newCol, setNewCol] = useState('');
  const { 
    addOutputColumn, updateOutputColumn, deleteOutputColumn, 
    updateOutputNodeName, deleteOutputNode, nodes, edges, files,
    drawingWire, completeDrawingWire, deleteConnectionPath, duplicateOutputNode,
    copyColumnsFromSource, hiddenOutputs, toggleOutputVisibility, exportPipelineConfig
  } = useProject();

  const handleAdd = (e) => {
    e.preventDefault();
    if (newCol.trim()) {
      addOutputColumn(id, newCol.trim());
      setNewCol('');
    }
  };

  const handleDisconnect = (colId) => {
    deleteConnectionPath(id, colId, 'target');
  };

  const handleHandleClick = (e, colId) => {
    e.stopPropagation();
    if (drawingWire) {
      completeDrawingWire(id, colId);
    }
  };

  const handleDownloadConfig = (e) => {
    e.stopPropagation();
    const configStr = exportPipelineConfig(id);
    if (!configStr) return;

    const blob = new Blob([configStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(data.name || 'pipeline_config').toLowerCase().replace(/\s+/g, '_')}_script.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isConnectionsHidden = !!hiddenOutputs[id];

  return (
    <div className={styles.node}>
      <div className={styles.header}>
        <input 
          className={styles.titleInput} 
          value={data.name ?? ''} 
          onChange={e => updateOutputNodeName(id, e.target.value)} 
          placeholder="Output Name"
          title="Rename Output Node"
        />
        <button 
          className={styles.nodeEyeBtn} 
          onClick={() => toggleOutputVisibility(id)} 
          title={isConnectionsHidden ? "Show Incoming Wires" : "Hide Incoming Wires (Declutter Canvas)"}
        >
          {isConnectionsHidden ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <button 
          className={styles.nodeDownloadBtn} 
          onClick={handleDownloadConfig} 
          title="Download Pipeline Script JSON"
        >
          <Download size={13} />
        </button>
        <button 
          className={styles.nodeCopyBtn} 
          onClick={() => duplicateOutputNode(id)} 
          title="Duplicate Output Node Layout"
        >
          <Copy size={13} />
        </button>
        <button 
          className={styles.nodeDelBtn} 
          onClick={() => deleteOutputNode(id)} 
          title="Delete Output Node"
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div className={styles.body}>
        {data.columns && data.columns.length > 0 ? (
          data.columns.map(col => {
            const hasIncoming = edges.some(e => e.target === id && e.targetHandle === col.id);
            return (
              <div key={col.id} className={styles.row}>
                <div className={styles.handleWrapper}>
                  <Handle 
                    type="target" 
                    position={Position.Left} 
                    id={col.id} 
                    onClick={(e) => handleHandleClick(e, col.id)}
                    className={styles.handle} 
                  />
                  {hasIncoming && (
                    <button 
                      className={styles.disconnectBtn} 
                      onClick={() => handleDisconnect(col.id)} 
                      title="Disconnect Whole Connection Wire Path (Clears intermediate Joints)"
                    >
                      &times;
                    </button>
                  )}
                </div>
                
                <input 
                  className={styles.editInput} 
                  value={col.name} 
                  onChange={e => updateOutputColumn(id, col.id, e.target.value)} 
                  title="Edit Column Name"
                />

                <button 
                  className={styles.delColBtn} 
                  onClick={() => deleteOutputColumn(id, col.id)}
                  title="Delete Column & Wires"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })
        ) : (
          <div className={styles.emptyContainer}>
            <div className={styles.emptyPrompt}>Draw wires here to stitch</div>
            {files.length > 0 && (
              <div className={styles.prefillWrapper}>
                <span className={styles.prefillText}>Prefill from input:</span>
                <select 
                  className={styles.prefillSelect}
                  onChange={(e) => {
                    if (e.target.value) {
                      copyColumnsFromSource(id, e.target.value);
                    }
                  }}
                  defaultValue=""
                >
                  <option value="" disabled>-- Select Input File --</option>
                  {files.map(f => (
                    <option key={f.id} value={f.id}>{f.fileName}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className={styles.footer}>
        <form onSubmit={handleAdd} className={styles.form}>
          <input 
            type="text" 
            placeholder="Add field..." 
            value={newCol}
            onChange={e => setNewCol(e.target.value)}
            className={styles.input}
          />
          <button type="submit" className={styles.btn}>+</button>
        </form>
      </div>
    </div>
  );
}
