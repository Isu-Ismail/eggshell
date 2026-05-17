import { createContext, useContext, useState, useCallback } from 'react';
import { addEdge, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import { deleteConnectionPath as engineDeleteConnectionPath, duplicateOutputNode as engineDuplicateOutputNode, autoArrangeCanvas as engineAutoArrangeCanvas } from './canvasEngine';
import { exportPipelineConfig as engineExportPipelineConfig, exportFullPipelineConfig as engineExportFullPipelineConfig, applyJsonConfig as engineApplyJsonConfig } from './configCompiler';

const ProjectContext = createContext();

export const useProject = () => useContext(ProjectContext);

export const ProjectProvider = ({ children }) => {
  const [files, setFiles] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  
  // Track globally active node inside the pipeline Inspector Modal
  const [inspectorNodeId, setInspectorNodeId] = useState(null);
  
  // Edge Splicing menu popup state
  const [edgeInsertMenu, setEdgeInsertMenu] = useState({
    isOpen: false,
    edgeId: null,
    x: 0,
    y: 0,
    flowX: undefined,
    flowY: undefined
  });

  // Track output nodes whose connection wires/logic should be hidden on the canvas
  const [hiddenOutputs, setHiddenOutputs] = useState({});

  const toggleOutputVisibility = useCallback((nodeId) => {
    setHiddenOutputs(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  }, []);

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, type: 'buttonEdge' }, eds)), // Auto-connect with plus buttons!
    []
  );

  // Delegate complex recursive sever path helper to canvasEngine
  const deleteConnectionPath = useCallback((nodeId, handleId, type = 'source') => {
    engineDeleteConnectionPath(nodeId, handleId, type, nodes, edges, setNodes, setEdges);
  }, [nodes, edges]);

  // Splicing trigger for inserting block along edge path
  const onEdgeInsertClick = useCallback((edgeId, event, flowCoords) => {
    setEdgeInsertMenu({
      isOpen: true,
      edgeId,
      x: event.clientX - 80,
      y: event.clientY - 120,
      flowX: flowCoords ? flowCoords.x : undefined,
      flowY: flowCoords ? flowCoords.y : undefined
    });
  }, []);

  // --- Click-to-Route Tinkercad connection helpers ---
  const [drawingWire, setDrawingWire] = useState(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  const startDrawingWire = useCallback((nodeId, handleId) => {
    setDrawingWire({
      sourceId: nodeId,
      sourceHandle: handleId,
      lastNodeId: nodeId,
      lastHandleId: handleId,
      tempWaypoints: []
    });
  }, []);

  const addWaypointToDrawingWire = useCallback((flowPos) => {
    if (!drawingWire) return;

    const waypointId = `waypoint_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newWaypoint = {
      id: waypointId,
      type: 'waypointNode',
      position: { x: flowPos.x, y: flowPos.y },
      data: {}
    };

    const solidEdge = {
      id: `edge_${Date.now()}_solid`,
      source: drawingWire.lastNodeId,
      sourceHandle: drawingWire.lastHandleId,
      target: waypointId,
      targetHandle: 'input',
      type: 'buttonEdge',
      animated: true,
      style: { stroke: '#111827', strokeWidth: 3 }
    };

    setNodes(prev => [...prev, newWaypoint]);
    setEdges(prev => [...prev, solidEdge]);

    setDrawingWire(prev => ({
      ...prev,
      lastNodeId: waypointId,
      lastHandleId: 'output',
      tempWaypoints: [...prev.tempWaypoints, waypointId]
    }));
  }, [drawingWire]);

  const completeDrawingWire = useCallback((targetNodeId, targetHandleId) => {
    if (!drawingWire) return;

    const finalEdge = {
      id: `edge_${Date.now()}_final`,
      source: drawingWire.lastNodeId,
      sourceHandle: drawingWire.lastHandleId,
      target: targetNodeId,
      targetHandle: targetHandleId,
      type: 'buttonEdge',
      animated: true,
      style: { stroke: '#111827', strokeWidth: 3 }
    };

    setEdges(prev => [...prev, finalEdge]);
    setDrawingWire(null);
  }, [drawingWire]);

  const cancelDrawingWire = useCallback(() => {
    if (!drawingWire) return;

    const tempIds = drawingWire.tempWaypoints;
    setNodes(prev => prev.filter(n => !tempIds.includes(n.id)));
    setEdges(prev => prev.filter(e => !tempIds.includes(e.source) && !tempIds.includes(e.target)));
    setDrawingWire(null);
  }, [drawingWire]);

  const addFile = (fileData) => {
    setFiles(prev => [...prev, fileData]);
    
    const newNode = {
      id: fileData.id,
      type: 'sourceNode',
      position: { x: 50, y: 100 + (files.length * 280) },
      data: { 
        fileName: fileData.fileName,
        headers: fileData.headers 
      }
    };
    
    setNodes(prev => [...prev, newNode]);
  };

  const addOutputNode = useCallback(() => {
    const currentOutputs = nodes.filter(n => n.type === 'outputNode');
    const id = `output_${Date.now()}`;
    
    let lastX = 750;
    let lastY = 150;
    
    if (currentOutputs.length > 0) {
      const lastOutput = currentOutputs[currentOutputs.length - 1];
      lastX = lastOutput.position.x + 300;
      lastY = lastOutput.position.y;
    }

    const newNode = {
      id,
      type: 'outputNode',
      position: { x: lastX, y: lastY },
      data: { name: `Stitched Output ${currentOutputs.length + 1}`, columns: [], filter: '' }
    };
    setNodes(prev => [...prev, newNode]);
  }, [nodes]);

  const addOutputNodeFromTemplate = useCallback((fileName, headers) => {
    const currentOutputs = nodes.filter(n => n.type === 'outputNode');
    const id = `output_${Date.now()}`;
    
    let lastX = 750;
    let lastY = 150;
    
    if (currentOutputs.length > 0) {
      const lastOutput = currentOutputs[currentOutputs.length - 1];
      lastX = lastOutput.position.x + 300;
      lastY = lastOutput.position.y;
    }

    const outputColumns = headers.map(h => ({
      id: `out_col_${Math.random().toString(36).substr(2, 9)}`,
      name: h.original
    }));

    const newNode = {
      id,
      type: 'outputNode',
      position: { x: lastX, y: lastY },
      data: { 
        name: fileName.replace(/\.[^/.]+$/, "").toUpperCase(),
        columns: outputColumns,
        filter: '' 
      }
    };
    setNodes(prev => [...prev, newNode]);
  }, [nodes]);

  // Delegate complex sub-graph duplication algorithms to canvasEngine
  const duplicateOutputNode = useCallback((nodeId) => {
    engineDuplicateOutputNode(nodeId, nodes, edges, setNodes, setEdges);
  }, [nodes, edges]);

  const autoArrangeCanvas = useCallback(() => {
    engineAutoArrangeCanvas(nodes, edges, setNodes);
  }, [nodes, edges]);

  const copyColumnsFromSource = useCallback((outputNodeId, sourceFileId) => {
    setNodes(prev => prev.map(n => {
      if (n.id === outputNodeId) {
        const sourceFile = files.find(f => f.id === sourceFileId);
        if (!sourceFile) return n;

        const newColumns = sourceFile.headers.map(h => ({
          id: `out_col_${Math.random().toString(36).substr(2, 9)}`,
          name: h.original
        }));

        return {
          ...n,
          data: {
            ...n.data,
            columns: [...(n.data.columns || []), ...newColumns]
          }
        };
      }
      return n;
    }));
  }, [files]);

  const addTransformNode = useCallback(() => {
    const currentTransforms = nodes.filter(n => n.type === 'transformNode');
    const id = `transform_${Date.now()}`;
    const newNode = {
      id,
      type: 'transformNode',
      position: { x: 450, y: 120 + (currentTransforms.length * 110) },
      data: { type: 'UPPER', script: '' }
    };
    setNodes(prev => [...prev, newNode]);
  }, [nodes]);

  const addFilterNode = useCallback(() => {
    const currentFilters = nodes.filter(n => n.type === 'filterNode');
    const id = `filter_${Date.now()}`;
    const newNode = {
      id,
      type: 'filterNode',
      position: { x: 450, y: 160 + (currentFilters.length * 110) },
      data: { condition: "{col} = 'value'" }
    };
    setNodes(prev => [...prev, newNode]);
  }, [nodes]);

  const addJoinNode = useCallback(() => {
    const currentJoins = nodes.filter(n => n.type === 'joinNode');
    const id = `join_${Date.now()}`;
    const newNode = {
      id,
      type: 'joinNode',
      position: { x: 450, y: 200 + (currentJoins.length * 110) },
      data: {}
    };
    setNodes(prev => [...prev, newNode]);
  }, [nodes]);

  const addConditionNode = useCallback(() => {
    const currentConditions = nodes.filter(n => n.type === 'conditionNode');
    const id = `condition_${Date.now()}`;
    const newNode = {
      id,
      type: 'conditionNode',
      position: { x: 450, y: 180 + (currentConditions.length * 110) },
      data: { newColumnName: 'output_col', rules: [{ operator: '=', value: 'value', thenVal: 'result' }], elseVal: 'default' }
    };
    setNodes(prev => [...prev, newNode]);
  }, [nodes]);

  const updateOutputNodeName = useCallback((nodeId, newName) => {
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        return { ...n, data: { ...n.data, name: newName } };
      }
      return n;
    }));
  }, []);

  const deleteOutputNode = useCallback((nodeId) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.target !== nodeId));
  }, []);

  const addOutputColumn = useCallback((nodeId, colName) => {
    const newCol = { id: `out_${Math.random().toString(36).substr(2, 9)}`, name: colName };
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        const cols = n.data.columns || [];
        return { ...n, data: { ...n.data, columns: [...cols, newCol] } };
      }
      return n;
    }));
  }, []);

  const updateOutputColumn = useCallback((nodeId, colId, newName) => {
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        const cols = n.data.columns || [];
        const newCols = cols.map(c => c.id === colId ? { ...c, name: newName } : c);
        return { ...n, data: { ...n.data, columns: newCols } };
      }
      return n;
    }));
  }, []);

  const deleteOutputColumn = useCallback((nodeId, colId) => {
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        const cols = n.data.columns || [];
        return { ...n, data: { ...n.data, columns: cols.filter(c => c.id !== colId) } };
      }
      return n;
    }));
    // Auto-clean the entire incoming path recursively!
    deleteConnectionPath(nodeId, colId, 'target');
  }, [deleteConnectionPath]);

  const removeFile = useCallback((fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    setNodes(prev => prev.filter(n => n.id !== fileId));
    setEdges(prev => prev.filter(e => e.source !== fileId && e.target !== fileId));
  }, []);

  const removeFileFromCanvas = useCallback((fileId) => {
    setNodes(prev => prev.filter(n => n.id !== fileId));
    setEdges(prev => prev.filter(e => e.source !== fileId && e.target !== fileId));
  }, []);

  const addFileToCanvas = useCallback((fileId) => {
    setNodes(prev => {
      if (prev.some(n => n.id === fileId)) return prev;

      const fileData = files.find(f => f.id === fileId);
      if (!fileData) return prev;

      const currentSourceNodes = prev.filter(n => n.type === 'sourceNode');
      const newNode = {
        id: fileId,
        type: 'sourceNode',
        position: { x: 50, y: 100 + (currentSourceNodes.length * 280) },
        data: { 
          fileName: fileData.fileName,
          headers: fileData.headers 
        }
      };
      return [...prev, newNode];
    });
  }, [files]);

  const clearAllFiles = useCallback(() => {
    setFiles([]);
    setNodes([]);
    setEdges([]);
  }, []);

  const removeEdge = useCallback((edgeId) => {
    setEdges(prev => prev.filter(e => e.id !== edgeId));
  }, []);

  // Delegate complex script config compiler routines to configCompiler
  const exportPipelineConfig = useCallback((outputNodeId) => {
    return engineExportPipelineConfig(outputNodeId, nodes, edges);
  }, [nodes, edges]);

  const exportFullPipelineConfig = useCallback(() => {
    return engineExportFullPipelineConfig(nodes, edges);
  }, [nodes, edges]);

  const applyJsonConfig = useCallback((configString) => {
    return engineApplyJsonConfig(configString, nodes, setNodes, setEdges, files);
  }, [nodes, files]);

  const getAiSchemaJson = useCallback(() => {
    return JSON.stringify({
      uploaded_files: files.map(f => ({
        file_id: f.id,
        file_name: f.fileName,
        row_count: f.rowCount,
        columns: f.headers
      }))
    }, null, 2);
  }, [files]);

  return (
    <ProjectContext.Provider value={{
      files, nodes, edges, onNodesChange, onEdgesChange, onConnect, 
      addFile, removeFile, clearAllFiles, 
      addOutputNode, updateOutputNodeName, deleteOutputNode,
      addOutputColumn, updateOutputColumn, deleteOutputColumn, addTransformNode,
      addFilterNode, addJoinNode, addConditionNode,
      removeEdge, setNodes, setEdges,
      inspectorNodeId, setInspectorNodeId,
      edgeInsertMenu, setEdgeInsertMenu, onEdgeInsertClick,
      getAiSchemaJson, applyJsonConfig,
      removeFileFromCanvas, addFileToCanvas,
      drawingWire, setDrawingWire, cursorPos, setCursorPos,
      startDrawingWire, addWaypointToDrawingWire, completeDrawingWire, cancelDrawingWire,
      deleteConnectionPath, addOutputNodeFromTemplate, duplicateOutputNode, copyColumnsFromSource,
      hiddenOutputs, toggleOutputVisibility, exportPipelineConfig, exportFullPipelineConfig, autoArrangeCanvas
    }}>
      {children}
    </ProjectContext.Provider>
  );
};
