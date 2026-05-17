import { Handle, Position } from '@xyflow/react';
import { useProject } from '../../context/ProjectContext';
import { X } from 'lucide-react';
import styles from './SourceNode.module.css';

export default function SourceNode({ id, data }) {
  const { removeFileFromCanvas, startDrawingWire, deleteConnectionPath, edges } = useProject();

  const handleDisconnect = (headerSanitized) => {
    deleteConnectionPath(id, headerSanitized, 'source');
  };

  const handleHandleClick = (e, handleId) => {
    e.stopPropagation();
    startDrawingWire(id, handleId);
  };

  return (
    <div className={styles.node}>
      <div className={styles.header}>
        <span className={styles.headerTitle} title={data.fileName}>{data.fileName}</span>
        <button 
          className={styles.nodeRemoveBtn} 
          onClick={() => removeFileFromCanvas(id)} 
          title="Remove sheet node from workspace canvas (keeps it in sidebar list)"
        >
          <X size={14} />
        </button>
      </div>
      <div className={styles.body}>
        {data.headers.map((h) => {
          const hasOutgoing = edges.some(e => e.source === id && e.sourceHandle === h.sanitized);
          return (
            <div key={h.sanitized} className={styles.row}>
              <span>{h.original}</span>
              
              <div className={styles.handleWrapper}>
                {hasOutgoing && (
                  <button 
                    className={styles.disconnectBtn} 
                    onClick={() => handleDisconnect(h.sanitized)} 
                    title="Disconnect Whole Connection Wire Path (Clears intermediate Joints)"
                  >
                    &times;
                  </button>
                )}
                
                <Handle 
                  type="source" 
                  position={Position.Right} 
                  id={h.sanitized} 
                  onClick={(e) => handleHandleClick(e, h.sanitized)}
                  className={`${styles.handle} ${hasOutgoing ? styles.handleConnected : ''}`} 
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
