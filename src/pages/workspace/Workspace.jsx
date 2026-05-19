import { useState, useEffect, useCallback, useMemo } from 'react';
import { ReactFlow, Background, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useProject } from '../../context/ProjectContext';
import { useSqlite } from '../../hooks/useSqlite';
import SourceNode from '../../components/canvas/SourceNode';
import OutputNode from '../../components/canvas/OutputNode';
import TransformNode from '../../components/canvas/TransformNode';
import MathNode from '../../components/canvas/MathNode';
import FilterNode from '../../components/canvas/FilterNode';
import JoinNode from '../../components/canvas/JoinNode';
import WaypointNode from '../../components/canvas/WaypointNode';
import ConditionNode from '../../components/canvas/ConditionNode';
import ButtonEdge from '../../components/canvas/ButtonEdge';
import InspectorModal from '../../components/canvas/InspectorModal';
import AiScriptModal from '../../components/canvas/AiScriptModal';
import { ConfirmModal } from '../../components/ui/Modal';
import Sidebar from './Sidebar';
import DataPreview from './DataPreview';
import CanvasControls from './CanvasControls';
import WhyChooseModal from './WhyChooseModal';
import TutorialDrawer from './TutorialDrawer';
import { ChevronRight, ZoomIn, ZoomOut, Maximize, Eye, X, BookOpen, Zap, Link2, Filter, Sparkles, MapPin, MousePointer, Hand, Trash2, ListChecks, Calculator } from 'lucide-react';
import styles from './Workspace.module.css';

// Emerald Green pointer dot showing the active floating node coordinate during wire drawing
const CursorNode = () => (
  <div style={{
    width: '10px',
    height: '10px',
    background: '#10b981',
    borderRadius: '50%',
    boxShadow: '0 0 10px #10b981, 0 0 16px #10b981',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none'
  }} />
);

const nodeTypes = {
  sourceNode: SourceNode,
  outputNode: OutputNode,
  transformNode: TransformNode,
  mathNode: MathNode,
  filterNode: FilterNode,
  joinNode: JoinNode,
  waypointNode: WaypointNode,
  conditionNode: ConditionNode,
  cursorNode: CursorNode,
};

const edgeTypes = {
  buttonEdge: ButtonEdge,
};

