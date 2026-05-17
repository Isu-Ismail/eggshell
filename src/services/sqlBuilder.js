// Recursive resolver to trace handles back through transformation/join/filter blocks to raw columns
const resolveSourceColumn = (nodeId, handleId, state) => {
  const incomingEdge = state.edges.find(e => e.target === nodeId && e.targetHandle === handleId);
  if (!incomingEdge) return null;

  const sourceNode = state.nodes.find(n => n.id === incomingEdge.source);
  if (!sourceNode) return null;

  // Case A: Raw Source File Table
  if (sourceNode.type === 'sourceNode') {
    return {
      table: sourceNode.id,
      column: incomingEdge.sourceHandle,
      expression: `"${sourceNode.id}"."${incomingEdge.sourceHandle}"`
    };
  }

  // Case B: Transform Node Block
  if (sourceNode.type === 'transformNode') {
    const parentSource = resolveSourceColumn(sourceNode.id, 'input', state);
    if (!parentSource) return null;

    const type = sourceNode.data.type || 'UPPER';
    let expression = parentSource.expression;

    if (type === 'UPPER') {
      expression = `UPPER(${parentSource.expression})`;
    } else if (type === 'LOWER') {
      expression = `LOWER(${parentSource.expression})`;
    } else if (type === 'TRIM') {
      expression = `TRIM(${parentSource.expression})`;
    } else if (type === 'CUSTOM') {
      const script = sourceNode.data.script || '{col}';
      expression = script.replace(/{col}/g, parentSource.expression);
    }

    return {
      table: parentSource.table,
      column: parentSource.column,
      expression
    };
  }

  // Case CX: Condition Node Block
  if (sourceNode.type === 'conditionNode') {
    const parentSource = resolveSourceColumn(sourceNode.id, 'input', state);
    if (!parentSource) return null;

    const rules = sourceNode.data.rules || [];
    const elseVal = sourceNode.data.elseVal || '0';
    
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
      expression
    };
  }

  // Case C: Filter Node Block
  if (sourceNode.type === 'filterNode') {
    const parentSource = resolveSourceColumn(sourceNode.id, 'input', state);
    if (!parentSource) return null;

    // Register active where condition on the state
    const conditionTemplate = sourceNode.data.condition || "{col} = ''";
    const compiledCondition = conditionTemplate.replace(/{col}/g, parentSource.expression);
    state.filters.push(compiledCondition);

    // Pass through column expression unchanged
    return parentSource;
  }

  // Case D: Join Node Block
  if (sourceNode.type === 'joinNode') {
    // Resolve BOTH base and matching key wires
    const baseSource = resolveSourceColumn(sourceNode.id, 'base', state);
    const matchSource = resolveSourceColumn(sourceNode.id, 'match', state);

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
  if (sourceNode.type === 'waypointNode') {
    return resolveSourceColumn(sourceNode.id, 'input', state);
  }

  return null;
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
