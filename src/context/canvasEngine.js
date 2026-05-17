// Pure graph algorithms and path traversal routines for visual stitcher pipeline canvas
import { addEdge } from '@xyflow/react';

// 1. Delete full connection routes recursively, deleting any intermediate joint nodes
export const deleteConnectionPath = (nodeId, handleId, type = 'source', nodes, edges, setNodes, setEdges) => {
  let nodesToRemove = new Set();
  let edgesToRemove = new Set();

  const traceDownstream = (currNodeId, currHandleId) => {
    const outgoingEdges = edges.filter(e => e.source === currNodeId && e.sourceHandle === currHandleId);
    outgoingEdges.forEach(edge => {
      edgesToRemove.add(edge.id);
      const targetId = edge.target;
      const targetNode = nodes.find(n => n.id === targetId);
      
      if (targetNode && targetNode.type === 'waypointNode') {
        nodesToRemove.add(targetId);
        traceDownstream(targetId, 'output');
      }
    });
  };

  const traceUpstream = (currNodeId, currHandleId) => {
    const incomingEdges = edges.filter(e => e.target === currNodeId && e.targetHandle === currHandleId);
    incomingEdges.forEach(edge => {
      edgesToRemove.add(edge.id);
      const sourceId = edge.source;
      const sourceNode = nodes.find(n => n.id === sourceId);
      
      if (sourceNode && sourceNode.type === 'waypointNode') {
        nodesToRemove.add(sourceId);
        traceUpstream(sourceId, 'input');
      }
    });
  };

  if (type === 'source') {
    traceDownstream(nodeId, handleId);
  } else {
    traceUpstream(nodeId, handleId);
  }

  edges.forEach(edge => {
    if (nodesToRemove.has(edge.source) || nodesToRemove.has(edge.target)) {
      edgesToRemove.add(edge.id);
    }
  });

  setNodes(prev => prev.filter(n => !nodesToRemove.has(n.id)));
  setEdges(prev => prev.filter(e => !edgesToRemove.has(e.id)));
};

// 2. Clone/Duplicate Output node and its dedicated visual upstream sub-graph pipeline
export const duplicateOutputNode = (nodeId, nodes, edges, setNodes, setEdges) => {
  const originalNode = nodes.find(n => n.id === nodeId);
  if (!originalNode) return;

  const nodesToClone = new Set();
  const visited = new Set();
  
  const traverseUpstream = (currId) => {
    if (visited.has(currId)) return;
    visited.add(currId);

    const incoming = edges.filter(e => e.target === currId);
    incoming.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (sourceNode && sourceNode.type !== 'sourceNode') {
        nodesToClone.add(sourceNode);
        traverseUpstream(edge.source);
      }
    });
  };

  traverseUpstream(nodeId);

  const nodeIdMapping = {};
  const clonedIntermediateNodes = Array.from(nodesToClone).map(oldNode => {
    const newId = `${oldNode.type}_${Date.now()}_copied_${Math.random().toString(36).substr(2, 5)}`;
    nodeIdMapping[oldNode.id] = newId;
    return {
      ...oldNode,
      id: newId,
      position: {
        x: oldNode.position.x + 40,
        y: oldNode.position.y + 40
      },
      data: JSON.parse(JSON.stringify(oldNode.data))
    };
  });

  const newOutputId = `output_${Date.now()}`;
  nodeIdMapping[nodeId] = newOutputId;

  const colIdMapping = {};
  const copiedColumns = (originalNode.data.columns || []).map(col => {
    const newColId = `out_col_${Math.random().toString(36).substr(2, 9)}`;
    colIdMapping[col.id] = newColId;
    return {
      id: newColId,
      name: col.name
    };
  });

  const newOutputNode = {
    id: newOutputId,
    type: 'outputNode',
    position: { 
      x: originalNode.position.x + 40,
      y: originalNode.position.y + 40 
    },
    data: {
      name: `${originalNode.data.name || 'STITCHED OUTPUT'} (COPY)`,
      columns: copiedColumns,
      filter: originalNode.data.filter || ''
    }
  };

  setNodes(prev => [...prev, ...clonedIntermediateNodes, newOutputNode]);

  setEdges(prevEdges => {
    const newEdges = [...prevEdges];

    prevEdges.forEach(edge => {
      const isTargetOutput = edge.target === nodeId;
      const isTargetIntermediate = visited.has(edge.target) && edge.target !== nodeId;

      if (isTargetOutput || isTargetIntermediate) {
        const clonedSourceId = nodeIdMapping[edge.source] || edge.source;
        const clonedTargetId = nodeIdMapping[edge.target];
        const clonedTargetHandle = isTargetOutput ? colIdMapping[edge.targetHandle] : edge.targetHandle;

        if (clonedTargetId) {
          newEdges.push({
            id: `edge_${Date.now()}_copied_${Math.random().toString(36).substr(2, 5)}`,
            source: clonedSourceId,
            sourceHandle: edge.sourceHandle,
            target: clonedTargetId,
            targetHandle: clonedTargetHandle,
            type: edge.type || 'buttonEdge',
            animated: edge.animated ?? true,
            style: edge.style || { stroke: '#111827', strokeWidth: 3 }
          });
        }
      }
    });

    return newEdges;
  });
};

