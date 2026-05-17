import { useState, useEffect, useCallback } from 'react';
import { ReactFlow, Background, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useProject } from '../../context/ProjectContext';
import { useSqlite } from '../../hooks/useSqlite';
import SourceNode from '../../components/canvas/SourceNode';
import OutputNode from '../../components/canvas/OutputNode';
import TransformNode from '../../components/canvas/TransformNode';
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
import { ChevronRight, ZoomIn, ZoomOut, Maximize, Eye, X, BookOpen, Zap, Link2, Filter, Sparkles, MapPin, MousePointer, Hand, Trash2, ListChecks } from 'lucide-react';
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
    setNodes, setEdges, inspectorNodeId, setInspectorNodeId, edgeInsertMenu, setEdgeInsertMenu,
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

  // Pre-load mismatch names and mobile numbers test data on start
  useEffect(() => {
    if (!execute) return;

    const setupTestData = async () => {
      try {
        const check = await execute(`SELECT name FROM sqlite_master WHERE type='table' AND name='file_names'`);
        if (check && check.length > 0) return;

        await execute(`
          CREATE TABLE IF NOT EXISTS file_names (
            __row_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            year TEXT,
            department TEXT
          );
        `);
        await execute(`INSERT INTO file_names (name, year, department) VALUES ('Alice', '1st Year', 'CS');`);
        await execute(`INSERT INTO file_names (name, year, department) VALUES ('Bob', '2nd Year', 'EC');`);
        await execute(`INSERT INTO file_names (name, year, department) VALUES ('Charlie', '1st Year', 'ME');`);
        await execute(`INSERT INTO file_names (name, year, department) VALUES ('David', '3rd Year', 'CS');`);
        await execute(`INSERT INTO file_names (name, year, department) VALUES ('Eve', '4th Year', 'CS');`);

        await execute(`
          CREATE TABLE IF NOT EXISTS file_mobiles (
            __row_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            mobile_number TEXT
          );
        `);
        await execute(`INSERT INTO file_mobiles (name, mobile_number) VALUES ('Charlie', '+1-555-0003');`);
        await execute(`INSERT INTO file_mobiles (name, mobile_number) VALUES ('Eve', '+1-555-0005');`);
        await execute(`INSERT INTO file_mobiles (name, mobile_number) VALUES ('Alice', '+1-555-0001');`);
        await execute(`INSERT INTO file_mobiles (name, mobile_number) VALUES ('Frank', '+1-555-0009');`);
        await execute(`INSERT INTO file_mobiles (name, mobile_number) VALUES ('Bob', '+1-555-0002');`);

        addFile({
          id: 'file_names',
          fileName: 'test_names.xlsx',
          headers: ['name', 'year', 'department'],
          rowCount: 5
        });
        
        addFile({
          id: 'file_mobiles',
          fileName: 'test_mobiles.xlsx',
          headers: ['name', 'mobile_number'],
          rowCount: 5
        });
      } catch (err) {
        console.error("Test data seeding failed", err);
      }
    };

    setupTestData();
  }, [execute]);

  // Sync DB / State Server to communicate with the External Preview Tab
  useEffect(() => {
    const channel = new BroadcastChannel('stitcher_sync');
    
    channel.onmessage = async (event) => {
      const { type, id, query } = event.data;
      
      if (type === 'REQUEST_STATE') {
        channel.postMessage({ type: 'STATE_UPDATE', nodes, edges });
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

    channel.postMessage({ type: 'STATE_UPDATE', nodes, edges });

    return () => {
      channel.close();
    };
  }, [nodes, edges, execute]);

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
      <div className={`${styles.drawer} ${isTutorialOpen ? styles.drawerOpen : ''}`}>
        <div className={styles.drawerHeader}>
          <div className={styles.drawerTitleWrapper}>
            <BookOpen size={16} />
            <h3>How-To & Guides</h3>
          </div>
          <button className={styles.drawerCloseBtn} onClick={() => setIsTutorialOpen(false)} title="Close Guides">
            <X size={18} />
          </button>
        </div>
        <div className={styles.drawerBody}>
          <section className={styles.drawerSection}>
            <div className={styles.sectionHeader}>
              <Sparkles size={14} style={{ color: '#a855f7' }} />
              <h4>1. Text Standardizing (Transform Block)</h4>
            </div>
            <p>Standardize capitalization or format text cells to prevent spelling misalignments:</p>
            <p>• <strong>UPPERCASE / lowercase</strong>: Instantly forces all text to UPPERCASE (e.g. <code>ALICE</code>) or lowercase (e.g. <code>alice</code>).</p>
            <p>• <strong>TRIM</strong>: Removes leading and trailing blank spaces automatically (e.g. <code>" Alice "</code> to <code>"Alice"</code>).</p>
            <p>• <strong>Custom Scripts</strong>: Run native SQLite functions on text! Write expressions like <code>{`{col} || ' (active)'`}</code> to append labels dynamically.</p>
          </section>

          <section className={styles.drawerSection}>
            <div className={styles.sectionHeader}>
              <Filter size={14} style={{ color: '#ec4899' }} />
              <h4>2. Database Rows Filter (Filter Block)</h4>
            </div>
            <p>Selectively keep or drop database records matching your custom criteria:</p>
            <p>• <strong>Write Conditions</strong>: Input any SQLite <code>WHERE</code> clause. Reference the active column using <code>{`{col}`}</code>.</p>
            <p>• <strong>Examples</strong>: <code>{`{col} = 'value'`}</code> or <code>{`{col} > 100`}</code> or <code>{`{col} LIKE '%paid%'`}</code>.</p>
            <p>• <strong>Effect</strong>: Rows that evaluate to false/null will be filtered out, keeping your final stitched dataset absolutely clean.</p>
          </section>

          <section className={styles.drawerSection}>
            <div className={styles.sectionHeader}>
              <Link2 size={14} style={{ color: '#06b6d4' }} />
              <h4>3. Mismatch Resolution (Join Block)</h4>
            </div>
            <p>Map two sheets on a shared key (e.g. Student ID) to combine their columns:</p>
            <p>• <strong>Yellow (Base) Handle</strong>: Connect the primary key from your primary sheet.</p>
            <p>• <strong>Purple (Match) Handle</strong>: Connect the corresponding key from your secondary sheet.</p>
            <p>• <strong>Action</strong>: The engine performs a fast <code>LEFT JOIN</code>. Surrounding spaces are trimmed and strings are compared case-insensitively, so mapping never fails due to minor spelling variances.</p>
          </section>

          <section className={styles.drawerSection}>
            <div className={styles.sectionHeader}>
              <ListChecks size={14} style={{ color: '#10b981' }} />
              <h4>4. Advanced If-Else Mapping (Conditional Block)</h4>
            </div>
            <p>Evaluate multiple comparison rules to calculate and write dynamic column values:</p>
            <p>• <strong>New Column Header</strong>: Specify the name of the column to append (e.g. <code>amount</code> or <code>weight_class</code>).</p>
            <p>• <strong>Rule Builder</strong>: Click the Eye button to open the inspector. Add multi-level <code>IF-ELSE</code> rules stack with math or string operators (e.g. <code>IF {`{col}`} 60 THEN 'overweight'</code>).</p>
            <p>• <strong>Downstream Sync</strong>: As you type your new column name, the **connected output card column header renames itself in real-time**!</p>
          </section>

          <section className={styles.drawerSection}>
            <div className={styles.sectionHeader}>
              <Zap size={14} style={{ color: '#eab308' }} />
              <h4>Click-to-Route Wires 🔌</h4>
            </div>
            <p>1. <strong>Single-click</strong> a handle to start drawing a line. You don't need to hold the mouse down!</p>
            <p>2. Move your cursor. A dashed grey wire will follow your mouse dynamically.</p>
            <p>3. <strong>Single-click anywhere on the canvas</strong> to drop a <strong>Corner Joint (Route Point)</strong>! The line will bend exactly around this point.</p>
            <p>4. <strong>Single-click a target handle</strong> to finish the wire cleanly!</p>
            <p>5. <strong>Double-click</strong> anywhere to cancel drawing.</p>
          </section>
        </div>
      </div>

      <div className={styles.main}>
        <div className={styles.canvasArea}>
          <ReactFlow
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
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            minZoom={0.01}
            maxZoom={8}
            selectionOnDrag={isSelectMode}
            panOnDrag={!isSelectMode}
            selectionMode="partial"
            deleteKeys={[]}
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
