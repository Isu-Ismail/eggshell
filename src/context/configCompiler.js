// 1. Compile the ENTIRE active canvas pipeline (multiple inputs and multiple outputs) into a clean, file-agnostic JSON configuration
export const exportFullPipelineConfig = (nodes, edges) => {
  const sourceNodes = nodes.filter(n => n.type === 'sourceNode');
  const outputNodes = nodes.filter(n => n.type === 'outputNode');

  // Build inputs mapping (aliases -> uploaded File Names)
  const inputsMap = {};
  const fileIdToAlias = {};
  let idx = 1;
  
  sourceNodes.forEach(node => {
    const fileName = node.data?.fileName || `${node.id}.xlsx`;
    // Clean name to make alias e.g. "students" instead of "input_1"
    let alias = fileName.replace(/\.[^/.]+$/, ""); // strip extension
    alias = alias.replace(/^file\d+[-_]/i, ""); // strip standard prefix e.g. file3_
    alias = alias.toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (!alias) alias = `input_${idx++}`;
    
    // Ensure uniqueness
    let uniqueAlias = alias;
    let duplicateIdx = 1;
    while (inputsMap[uniqueAlias]) {
      uniqueAlias = `${alias}_${duplicateIdx++}`;
    }
    
    inputsMap[uniqueAlias] = fileName;
    fileIdToAlias[node.id] = uniqueAlias;
  });

  const resolveKeyPath = (srcId, srcHandle) => {
    const srcNode = nodes.find(n => n.id === srcId);
    if (!srcNode) return '';
    if (srcNode.type === 'sourceNode') {
      const alias = fileIdToAlias[srcNode.id] || srcNode.id;
      return `${alias}.${srcHandle}`;
    }
    const incoming = edges.find(e => e.target === srcId);
    if (incoming) return resolveKeyPath(incoming.source, incoming.sourceHandle);
    return '';
  };

  const outputsConfig = [];

  outputNodes.forEach(outputNode => {
    const columnsConfig = [];

    (outputNode.data.columns || []).forEach(col => {
      const colConfig = { name: col.name };
      const incomingEdge = edges.find(e => e.target === outputNode.id && e.targetHandle === col.id);

      if (incomingEdge) {
        let source = null;
        let transforms = [];
        let filter = null;
        let join = null;

        const traceBack = (nodeId, incomingHandleId) => {
          const node = nodes.find(n => n.id === nodeId);
          if (!node) return;

          if (node.type === 'sourceNode') {
            const alias = fileIdToAlias[node.id] || node.id;
            source = `${alias}.${incomingHandleId}`;
            return;
          }

          if (node.type === 'transformNode') {
            transforms.unshift(node.data.type || 'UPPER');
          }

          if (node.type === 'conditionNode') {
            transforms.unshift({
              type: 'CONDITIONAL',
              new_column: node.data.newColumnName || 'amount',
              rules: node.data.rules || [],
              else_val: node.data.elseVal || '0'
            });
          }

          if (node.type === 'filterNode') {
            filter = node.data.condition || '';
          }

          if (node.type === 'joinNode') {
            const baseEdge = edges.find(e => e.target === node.id && e.targetHandle === 'base');
            const matchEdge = edges.find(e => e.target === node.id && e.targetHandle === 'match');
            
            let baseKey = '';
            let matchKey = '';

            if (baseEdge) baseKey = resolveKeyPath(baseEdge.source, baseEdge.sourceHandle);
            if (matchEdge) matchKey = resolveKeyPath(matchEdge.source, matchEdge.sourceHandle);

            join = {
              base_key: baseKey,
              match_key: matchKey
            };
          }

          // Continue tracing upstream
          if (node.type === 'joinNode') {
            const baseEdge = edges.find(e => e.target === nodeId && e.targetHandle === 'base');
            if (baseEdge) {
              traceBack(baseEdge.source, baseEdge.sourceHandle);
            }
          } else {
            const incoming = edges.find(e => e.target === nodeId);
            if (incoming) {
              traceBack(incoming.source, incoming.sourceHandle);
            }
          }
        };

        traceBack(incomingEdge.source, incomingEdge.sourceHandle);

        if (source) colConfig.source = source;
        if (transforms.length > 0) colConfig.transforms = transforms;
        if (filter) colConfig.filter = filter;
        if (join) colConfig.join = join;
      }

      columnsConfig.push(colConfig);
    });

    outputsConfig.push({
      output_name: outputNode.data.name || 'Stitched Output',
      columns: columnsConfig
    });
  });

  return JSON.stringify({
    inputs: inputsMap,
    outputs: outputsConfig
  }, null, 2);
};