function WorkspaceContent() {
  const { 
    nodes, edges, onNodesChange, onEdgesChange, onConnect, removeEdge, addFile,
    setNodes, setEdges, setFiles, files, inspectorNodeId, setInspectorNodeId, edgeInsertMenu, setEdgeInsertMenu,
    drawingWire, setDrawingWire, cursorPos, setCursorPos,
    startDrawingWire, addWaypointToDrawingWire, completeDrawingWire, cancelDrawingWire,
    hiddenOutputs
  } = useProject();
  const { execute } = useSqlite();
  const { zoomIn, zoomOut, screenToFlowPosition } = useReactFlow();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isWhyModalOpen, setIsWhyModalOpen] = useState(false);

  const handleOpenEditor = useCallback((fileId) => {
    window.open(`?page=editor&fileId=${fileId}`, '_blank');
  }, []);

  // Memoize nodeTypes & edgeTypes to avoid recreate warning
  const nodeTypesMemo = useMemo(() => nodeTypes, []);
  const edgeTypesMemo = useMemo(() => edgeTypes, []);

  useEffect(() => {
    const hasVisited = localStorage.getItem('melder_visited');
    if (!hasVisited) {
      setIsWhyModalOpen(true);
    }
  }, []);

  const handleCloseWhyModal = () => {
    localStorage.setItem('melder_visited', 'true');
    setIsWhyModalOpen(false);
  };

  const handleEdgeClick = useCallback((event, edge) => {
    event.stopPropagation();
    if (drawingWire) return; // Prevent deleting wires while drawing
    removeEdge(edge.id);
  }, [drawingWire, removeEdge]);

  // Compute selection stats
  const selectedNodesCount = nodes.filter(n => n.selected).length;
  const selectedEdgesCount = edges.filter(e => e.selected).length;
  const hasSelection = selectedNodesCount > 0 || selectedEdgesCount > 0;

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const handleDeleteSelected = useCallback(() => {
    if (isSelectMode) {
      setIsDeleteConfirmOpen(true);
    } else {
      setNodes(nds => nds.filter(n => !n.selected));
      setEdges(eds => eds.filter(e => !e.selected));
    }
  }, [isSelectMode, setNodes, setEdges]);

  const handleConfirmDelete = useCallback(() => {
    setNodes(nds => nds.filter(n => !n.selected));
    setEdges(eds => eds.filter(e => !e.selected));
    setIsDeleteConfirmOpen(false);
  }, [setNodes, setEdges]);

  const handleCancelDelete = useCallback(() => {
    setIsDeleteConfirmOpen(false);
  }, []);

  // Splicing insertion of block inside wire connection
  const handleInsertBlock = (nodeType) => {
    const edgeId = edgeInsertMenu.edgeId;
    if (!edgeId) return;

    const edge = edges.find(e => e.id === edgeId);
    if (!edge) return;

    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) return;

    const posX = edgeInsertMenu.flowX !== undefined ? edgeInsertMenu.flowX - 50 : (sourceNode.position.x + targetNode.position.x) / 2;
    const posY = edgeInsertMenu.flowY !== undefined ? edgeInsertMenu.flowY - 25 : (sourceNode.position.y + targetNode.position.y) / 2;

    const blockId = `${nodeType.split('Node')[0]}_${Date.now()}`;
    const newBlockNode = {
      id: blockId,
      type: nodeType,
      position: { x: posX, y: posY },
      data: nodeType === 'transformNode' 
        ? { type: 'UPPER', script: '' } 
        : nodeType === 'filterNode' 
        ? { condition: "{col} = 'value'" } 
        : nodeType === 'conditionNode'
        ? { newColumnName: 'output_col', rules: [{ operator: '=', value: 'value', thenVal: 'result' }], elseVal: 'default' }
        : nodeType === 'mathNode'
        ? { expression: '{col1} + {col2}' }
        : {}
    };

    const edge1 = {
      id: `edge_${Date.now()}_1`,
      source: edge.source,
      sourceHandle: edge.sourceHandle,
      target: blockId,
      targetHandle: nodeType === 'joinNode' ? 'base' : 'input',
      type: 'buttonEdge',
      animated: true,
      style: { stroke: '#111827', strokeWidth: 3 }
    };

    const edge2 = {
      id: `edge_${Date.now()}_2`,
      source: blockId,
      sourceHandle: 'output',
      target: edge.target,
      targetHandle: edge.targetHandle,
      type: 'buttonEdge',
      animated: true,
      style: { stroke: '#111827', strokeWidth: 3 }
    };

    setNodes(prev => [...prev, newBlockNode]);
    setEdges(prev => [...prev.filter(e => e.id !== edgeId), edge1, edge2]);
    setEdgeInsertMenu({ isOpen: false, edgeId: null, x: 0, y: 0, flowX: undefined, flowY: undefined });
  };

  // Keyboard Shortcuts for Zoom Controls (Ctrl + ArrowUp to zoom in, Ctrl + ArrowDown to zoom out) and Deletion
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Zoom hotkeys
      if (e.ctrlKey) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          zoomIn({ duration: 150 });
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          zoomOut({ duration: 150 });
        }
      }

      // Selection delete hotkeys (ensure we aren't typing inside an input)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const tag = document.activeElement.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && document.activeElement.contentEditable !== 'true') {
          handleDeleteSelected();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [zoomIn, zoomOut, handleDeleteSelected]);



  // Sync DB / State Server to communicate with the External Preview / Editor Tabs
  useEffect(() => {
    const channel = new BroadcastChannel('stitcher_sync');
    
    channel.onmessage = async (event) => {
      const { type, id, query } = event.data;
      
      if (type === 'REQUEST_STATE') {
        channel.postMessage({ type: 'STATE_UPDATE', nodes, edges, files });
      } else if (type === 'SYNC_WORKSPACE') {
        if (event.data.files) setFiles(event.data.files);
        if (event.data.nodes) setNodes(event.data.nodes);
        if (event.data.edges) setEdges(event.data.edges);
      } else if (type === 'EXECUTE_QUERY') {
        try {
          const res = await execute(query);
          let rows = Array.isArray(res) ? res : (res?.rows || []);
          channel.postMessage({ type: 'QUERY_RESULT', id, res: rows });
        } catch (err) {
          channel.postMessage({ type: 'QUERY_RESULT', id, error: err.message });
        }
      }
    };

    channel.postMessage({ type: 'STATE_UPDATE', nodes, edges, files });

    return () => {
      channel.close();
    };
  }, [nodes, edges, files, execute, setFiles, setNodes, setEdges]);

  // --- Click-to-Route event triggers on Canvas Pane ---
  const handlePaneMouseMove = useCallback((event) => {
    if (!drawingWire) return;
    const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    setCursorPos(flowPos);
  }, [drawingWire, screenToFlowPosition, setCursorPos]);

  const handlePaneClick = useCallback((event) => {
    if (!drawingWire) return;
    event.stopPropagation();
    
    // Spawn waypoint joint corner
    const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    addWaypointToDrawingWire(flowPos);
  }, [drawingWire, screenToFlowPosition, addWaypointToDrawingWire]);

  const handlePaneDoubleClick = useCallback((event) => {
    if (!drawingWire) return;
    event.stopPropagation();
    event.preventDefault();
    cancelDrawingWire();
  }, [drawingWire, cancelDrawingWire]);

  // Trace all edges and waypoint nodes that are in the upstream pipeline of hidden Output nodes
  const getHiddenGraphElements = () => {
    const hiddenEdgeIds = new Set();
    const hiddenNodeIds = new Set();
    const activeHiddenOutputIds = Object.keys(hiddenOutputs).filter(id => hiddenOutputs[id]);
    if (activeHiddenOutputIds.length === 0) return { edges: hiddenEdgeIds, nodes: hiddenNodeIds };

    const getDownstreamOutputs = (startNodeId) => {
      const outputs = new Set();
      const visited = new Set();
      const traverse = (currId) => {
        if (visited.has(currId)) return;
        visited.add(currId);
        const targetNode = nodes.find(n => n.id === currId);
        if (targetNode && targetNode.type === 'outputNode') {
          outputs.add(currId);
          return;
        }
        const outgoing = edges.filter(e => e.source === currId);
        outgoing.forEach(edge => traverse(edge.target));
      };
      traverse(startNodeId);
      return Array.from(outputs);
    };

    const traceUpstream = (currId, visitedEdges = new Set()) => {
      const incoming = edges.filter(e => e.target === currId);
      incoming.forEach(edge => {
        if (!visitedEdges.has(edge.id)) {
          visitedEdges.add(edge.id);
          
          // An edge/node is only hidden if all of its downstream sinks are toggled hidden
          const downstreamOutputs = getDownstreamOutputs(edge.target);
          const allHidden = downstreamOutputs.length > 0 && downstreamOutputs.every(outNodeId => hiddenOutputs[outNodeId]);
          
          if (allHidden) {
            hiddenEdgeIds.add(edge.id);
            const srcNode = nodes.find(n => n.id === edge.source);
            if (srcNode && srcNode.type !== 'sourceNode' && srcNode.type !== 'outputNode') {
              hiddenNodeIds.add(srcNode.id);
            }
          }
          traceUpstream(edge.source, visitedEdges);
        }
      });
    };

    activeHiddenOutputIds.forEach(outId => {
      traceUpstream(outId);
    });

    return { edges: hiddenEdgeIds, nodes: hiddenNodeIds };
  };

  const hiddenElements = getHiddenGraphElements();

  const processedNodes = nodes.map(n => {
    const isHidden = hiddenElements.nodes.has(n.id);
    const zIndex = n.type === 'waypointNode' ? 5 : 50;
    return { 
      ...n, 
      hidden: isHidden, 
      style: { ...n.style, zIndex } 
    };
  });

  const processedEdges = edges.map(e => 
    hiddenElements.edges.has(e.id) ? { ...e, hidden: true } : e
  );

  // --- Dynamic Node & Edge inject helpers to draw connection wires cleanly ---
  const activeNodes = drawingWire
    ? [...processedNodes, { id: 'cursor_temp_node', type: 'cursorNode', position: cursorPos, data: {} }]
    : processedNodes;

  const activeEdges = drawingWire
    ? [
        ...processedEdges,
        {
          id: 'drawing_temp_edge',
          source: drawingWire.lastNodeId,
          sourceHandle: drawingWire.lastHandleId,
          target: 'cursor_temp_node',
          targetHandle: 'input',
          type: 'straight',
          style: { stroke: '#9ca3af', strokeWidth: 3, strokeDasharray: '4,4' }
        }
      ]
    : processedEdges;

  return (
    <div className={styles.container}>
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        onCollapse={() => setIsSidebarCollapsed(true)} 
        onOpenTutorial={() => setIsTutorialOpen(true)}
        onOpenAiModal={() => setIsAiModalOpen(true)}
        onOpenWhyChoose={() => setIsWhyModalOpen(true)}
        onOpenEditor={handleOpenEditor}
      />
      
      {isSidebarCollapsed && (
        <button 
          className={styles.expandBtn} 
          onClick={() => setIsSidebarCollapsed(false)}
          title="Expand Sidebar"
        >
          <ChevronRight size={20} />
        </button>
      )}

      {/* Slide-over Tutorial Drawer */}
      <TutorialDrawer isOpen={isTutorialOpen} onClose={() => setIsTutorialOpen(false)} />

      <div className={styles.main}>
        <div className={styles.canvasArea}>
          <ReactFlow
            style={{ width: '100%', height: '100%' }}
            nodes={activeNodes}
            edges={activeEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeClick={handleEdgeClick}
            onPaneMouseMove={handlePaneMouseMove}
            onPaneClick={handlePaneClick}
            onPaneContextMenu={handlePaneDoubleClick}
            connectOnClick={true}
            nodeTypes={nodeTypesMemo}
            edgeTypes={edgeTypesMemo}
            fitView
            minZoom={0.01}
            maxZoom={8}
            selectionOnDrag={isSelectMode}
            panOnDrag={!isSelectMode}
            selectionMode="partial"
            deleteKeyCode={null}
            defaultEdgeOptions={{ 
              type: 'buttonEdge',
              animated: true, 
              style: { stroke: '#111827', strokeWidth: 3 } 
            }}
          >
            <Background color="#9ca3af" gap={16} />
            <CanvasControls isSelectMode={isSelectMode} setIsSelectMode={setIsSelectMode} />
          </ReactFlow>

          {/* Floating Delete Selected Badge - ONLY show in Selection Mode */}
          {isSelectMode && hasSelection && (
            <button className={styles.deleteFloatingBadge} onClick={handleDeleteSelected}>
              <Trash2 size={16} />
              Delete Selected ({selectedNodesCount + selectedEdgesCount})
            </button>
          )}

          {/* Splicing Connection Dropdown Menu */}
          {edgeInsertMenu.isOpen && (
            <>
              <div 
                className={styles.edgeInsertBackdrop} 
                onClick={() => setEdgeInsertMenu({ isOpen: false, edgeId: null, x: 0, y: 0 })} 
              />
              <div 
                className={styles.edgeInsertMenu}
                style={{ left: edgeInsertMenu.x, top: edgeInsertMenu.y }}
              >
                <div className={styles.edgeInsertHeader}>Insert Block:</div>
                 <button onClick={() => handleInsertBlock('transformNode')}>
                  <Sparkles size={12} style={{ color: '#a855f7' }} /> Transform Block
                </button>
                <button onClick={() => handleInsertBlock('mathNode')}>
                  <Calculator size={12} style={{ color: '#3b82f6' }} /> Math Block
                </button>
                <button onClick={() => handleInsertBlock('conditionNode')}>
                  <ListChecks size={12} style={{ color: '#10b981' }} /> Conditional Block
                </button>
                <button onClick={() => handleInsertBlock('filterNode')}>
                  <Filter size={12} style={{ color: '#ec4899' }} /> Filter Block
                </button>
                <button onClick={() => handleInsertBlock('joinNode')}>
                  <Link2 size={12} style={{ color: '#06b6d4' }} /> Join Block
                </button>
                <button onClick={() => handleInsertBlock('waypointNode')}>
                  <MapPin size={12} style={{ color: '#3b82f6' }} /> Route Point
                </button>
                <button className={styles.edgeInsertClose} onClick={() => setEdgeInsertMenu({ isOpen: false, edgeId: null, x: 0, y: 0 })}>Cancel</button>
              </div>
            </>
          )}
        </div>
        <DataPreview />
      </div>

      <InspectorModal 
        nodeId={inspectorNodeId}
        isOpen={!!inspectorNodeId}
        onClose={() => setInspectorNodeId(null)}
      />

      <AiScriptModal 
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
      />

      <ConfirmModal 
        isOpen={isDeleteConfirmOpen}
        title="Delete Selected Items?"
        message={`Are you sure you want to delete the ${selectedNodesCount + selectedEdgesCount} selected item(s) from the canvas? This action cannot be undone.`}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      <WhyChooseModal isOpen={isWhyModalOpen} onClose={handleCloseWhyModal} />
    </div>
  );
}

export default function Workspace() {
  return (
    <ReactFlowProvider>
      <WorkspaceContent />
    </ReactFlowProvider>
  );
}
