// 1. Compile the ENTIRE active canvas pipeline (multiple inputs and multiple outputs) into a clean, file-agnostic Graph JSON configuration
export const exportFullPipelineConfig = (nodes, edges) => {
  const cleanIdMap = {};
  nodes.forEach(node => {
    if (node.type === 'sourceNode') {
      const rawName = node.data?.fileName || 'source';
      // Clean extension and convert to lowercase snake_case
      const cleanName = rawName
        .replace(/\.[^/.]+$/, "") // strip extension
        .replace(/[^a-zA-Z0-9_]/g, "_") // replace non-alphanumeric with underscore
        .toLowerCase();
      cleanIdMap[node.id] = cleanName;
    } else {
      cleanIdMap[node.id] = node.id;
    }
  });

  const blocks = nodes.map(node => {
    const block = {
      id: cleanIdMap[node.id],
      type: node.type
    };

    if (node.data?.customName) {
      block.customName = node.data.customName;
    }

    if (node.type === 'sourceNode') {
      block.fileName = node.data?.fileName || '';
    } else if (node.type === 'transformNode') {
      block.operation = node.data?.type || 'UPPER';
      if (block.operation === 'CUSTOM') {
        let script = node.data?.script || '';
        Object.entries(cleanIdMap).forEach(([oldId, newId]) => {
          script = script.replaceAll(oldId, newId);
        });
        block.script = script;
      }
    } else if (node.type === 'conditionNode') {
      block.newColumnName = node.data?.newColumnName || 'amount';
      block.rules = node.data?.rules || [];
      block.elseVal = node.data?.elseVal || '0';
    } else if (node.type === 'filterNode') {
      let condition = node.data?.condition || '';
      Object.entries(cleanIdMap).forEach(([oldId, newId]) => {
        condition = condition.replaceAll(oldId, newId);
      });
      block.condition = condition;
      block.passThroughIndex = node.data?.passThroughIndex || 0;
    } else if (node.type === 'outputNode') {
      block.name = node.data?.name || 'Stitched Output';
      block.columns = (node.data?.columns || []).map(col => ({ id: col.id, name: col.name }));
    }

    return block;
  });

  const connections = edges.map(edge => {
    const sourceAlias = cleanIdMap[edge.source] || edge.source;
    const targetAlias = cleanIdMap[edge.target] || edge.target;
    return {
      source: `${sourceAlias}.${edge.sourceHandle}`,
      target: `${targetAlias}.${edge.targetHandle}`
    };
  });

  return JSON.stringify({ blocks, connections }, null, 2);
};

// 2. Compile output-node specific visual context to identical schema for graph continuity
export const exportPipelineConfig = (outputNodeId, nodes, edges) => {
  return exportFullPipelineConfig(nodes, edges);
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
  // Strip non-alphanumeric characters (preserving Unicode letters and digits)
  clean = clean.replace(/[^\p{L}\p{N}]/gu, "");
  return clean;
};

