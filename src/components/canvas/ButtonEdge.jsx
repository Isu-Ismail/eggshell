import { getBezierPath, EdgeLabelRenderer } from '@xyflow/react';
import { useProject } from '../../context/ProjectContext';

export default function ButtonEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const { onEdgeInsertClick } = useProject();

  return (
    <>
      {/* Visual Intersection Bridge Background (Thick White Stroke) */}
      <path
        style={{ stroke: '#ffffff', strokeWidth: 8, fill: 'none' }}
        d={edgePath}
      />
      
      {/* Connection Foreground Line */}
      <path
        id={id}
        style={{ ...style, strokeWidth: 3.5, stroke: '#111827', fill: 'none' }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            zIndex: 1000,
          }}
          className="nodrag nopan"
        >
          <button
            style={{
              width: '22px',
              height: '22px',
              background: '#10b981', /* Premium Green */
              color: '#ffffff',
              border: '2px solid #111827',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: '800',
              fontSize: '13px',
              boxShadow: '2px 2px 0px #111827',
              transition: 'all 0.1s',
            }}
            onClick={(event) => {
              event.stopPropagation();
              onEdgeInsertClick(id, event, { x: labelX, y: labelY });
            }}
            title="Insert Block or Route Point"
          >
            +
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