// 3. Auto-arrange nodes topologically for neat visual alignment and overlap prevention
export const autoArrangeCanvas = (nodes, edges, setNodes) => {
  // Clone nodes to update positions
  const updatedNodes = nodes.map(n => ({
    ...n,
    position: { ...n.position }
  }));

  // A. Align Source Nodes vertically centered on the far left relative to output tracks
  const sourceNodes = updatedNodes.filter(n => n.type === 'sourceNode');
  const hasMultipleSourceCols = sourceNodes.length > 4;
  const sourceColCount = hasMultipleSourceCols ? 2 : 1;
  const sourceCellWidth = 280;
  const sourceCellHeight = 280;

  // B. Align Output Nodes vertically stacked in clean parallel swimlanes or grid
  const outputNodes = updatedNodes.filter(n => n.type === 'outputNode');
  const hasMultipleOutputCols = outputNodes.length > 3;
  const outputColWidth = 850;
  const startOutputX = hasMultipleSourceCols ? 1200 : 950;
  let currentY = 100;

  if (!hasMultipleOutputCols) {
    outputNodes.forEach((node) => {
      node.position = { x: startOutputX, y: currentY };
      const colsCount = (node.data?.columns || []).length;
      const cardHeight = Math.max(220, colsCount * 45 + 160);
      // Move Y cursor for the next swimlane with generous margins
      currentY += cardHeight + 120;
    });
  } else {
    // Two column grid layout for multiple output nodes to cut height in half
    for (let i = 0; i < outputNodes.length; i += 2) {
      const node1 = outputNodes[i];
      const node2 = outputNodes[i + 1];

      const colsCount1 = (node1.data?.columns || []).length;
      const cardHeight1 = Math.max(220, colsCount1 * 45 + 160);

      const colsCount2 = node2 ? (node2.data?.columns || []).length : 0;
      const cardHeight2 = node2 ? Math.max(220, colsCount2 * 45 + 160) : 0;

      const rowHeight = Math.max(cardHeight1, cardHeight2);

      node1.position = { x: startOutputX, y: currentY };
      if (node2) {
        node2.position = { x: startOutputX + outputColWidth, y: currentY };
      }

      currentY += rowHeight + 150;
    }
  }

  const totalPipelineHeight = currentY - 150; // total visual layout height range
  const centerY = totalPipelineHeight / 2;

  // Align source nodes in single column or dual column grid depending on count
  if (!hasMultipleSourceCols) {
    const totalSourceHeight = sourceNodes.length * sourceCellHeight - 80;
    const startSourceY = Math.max(100, centerY - (totalSourceHeight / 2));
    sourceNodes.forEach((node, index) => {
      node.position = { x: 50, y: startSourceY + index * sourceCellHeight };
    });
  } else {
    const rowCount = Math.ceil(sourceNodes.length / sourceColCount);
    const totalSourceHeight = rowCount * sourceCellHeight - 80;
    const startSourceY = Math.max(100, centerY - (totalSourceHeight / 2));
    sourceNodes.forEach((node, index) => {
      const colIdx = index % sourceColCount;
      const rowIdx = Math.floor(index / sourceColCount);
      node.position = {
        x: 50 + colIdx * sourceCellWidth,
        y: startSourceY + rowIdx * sourceCellHeight
      };
    });
  }

  // C. Trace upstream and align intermediate blocks nicely per column Y track of their specific output lane
  const placedIntermediateNodeIds = new Set();

  outputNodes.forEach((outputNode) => {
    const columns = outputNode.data.columns || [];
    columns.forEach((col, colIdx) => {
      // Aligned with the specific Y track of the column handle inside this swimlane
      const yCol = outputNode.position.y + 60 + colIdx * 45;

      const traceAndArrange = (currentNodeId, currentHandleId, depth = 1) => {
        // Find all incoming edges (including waypoint joints)
        const incomingEdges = edges.filter(e => e.target === currentNodeId && e.targetHandle === currentHandleId);
        
        incomingEdges.forEach(edge => {
          const sourceNode = updatedNodes.find(n => n.id === edge.source);
          if (!sourceNode) return;

          // Align if intermediate block
          if (sourceNode.type !== 'sourceNode' && sourceNode.type !== 'outputNode') {
            if (!placedIntermediateNodeIds.has(sourceNode.id)) {
              // Space horizontally from right to left based on upstream depth
              const targetX = outputNode.position.x - (depth * 175);
              sourceNode.position = {
                x: targetX,
                y: yCol
              };
              placedIntermediateNodeIds.add(sourceNode.id);
            } else {
              // Centered Y track for shared nodes
              sourceNode.position.y = Math.round((sourceNode.position.y + yCol) / 2);
            }

            // Recurse upstream
            if (sourceNode.type === 'joinNode') {
              traceAndArrange(sourceNode.id, 'base', depth + 1);
              traceAndArrange(sourceNode.id, 'match', depth + 1);
            } else {
              traceAndArrange(sourceNode.id, 'input', depth + 1);
            }
          }
        });
      };

      traceAndArrange(outputNode.id, col.id, 1);
    });
  });

  // D. Standalone leftover blocks that are completely unlinked
  let leftoverIdx = 0;
  updatedNodes.forEach(node => {
    if (
      node.type !== 'sourceNode' &&
      node.type !== 'outputNode' &&
      !placedIntermediateNodeIds.has(node.id)
    ) {
      node.position = {
        x: 500,
        y: 100 + (leftoverIdx++) * 140
      };
    }
  });

  setNodes(updatedNodes);
};
