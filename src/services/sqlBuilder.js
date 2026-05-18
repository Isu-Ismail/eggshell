const resolveSourceColumn = (nodeId, handleId, state) => {
  const currentNode = state.nodes.find(n => n.id === nodeId);
  if (!currentNode) return null;

  // Case B: Transform Node Block
  if (currentNode.type === 'transformNode') {
    const incomingEdges = state.edges.filter(e => e.target === currentNode.id && e.targetHandle === 'input');
    
    const resolvedInputs = incomingEdges.map(edge => {
      const parentNode = state.nodes.find(n => n.id === edge.source);
      if (!parentNode) return null;
      if (parentNode.type === 'sourceNode') {
        return {
          table: parentNode.id,
          column: edge.sourceHandle,
          expression: `"${parentNode.id}"."${edge.sourceHandle}"`,
          customName: parentNode.data?.customName || null
        };
      } else {
        const resolved = resolveSourceColumn(parentNode.id, 'input', state);
        if (resolved && parentNode.data?.customName) {
          resolved.customName = parentNode.data.customName;
        }
        return resolved;
      }
    }).filter(Boolean);

    if (resolvedInputs.length === 0) return null;
    const parentSource = resolvedInputs[0];

    const type = currentNode.data.type || 'UPPER';
    let expression = parentSource.expression;

    if (type === 'UPPER') {
      expression = `UPPER(${parentSource.expression})`;
    } else if (type === 'LOWER') {
      expression = `LOWER(${parentSource.expression})`;
    } else if (type === 'TRIM') {
      expression = `TRIM(${parentSource.expression})`;
    } else if (type === 'SERIAL_NO') {
      expression = `ROW_NUMBER() OVER()`;
    } else if (type === 'CUSTOM') {
      let script = currentNode.data.script || '{col}';
      
      // Auto-translate clean file names, full file names, or alias references to physical SQLite table IDs!
      const sourceNodes = state.nodes.filter(n => n.type === 'sourceNode');
      sourceNodes.forEach(n => {
        const fullFileName = n.data?.fileName || '';
        const cleanFileName = fullFileName.replace(/\.[^/.]+$/, "");
        
        // Escape special regex characters in filenames
        const escapeRegex = (string) => string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const escapedFull = escapeRegex(fullFileName);
        const escapedClean = escapeRegex(cleanFileName);
        
        // Build regexes to match either inside quotes or raw word boundary
        const patterns = [
          new RegExp(`"${escapedFull}"`, 'g'),
          new RegExp(`"${escapedClean}"`, 'g'),
          new RegExp(`\\b${escapedFull}\\b`, 'g'),
          new RegExp(`\\b${escapedClean}\\b`, 'g')
        ];
        
        patterns.forEach(pattern => {
          script = script.replace(pattern, `"${n.id}"`);
        });

        // Auto-sanitize custom script column references for this table
        if (n.data?.headers && Array.isArray(n.data.headers)) {
          n.data.headers.forEach(h => {
            const escOrig = escapeRegex(h.original);
            const escSan = escapeRegex(h.sanitized);
            
            const colPatterns = [
              new RegExp(`"${n.id}"\\."${escOrig}"`, 'gi'),
              new RegExp(`"${n.id}"\\.${escOrig}`, 'gi'),
              new RegExp(`"${n.id}"\\."${escSan}"`, 'gi'),
              new RegExp(`"${n.id}"\\.${escSan}`, 'gi')
            ];
            
            colPatterns.forEach(pat => {
              script = script.replace(pat, `"${n.id}"."${h.sanitized}"`);
            });
          });
        }
      });
      
      expression = script;
      resolvedInputs.forEach((inp, idx) => {
        const key = `{col${idx + 1}}`;
        expression = expression.replaceAll(key, inp.expression);
        if (inp.customName) {
          expression = expression.replaceAll(`{${inp.customName}}`, inp.expression);
        }
      });
      expression = expression.replaceAll('{col}', parentSource.expression);
    }

    return {
      table: parentSource.table,
      column: parentSource.column,
      expression,
      customName: currentNode.data?.customName || null
    };
  }

  // Case C: Filter Node Block
  if (currentNode.type === 'filterNode') {
    const incomingEdges = state.edges.filter(e => e.target === currentNode.id && e.targetHandle === 'input');
    
    const resolvedInputs = incomingEdges.map(edge => {
      const parentNode = state.nodes.find(n => n.id === edge.source);
      if (!parentNode) return null;
      if (parentNode.type === 'sourceNode') {
        return {
          table: parentNode.id,
          column: edge.sourceHandle,
          expression: `"${parentNode.id}"."${edge.sourceHandle}"`,
          customName: parentNode.data?.customName || null
        };
      } else {
        const resolved = resolveSourceColumn(parentNode.id, 'input', state);
        if (resolved && parentNode.data?.customName) {
          resolved.customName = parentNode.data.customName;
        }
        return resolved;
      }
    }).filter(Boolean);

    if (resolvedInputs.length === 0) return null;
    const passThroughIndex = parseInt(currentNode.data?.passThroughIndex || 0, 10);
    const parentSource = resolvedInputs[passThroughIndex] || resolvedInputs[0];

    // Register active where condition on the state
    const conditionTemplate = currentNode.data.condition || "{col} = ''";
    
    let compiledCondition = conditionTemplate;
    resolvedInputs.forEach((inp, idx) => {
      const key = `{col${idx + 1}}`;
      compiledCondition = compiledCondition.replaceAll(key, inp.expression);
      if (inp.customName) {
        compiledCondition = compiledCondition.replaceAll(`{${inp.customName}}`, inp.expression);
      }
    });
    compiledCondition = compiledCondition.replaceAll('{col}', parentSource.expression);
    
    state.filters.push(compiledCondition);

    // Pass through column expression unchanged
    return parentSource;
  }

  // Case CX: Condition Node Block
  if (currentNode.type === 'conditionNode') {
    const incomingEdge = state.edges.find(e => e.target === currentNode.id && e.targetHandle === 'input');
    if (!incomingEdge) return null;

    const parentNode = state.nodes.find(n => n.id === incomingEdge.source);
    if (!parentNode) return null;

    let parentSource = null;
    if (parentNode.type === 'sourceNode') {
      parentSource = {
        table: parentNode.id,
        column: incomingEdge.sourceHandle,
        expression: `"${parentNode.id}"."${incomingEdge.sourceHandle}"`,
        customName: parentNode.data?.customName || null
      };
    } else {
      parentSource = resolveSourceColumn(parentNode.id, 'input', state);
      if (parentSource && parentNode.data?.customName) {
        parentSource.customName = parentNode.data.customName;
      }
    }
    if (!parentSource) return null;

    const rules = currentNode.data.rules || [];
    const elseVal = currentNode.data.elseVal || '0';
    
    let caseWhenParts = [];
    rules.forEach(rule => {
      const op = rule.operator || '=';
      const valStr = rule.value || '';
      
      const formatSqlValue = (v) => {
        if (v === undefined || v === null || v.trim() === '') return "''";
        if (!isNaN(v) && v.trim() !== '') return v;
        return `'${v.replace(/'/g, "''")}'`;
      };

      const formattedVal = formatSqlValue(valStr);
      const formattedThen = formatSqlValue(rule.thenVal);

      let condExpr = '';
      if (op === 'CONTAINS') {
        condExpr = `${parentSource.expression} LIKE '%${valStr.replace(/'/g, "''")}%'`;
      } else {
        const isNumericOp = ['>', '<', '>=', '<='].includes(op);
        const colRef = isNumericOp ? `CAST(${parentSource.expression} AS NUMERIC)` : parentSource.expression;
        condExpr = `${colRef} ${op} ${formattedVal}`;
      }
      
      caseWhenParts.push(`WHEN ${condExpr} THEN ${formattedThen}`);
    });

    const formattedElse = isNaN(elseVal) && elseVal.trim() !== '' ? `'${elseVal.replace(/'/g, "''")}'` : elseVal;
    const expression = `CASE ${caseWhenParts.join(' ')} ELSE ${formattedElse} END`;

    return {
      table: parentSource.table,
      column: parentSource.column,
      expression,
      customName: currentNode.data?.customName || null
    };
  }

  // Case D: Join Node Block
  if (currentNode.type === 'joinNode') {
    // Resolve base parent directly
    const baseEdge = state.edges.find(e => e.target === currentNode.id && e.targetHandle === 'base');
    let baseSource = null;
    if (baseEdge) {
      const baseParent = state.nodes.find(n => n.id === baseEdge.source);
      if (baseParent) {
        if (baseParent.type === 'sourceNode') {
          baseSource = {
            table: baseParent.id,
            column: baseEdge.sourceHandle,
            expression: `"${baseParent.id}"."${baseEdge.sourceHandle}"`
          };
        } else {
          baseSource = resolveSourceColumn(baseParent.id, 'input', state);
        }
      }
    }

    // Resolve match parent directly
    const matchEdge = state.edges.find(e => e.target === currentNode.id && e.targetHandle === 'match');
    let matchSource = null;
    if (matchEdge) {
      const matchParent = state.nodes.find(n => n.id === matchEdge.source);
      if (matchParent) {
        if (matchParent.type === 'sourceNode') {
          matchSource = {
            table: matchParent.id,
            column: matchEdge.sourceHandle,
            expression: `"${matchParent.id}"."${matchEdge.sourceHandle}"`
          };
        } else {
          matchSource = resolveSourceColumn(matchParent.id, 'input', state);
        }
      }
    }

    if (baseSource && matchSource) {
      // Register custom Join relation
      state.joins.push({
        baseExpr: baseSource.expression,
        matchExpr: matchSource.expression,
        joinTable: matchSource.table
      });

      // Flow the base key values out
      return baseSource;
    }
    return baseSource || matchSource || null;
  }

  // Case E: Waypoint / Route Node Block
  if (currentNode.type === 'waypointNode') {
    const incomingEdge = state.edges.find(e => e.target === currentNode.id && e.targetHandle === 'input');
    if (!incomingEdge) return null;
    const parentNode = state.nodes.find(n => n.id === incomingEdge.source);
    if (!parentNode) return null;
    if (parentNode.type === 'sourceNode') {
      return {
        table: parentNode.id,
        column: incomingEdge.sourceHandle,
        expression: `"${parentNode.id}"."${incomingEdge.sourceHandle}"`,
        customName: parentNode.data?.customName || null
      };
    } else {
      const resolved = resolveSourceColumn(parentNode.id, 'input', state);
      if (resolved && parentNode.data?.customName) {
        resolved.customName = parentNode.data.customName;
      }
      return resolved;
    }
  }

  // Default: We are resolving a raw output column, trace upstream!
  const incomingEdge = state.edges.find(e => e.target === nodeId && e.targetHandle === handleId);
  if (!incomingEdge) return null;

  const sourceNode = state.nodes.find(n => n.id === incomingEdge.source);
  if (!sourceNode) return null;

  if (sourceNode.type === 'sourceNode') {
    return {
      table: sourceNode.id,
      column: incomingEdge.sourceHandle,
      expression: `"${sourceNode.id}"."${incomingEdge.sourceHandle}"`,
      customName: sourceNode.data?.customName || null
    };
  } else {
    const resolved = resolveSourceColumn(sourceNode.id, 'input', state);
    if (resolved && sourceNode.data?.customName) {
      resolved.customName = sourceNode.data.customName;
    }
    return resolved;
  }
};

