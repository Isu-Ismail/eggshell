import { Handle, Position } from '@xyflow/react';
import { useProject } from '../../context/ProjectContext';
import { Eye, Trash2, Link2 } from 'lucide-react';
import styles from './JoinNode.module.css';

export default function JoinNode({ id }) {
  const { 
    setNodes, setEdges, setInspectorNodeId,
    drawingWire, startDrawingWire, completeDrawingWire 
  } = useProject();

  const handleDelete = () => {
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
  };

  const handleBaseClick = (e) => {
    e.stopPropagation();
    if (drawingWire) {
      completeDrawingWire(id, 'base');
    }
  };

  const handleMatchClick = (e) => {
    e.stopPropagation();
    if (drawingWire) {
      completeDrawingWire(id, 'match');
    }
  };

  const handleOutputClick = (e) => {
    e.stopPropagation();
    startDrawingWire(id, 'output');
  };

  return (
    <div className={styles.node}>
      <Handle 
        type="target" 
        position={Position.Left} 
        id="base" 
        style={{ top: '30%' }}
        onClick={handleBaseClick}
        className={styles.targetHandleBase} 
      />
      
      <Handle 
        type="target" 
        position={Position.Left} 
        id="match" 
        style={{ top: '70%' }}
        onClick={handleMatchClick}
        className={styles.targetHandleMatch} 
      />
      
      <div className={styles.capsule}>
        <div className={styles.titleWrapper}>
          <Link2 size={11} className={styles.titleIcon} />
          <span className={styles.title}>JOIN</span>
        </div>
        <div className={styles.actions}>
          <button 
            className={styles.iconBtn} 
            onClick={() => setInspectorNodeId(id)} 
            title="Inspect Join Matching Logic"
          >
            <Eye size={12} />
          </button>
          <button 
            className={styles.delBtn} 
            onClick={handleDelete} 
            title="Delete Block"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <Handle 
        type="source" 
        position={Position.Right} 
        id="output" 
        onClick={handleOutputClick}
        className={styles.sourceHandle} 
      />
    </div>
  );
}