// 2. Parse and apply declarative configuration JSON script to visual canvas nodes and wires
export const applyJsonConfig = (configString, nodes, setNodes, setEdges, files = []) => {
  try {
    const config = JSON.parse(configString);
    if (!config) {
      throw new Error("Invalid configuration file: Empty configuration.");
    }

    // --- CASE A: Unified Block & Connection Format (Direct Graph) ---
    if (config.blocks && Array.isArray(config.blocks)) {
      const newNodes = [];
      const idMapping = {};

      let sourceIdx = 0;
      let midIdx = 0;
      let outIdx = 0;

      config.blocks.forEach(block => {
        let nodeData = {};
        let x = 380;
        let y = 150;

        if (block.type === 'sourceNode') {
          x = 50;
          y = 100 + (sourceIdx++ * 280);
          
          const targetClean = cleanFileName(block.fileName);
          const fileData = files.find(f => cleanFileName(f.fileName).includes(targetClean) || targetClean.includes(cleanFileName(f.fileName)));
          
          nodeData = {
            fileName: fileData ? fileData.fileName : (block.fileName || 'source.xlsx'),
            headers: fileData ? fileData.headers : []
          };
          
          if (fileData) {
            idMapping[block.id] = fileData.id;
          } else {
            idMapping[block.id] = block.id;
          }
        } else if (block.type === 'transformNode') {
          x = 380;
          y = 100 + (midIdx++ * 140);
          nodeData = {
            type: block.operation || 'UPPER',
            script: block.script || '',
            customName: block.customName || ''
          };
          idMapping[block.id] = block.id;
        } else if (block.type === 'conditionNode') {
          x = 420;
          y = 100 + (midIdx++ * 140);
          nodeData = {
            newColumnName: block.newColumnName || 'amount',
            rules: block.rules || [],
            elseVal: block.elseVal || '0',
            customName: block.customName || ''
          };
          idMapping[block.id] = block.id;
        } else if (block.type === 'filterNode') {
          x = 400;
          y = 100 + (midIdx++ * 140);
          nodeData = {
            condition: block.condition || '',
            passThroughIndex: block.passThroughIndex || 0,
            customName: block.customName || ''
          };
          idMapping[block.id] = block.id;
        } else if (block.type === 'joinNode') {
          x = 350;
          y = 100 + (midIdx++ * 140);
          nodeData = {};
          idMapping[block.id] = block.id;
        } else if (block.type === 'outputNode') {
          x = 800;
          y = 150 + (outIdx++ * 320);
          nodeData = {
            name: block.name || 'Stitched Output',
            columns: block.columns || []
          };
          idMapping[block.id] = block.id;
        } else {
          x = 400;
          y = 100 + (midIdx++ * 140);
          nodeData = {};
          idMapping[block.id] = block.id;
        }

        newNodes.push({
          id: idMapping[block.id],
          type: block.type,
          position: { x, y },
          data: nodeData
        });
      });

      const newEdges = (config.connections || []).map(conn => {
        const srcDot = conn.source.indexOf('.');
        const targetDot = conn.target.indexOf('.');
        if (srcDot === -1 || targetDot === -1) return null;

        const srcAlias = conn.source.substr(0, srcDot);
        const srcHandle = conn.source.substr(srcDot + 1);
        const targetAlias = conn.target.substr(0, targetDot);
        const targetHandle = conn.target.substr(targetDot + 1);

        const realSourceId = idMapping[srcAlias] || srcAlias;
        const realTargetId = idMapping[targetAlias] || targetAlias;

        const srcNode = newNodes.find(n => n.id === realSourceId);
        let finalSourceHandle = srcHandle;
        if (srcNode && srcNode.type === 'sourceNode') {
          finalSourceHandle = getSanitizedColumn(srcNode, srcHandle);
        }

        return {
          id: `edge_${Math.random().toString(36).substr(2, 9)}`,
          source: realSourceId,
          sourceHandle: finalSourceHandle,
          target: realTargetId,
          targetHandle: targetHandle,
          type: 'buttonEdge',
          animated: true,
          style: { stroke: '#111827', strokeWidth: 3 }
        };
      }).filter(Boolean);

      setNodes(newNodes);
      setEdges(newEdges);
      return { success: true };
    }

    // --- CASE B: Legacy Nested Column Schema ---
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

    const inputs = config.inputs || {};
    const aliasToFileId = {};

    Object.entries(inputs).forEach(([alias, targetFileName]) => {
      const targetClean = cleanFileName(targetFileName);
      
      let matchingNode = newNodes.find(n => {
        if (n.type !== 'sourceNode') return false;
        const nodeClean = cleanFileName(n.data?.fileName);
        return nodeClean.includes(targetClean) || targetClean.includes(nodeClean);
      });
      
      if (!matchingNode) {
        const fileData = files.find(f => {
          const fileClean = cleanFileName(f.fileName);
          return fileClean.includes(targetClean) || targetClean.includes(fileClean);
        });
        
        if (fileData) {
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
          const resolvedSource = resolveAliasSource(col.source);
          const dotIndex = resolvedSource.indexOf('.');
          if (dotIndex === -1) return;
          
          const sourceTable = resolvedSource.substr(0, dotIndex);
          const sourceColumn = resolvedSource.substr(dotIndex + 1);

          let currentSourceId = sourceTable;
          let currentSourceHandle = sourceColumn;
          let currentX = 350 + (outputIdx * 100);

          if (col.join) {
            const resolvedBase = resolveAliasSource(col.join.base_key);
            const resolvedMatch = resolveAliasSource(col.join.match_key);
            const joinKey = `${resolvedBase}::${resolvedMatch}::${outputNodeId}`;
            
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
                  : { 
                      type: typeof trsf === 'object' ? (trsf.type || 'UPPER') : trsf, 
                      script: typeof trsf === 'object' ? (trsf.script || '') : '' 
                    }
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

      newNodes.push({
        id: outputNodeId,
        type: 'outputNode',
        position: { x: outputXOffset, y: 150 },
        data: { name: outputDef.output_name || 'Stitched Output', columns: outputColumns }
      });

      outputXOffset += 350;
    });

    setNodes(newNodes);
    setEdges(newEdges);
    return { success: true };
  } catch (err) {
    console.error("JSON Apply failed", err);
    return { success: false, error: err.message };
  }
};