// 1. Compile the active canvas pipeline into a file-agnostic configuration JSON with input aliases
export const exportPipelineConfig = (outputNodeId, nodes, edges) => {
  const outputNode = nodes.find(n => n.id === outputNodeId);
  if (!outputNode) return null;

  // Trace upstream to find all connected source file IDs recursively
  const sourceFileIds = new Set();
  const traceUpstreamIds = (nodeId) => {
    const incoming = edges.filter(e => e.target === nodeId);
    incoming.forEach(edge => {
      const srcNode = nodes.find(n => n.id === edge.source);
      if (srcNode) {
        if (srcNode.type === 'sourceNode') {
          sourceFileIds.add(srcNode.id);
        } else {
          traceUpstreamIds(edge.source);
        }
      }
    });
  };
  traceUpstreamIds(outputNodeId);

  // Build inputs mapping (aliases -> uploaded File Names)
  const inputsMap = {};
  const fileIdToAlias = {};
  let idx = 1;
  sourceFileIds.forEach(fileId => {
    const fileNode = nodes.find(n => n.id === fileId);
    const fileName = fileNode?.data?.fileName || `${fileId}.csv`;
    const alias = `input_${idx++}`;
    inputsMap[alias] = fileName;
    fileIdToAlias[fileId] = alias;
  });

  const resolveKeyPath = (srcId, srcHandle) => {
    const srcNode = nodes.find(n => n.id === srcId);
    if (!srcNode) return '';
    if (srcNode.type === 'sourceNode') {
      const alias = fileIdToAlias[srcNode.id] || srcNode.id;
      return `${alias}.${srcHandle}`;
    }
    const incoming = edges.find(e => e.target === srcId);
    if (incoming) return resolveKeyPath(incoming.source, incoming.sourceHandle);
    return '';
  };

  const columnsConfig = [];

  (outputNode.data.columns || []).forEach(col => {
    const colConfig = { name: col.name };
    const incomingEdge = edges.find(e => e.target === outputNodeId && e.targetHandle === col.id);

    if (incomingEdge) {
      let source = null;
      let transforms = [];
      let filter = null;
      let join = null;

      const traceBack = (nodeId, incomingHandleId) => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        if (node.type === 'sourceNode') {
          const alias = fileIdToAlias[node.id] || node.id;
          source = `${alias}.${incomingHandleId}`;
          return;
        }

        if (node.type === 'transformNode') {
          transforms.unshift(node.data.type || 'UPPER');
        }

        if (node.type === 'conditionNode') {
          transforms.unshift({
            type: 'CONDITIONAL',
            new_column: node.data.newColumnName || 'amount',
            rules: node.data.rules || [],
            else_val: node.data.elseVal || '0'
          });
        }

        if (node.type === 'filterNode') {
          filter = node.data.condition || '';
        }

        if (node.type === 'joinNode') {
          const baseEdge = edges.find(e => e.target === node.id && e.targetHandle === 'base');
          const matchEdge = edges.find(e => e.target === node.id && e.targetHandle === 'match');
          
          let baseKey = '';
          let matchKey = '';

          if (baseEdge) baseKey = resolveKeyPath(baseEdge.source, baseEdge.sourceHandle);
          if (matchEdge) matchKey = resolveKeyPath(matchEdge.source, matchEdge.sourceHandle);

          join = {
            base_key: baseKey,
            match_key: matchKey
          };
        }

        // Continue tracing upstream
        if (node.type === 'joinNode') {
          const baseEdge = edges.find(e => e.target === nodeId && e.targetHandle === 'base');
          if (baseEdge) {
            traceBack(baseEdge.source, baseEdge.sourceHandle);
          }
        } else {
          const incoming = edges.find(e => e.target === nodeId);
          if (incoming) {
            traceBack(incoming.source, incoming.sourceHandle);
          }
        }
      };

      traceBack(incomingEdge.source, incomingEdge.sourceHandle);

      if (source) colConfig.source = source;
      if (transforms.length > 0) colConfig.transforms = transforms;
      if (filter) colConfig.filter = filter;
      if (join) colConfig.join = join;
    }

    columnsConfig.push(colConfig);
  });

  return JSON.stringify({
    inputs: inputsMap,
    output_name: outputNode.data.name || 'Stitched Output',
    columns: columnsConfig
  }, null, 2);
};

// Helper to match a raw human-friendly column name to its sanitized counterpart in the source node
const getSanitizedColumn = (sourceNode, columnName) => {
  if (!sourceNode || !sourceNode.data?.headers) return columnName;
  
  // Try case-insensitive and trimmed match against both original and sanitized headers
  const match = sourceNode.data.headers.find(h => 
    h.original.toLowerCase().trim() === columnName.toLowerCase().trim() ||
    h.sanitized.toLowerCase().trim() === columnName.toLowerCase().trim()
  );
  
  if (match) return match.sanitized;
  return columnName;
};

