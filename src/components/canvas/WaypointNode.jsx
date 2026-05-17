import { Handle, Position } from '@xyflow/react';
import { useProject } from '../../context/ProjectContext';
import styles from './WaypointNode.module.css';

export default function WaypointNode({ id }) {
  const { drawingWire, startDrawingWire, completeDrawingWire } = useProject();

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
    <div className={styles.node} title="Route Point: Drag anywhere to bend and route wires flexibly">
      <Handle 
        type="target" 
        position={Position.Left} 
        id="input" 
        onClick={handleInputClick}
        className={`${styles.targetHandle} ${drawingWire ? '' : styles.pointerDisabled}`} 
      />
      <div className={styles.dot} />
      <Handle 
        type="source" 
        position={Position.Right} 
        id="output" 
        onClick={handleOutputClick}
        className={`${styles.sourceHandle} ${drawingWire ? '' : styles.pointerDisabled}`} 
      />
    </div>
  );
}
