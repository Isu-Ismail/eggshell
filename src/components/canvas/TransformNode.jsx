import { Handle, Position } from '@xyflow/react';
import { useProject } from '../../context/ProjectContext';
import { Eye, Trash2, Sparkles } from 'lucide-react';
import styles from './TransformNode.module.css';

export default function TransformNode({ id }) {
  const { 
    setNodes, setEdges, setInspectorNodeId,
    drawingWire, startDrawingWire, completeDrawingWire 
  } = useProject();

  const handleDelete = () => {
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
  };

  const handleInputClick = (e) => {
    e.stopPropagation();
    if (drawingWire) {
      completeDrawingWire(id, 'input');
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
        id="input" 
        onClick={handleInputClick}
        className={styles.targetHandle} 
      />
      
      <div className={styles.capsule}>
        <div className={styles.titleWrapper}>
          <Sparkles size={11} className={styles.titleIcon} />
          <span className={styles.title}>TRSF</span>
        </div>
        <div className={styles.actions}>
          <button 
            className={styles.iconBtn} 
            onClick={() => setInspectorNodeId(id)} 
            title="Inspect & Edit Transform Logic"
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