// Fuzzy filename comparison helper to strip extensions and match ignoring case/symbols
const cleanFileName = (name) => {
  if (!name) return '';
  let clean = name.toLowerCase();
  // Remove extension (e.g. .csv, .xlsx, .xls)
  clean = clean.replace(/\.[^/.]+$/, "");
  // Remove trailing dots from react flow card header truncations
  clean = clean.replace(/\.+$/, "");
  // Strip non-alphanumeric characters
  clean = clean.replace(/[^a-z0-9]/g, "");
  return clean;
};

// 2. Parse and apply declarative configuration JSON script to visual canvas nodes and wires
export const applyJsonConfig = (configString, nodes, setNodes, setEdges, files = []) => {
  try {
    const config = JSON.parse(configString);
    if (!config) {
      throw new Error("Invalid configuration file: Empty configuration.");
    }

    // Support both single output (legacy/columns format) and multiple outputs list format
    let outputsList = [];
    if (config.outputs && Array.isArray(config.outputs)) {
      outputsList = config.outputs;
    } else if (config.columns && Array.isArray(config.columns)) {
      outputsList = [{
        output_name: config.output_name || 'Stitched Output 1',
        columns: config.columns
      }];
    } else {
      throw new Error("Invalid configuration: Missing 'outputs' list or 'columns' list.");
    }

    const sourceNodes = nodes.filter(n => n.type === 'sourceNode');
    const newNodes = [...sourceNodes];

    // Resolve aliases to actual physical file IDs present on the canvas or in the master database list
    const inputs = config.inputs || {};
    const aliasToFileId = {};

    Object.entries(inputs).forEach(([alias, targetFileName]) => {
      const targetClean = cleanFileName(targetFileName);
      
      // 1. First look for sourceNode already on canvas (fuzzy match)
      let matchingNode = newNodes.find(n => {
        if (n.type !== 'sourceNode') return false;
        const nodeClean = cleanFileName(n.data?.fileName);
        return nodeClean.includes(targetClean) || targetClean.includes(nodeClean);
      });
      
      if (!matchingNode) {
        // 2. If not on canvas, look in master files database list (fuzzy match)
        const fileData = files.find(f => {
          const fileClean = cleanFileName(f.fileName);
          return fileClean.includes(targetClean) || targetClean.includes(fileClean);
        });
        
        if (fileData) {
          // Auto-spawn the sourceNode on the canvas!
          matchingNode = {
            id: fileData.id,
            type: 'sourceNode',
            position: { x: 50, y: 100 + (newNodes.length * 280) },
            data: { 
              fileName: fileData.fileName,
              headers: fileData.headers 
            }
          };
          newNodes.push(matchingNode);
        }
      }

      if (matchingNode) {
        aliasToFileId[alias] = matchingNode.id;
      } else {
        // Fallback: If file name is not found, map to alias directly to avoid crash (retains backward compatibility)
        aliasToFileId[alias] = alias;
      }
    });

    const resolveAliasSource = (sourcePath) => {
      if (!sourcePath) return '';
      const dotIdx = sourcePath.indexOf('.');
      if (dotIdx === -1) return sourcePath;

      const alias = sourcePath.substr(0, dotIdx);
      const rawColName = sourcePath.substr(dotIdx + 1);
      const physicalId = aliasToFileId[alias] || alias;

      // Lookup physical node to sanitize column name case-insensitively
      const matchingSourceNode = newNodes.find(n => n.id === physicalId);
      const colName = getSanitizedColumn(matchingSourceNode, rawColName);

      return `${physicalId}.${colName}`;
    };

    const newEdges = [];

    const spawnedJoins = {};
    let outputXOffset = 800;

    outputsList.forEach((outputDef, outputIdx) => {
      const outputNodeId = outputIdx === 0 ? 'output_1' : `output_${Date.now()}_${outputIdx}`;
      const outputColumns = [];
      let yOffset = 100;

      outputDef.columns.forEach((col) => {
        const colId = `out_${Math.random().toString(36).substr(2, 9)}`;
        outputColumns.push({ id: colId, name: col.name });

        if (col.source) {
          // Resolve alias, e.g. "input_1.name" -> "file_123_abc.name"
          const resolvedSource = resolveAliasSource(col.source);
          const dotIndex = resolvedSource.indexOf('.');
          if (dotIndex === -1) return;
          
          const sourceTable = resolvedSource.substr(0, dotIndex);
          const sourceColumn = resolvedSource.substr(dotIndex + 1);

          let currentSourceId = sourceTable;
          let currentSourceHandle = sourceColumn;
          let currentX = 350 + (outputIdx * 100); // Slight offset to prevent visual wire tangling

          // Wire join blocks automatically if declared
          if (col.join) {
            const resolvedBase = resolveAliasSource(col.join.base_key);
            const resolvedMatch = resolveAliasSource(col.join.match_key);
            const joinKey = `${resolvedBase}::${resolvedMatch}::${outputNodeId}`; // Scope join to output to prevent visual wire tangling
            
            let joinNodeId = spawnedJoins[joinKey];
            if (!joinNodeId) {
              joinNodeId = `join_${Math.random().toString(36).substr(2, 9)}`;
              spawnedJoins[joinKey] = joinNodeId;

              newNodes.push({
                id: joinNodeId,
                type: 'joinNode',
                position: { x: 380 + (outputIdx * 100), y: yOffset + 30 },
                data: {}
              });

              // Wire base key
              const baseDot = resolvedBase.indexOf('.');
              if (baseDot !== -1) {
                newEdges.push({
                  id: `edge_${Math.random().toString(36).substr(2, 9)}`,
                  source: resolvedBase.substr(0, baseDot),
                  sourceHandle: resolvedBase.substr(baseDot + 1),
                  target: joinNodeId,
                  targetHandle: 'base',
                  type: 'buttonEdge',
                  animated: true,
                  style: { stroke: '#111827', strokeWidth: 3 }
                });
              }

              // Wire match key
              const matchDot = resolvedMatch.indexOf('.');
              if (matchDot !== -1) {
                newEdges.push({
                  id: `edge_${Math.random().toString(36).substr(2, 9)}`,
                  source: resolvedMatch.substr(0, matchDot),
                  sourceHandle: resolvedMatch.substr(matchDot + 1),
                  target: joinNodeId,
                  targetHandle: 'match',
                  type: 'buttonEdge',
                  animated: true,
                  style: { stroke: '#111827', strokeWidth: 3 }
                });
              }
            }
          }

          // Wire sequential transform / conditional blocks if declared
          if (col.transforms && Array.isArray(col.transforms)) {
            col.transforms.forEach(trsf => {
              const isConditional = typeof trsf === 'object' && trsf.type === 'CONDITIONAL';
              const blockId = isConditional 
                ? `condition_${Math.random().toString(36).substr(2, 9)}`
                : `transform_${Math.random().toString(36).substr(2, 9)}`;
                
              newNodes.push({
                id: blockId,
                type: isConditional ? 'conditionNode' : 'transformNode',
                position: { x: currentX, y: yOffset },
                data: isConditional
                  ? { newColumnName: trsf.new_column, rules: trsf.rules, elseVal: trsf.else_val }
                  : { type: trsf, script: '' }
              });

              newEdges.push({
                id: `edge_${Math.random().toString(36).substr(2, 9)}`,
                source: currentSourceId,
                sourceHandle: currentSourceHandle,
                target: blockId,
                targetHandle: 'input',
                type: 'buttonEdge',
                animated: true,
                style: { stroke: '#111827', strokeWidth: 3 }
              });

              currentSourceId = blockId;
              currentSourceHandle = 'output';
              currentX += 130;
            });
          }

          // Wire filters if declared
          if (col.filter) {
            const blockId = `filter_${Math.random().toString(36).substr(2, 9)}`;
            newNodes.push({
              id: blockId,
              type: 'filterNode',
              position: { x: currentX, y: yOffset },
              data: { condition: col.filter }
            });

            newEdges.push({
              id: `edge_${Math.random().toString(36).substr(2, 9)}`,
              source: currentSourceId,
              sourceHandle: currentSourceHandle,
              target: blockId,
              targetHandle: 'input',
              type: 'buttonEdge',
              animated: true,
              style: { stroke: '#111827', strokeWidth: 3 }
            });

            currentSourceId = blockId;
            currentSourceHandle = 'output';
            currentX += 130;
          }

          // Final connection to Output node column handle
          newEdges.push({
            id: `edge_${Math.random().toString(36).substr(2, 9)}`,
            source: currentSourceId,
            sourceHandle: currentSourceHandle,
            target: outputNodeId,
            targetHandle: colId,
            type: 'buttonEdge',
            animated: true,
            style: { stroke: '#111827', strokeWidth: 3 }
          });

          yOffset += 75;
        }
      });

      // Add visual Output Card
      newNodes.push({
        id: outputNodeId,
        type: 'outputNode',
        position: { x: outputXOffset, y: 150 },
        data: { name: outputDef.output_name || 'Stitched Output', columns: outputColumns }
      });

      outputXOffset += 350; // Dynamic grid spacing to avoid overlap
    });

    // Run clean synchronous React state updates to avoid parallel thread overrides
    setNodes(newNodes);
    setEdges(newEdges);
    return { success: true };
  } catch (err) {
    console.error("JSON Apply failed", err);
    return { success: false, error: err.message };
  }
};