export const buildMappingQuery = (nodes, edges, outputNodeId) => {
  if (!outputNodeId) return null;
  
  const outputNode = nodes.find(n => n.id === outputNodeId);
  if (!outputNode) return null;

  // Retrieve all output columns of this node
  const columns = outputNode.data.columns || [];
  if (columns.length === 0) return null;

  const selectParts = [];
  const sourceTableIds = new Set();
  
  // Set compile state to accumulate joins/filters across recursive traces
  const state = {
    nodes,
    edges,
    joins: [],
    filters: []
  };

  columns.forEach(col => {
    const resolved = resolveSourceColumn(outputNodeId, col.id, state);
    if (resolved) {
      selectParts.push(`${resolved.expression} AS "${col.name.replace(/"/g, '""')}"`);
      sourceTableIds.add(resolved.table);
    }
  });

  const tables = Array.from(sourceTableIds);
  if (tables.length === 0 || selectParts.length === 0) return null;

  const baseTable = tables[0];
  let joinParts = [];
  
  // Track tables joined explicitly via Join Nodes to skip row-by-row fallback
  const explicitJoinedTables = new Set();

  // Process explicitly wired Join Block rules
  state.joins.forEach(join => {
    if (!explicitJoinedTables.has(join.joinTable) && join.joinTable !== baseTable) {
      joinParts.push(`LEFT JOIN "${join.joinTable}" ON LOWER(TRIM(${join.baseExpr})) = LOWER(TRIM(${join.matchExpr}))`);
      explicitJoinedTables.add(join.joinTable);
    }
  });

  // Fallback: Apply default Row-by-Row index joins for any other tables not explicitly joined
  for (let i = 1; i < tables.length; i++) {
    const targetTable = tables[i];
    if (!explicitJoinedTables.has(targetTable)) {
      joinParts.push(`LEFT JOIN "${targetTable}" ON "${baseTable}".__row_id = "${targetTable}".__row_id`);
    }
  }

  let query = `SELECT ${selectParts.join(', ')} FROM "${baseTable}" ${joinParts.join(' ')}`;

  // Assemble WHERE filter clauses
  if (state.filters.length > 0) {
    query += ` WHERE ${state.filters.join(' AND ')}`;
  }
  
  return query;
};
