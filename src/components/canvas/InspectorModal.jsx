import { useState, useEffect, useRef } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Trash2, Info, Sliders, Settings, Sparkles, Filter, Link2, ListChecks, Calculator } from 'lucide-react';
import styles from './InspectorModal.module.css';

import TransformInspector from './blocks/TransformInspector';
import MathInspector from './blocks/MathInspector';
import FilterInspector from './blocks/FilterInspector';
import JoinInspector from './blocks/JoinInspector';
import ConditionInspector from './blocks/ConditionInspector';

// Recursive helper to trace the upstream raw source file column feeding into a node
const getUpstreamSourceInfo = (currNodeId, currentEdges, currentNodes) => {
  const incomingEdge = currentEdges.find(e => e.target === currNodeId);
  if (!incomingEdge) return null;

  const sourceNode = currentNodes.find(n => n.id === incomingEdge.source);
  if (!sourceNode) return null;

  if (sourceNode.type === 'sourceNode') {
    return {
      fileName: sourceNode.data.fileName,
      columnName: incomingEdge.sourceHandle
    };
  }

  if (sourceNode.type === 'waypointNode') {
    return getUpstreamSourceInfo(sourceNode.id, currentEdges, currentNodes);
  }

  const dstInfo = getDownstreamOutputInfo(sourceNode.id, currentEdges, currentNodes);
  const friendlyName = dstInfo.length > 0 ? dstInfo[0].columnName : sourceNode.id;

  let typeLabel = 'Block';
  if (sourceNode.type === 'transformNode') typeLabel = 'Transform';
  if (sourceNode.type === 'mathNode') typeLabel = 'Math';
  if (sourceNode.type === 'conditionNode') typeLabel = 'Condition';
  if (sourceNode.type === 'filterNode') typeLabel = 'Filter';
  if (sourceNode.type === 'joinNode') typeLabel = 'Join';

  return {
    fileName: `${typeLabel} (${sourceNode.id})`,
    columnName: friendlyName
  };
};

// Recursive helper to trace ALL upstream raw source file columns feeding into a node (supporting multiple inputs)
const getUpstreamSourcesInfo = (currNodeId, currentEdges, currentNodes) => {
  const incomingEdges = currentEdges.filter(e => 
    e.target === currNodeId && e.targetHandle === 'input'
  );
  
  const traceUpstream = (edge, idx) => {
    const sourceNode = currentNodes.find(n => n.id === edge.source);
    if (!sourceNode) return null;

    if (sourceNode.type === 'sourceNode') {
      return {
        fileName: sourceNode.data.fileName,
        columnName: edge.sourceHandle,
        targetHandle: `col${idx + 1}`
      };
    }

    if (sourceNode.type === 'waypointNode') {
      const upstreamEdge = currentEdges.find(e => e.target === sourceNode.id && e.targetHandle === 'input');
      if (upstreamEdge) {
        const res = traceUpstream(upstreamEdge, idx);
        if (res) {
          res.targetHandle = `col${idx + 1}`;
        }
        return res;
      }
    }

    const dstInfo = getDownstreamOutputInfo(sourceNode.id, currentEdges, currentNodes);
    const friendlyName = dstInfo.length > 0 ? dstInfo[0].columnName : sourceNode.id;

    let typeLabel = 'Block';
    if (sourceNode.type === 'transformNode') typeLabel = 'Transform';
    if (sourceNode.type === 'mathNode') typeLabel = 'Math';
    if (sourceNode.type === 'conditionNode') typeLabel = 'Condition';
    if (sourceNode.type === 'filterNode') typeLabel = 'Filter';
    if (sourceNode.type === 'joinNode') typeLabel = 'Join';

    return {
      fileName: `${typeLabel} (${sourceNode.id})`,
      columnName: friendlyName,
      targetHandle: `col${idx + 1}`
    };
  };

  return incomingEdges.map((edge, idx) => traceUpstream(edge, idx)).filter(Boolean);
};

// Recursive helper to trace the downstream destination output columns targeted by a node
const getDownstreamOutputInfo = (currNodeId, currentEdges, currentNodes) => {
  const outgoingEdges = currentEdges.filter(e => e.source === currNodeId);
  const outputs = [];

  const trace = (nodeId, incomingHandleId) => {
    const targetNode = currentNodes.find(n => n.id === nodeId);
    if (!targetNode) return null;

    if (targetNode.type === 'outputNode') {
      const targetCol = (targetNode.data.columns || []).find(c => c.id === incomingHandleId);
      return {
        name: targetNode.data.name,
        columnName: targetCol ? targetCol.name : incomingHandleId
      };
    }

    const nextEdges = currentEdges.filter(e => e.source === nodeId);
    for (const e of nextEdges) {
      const res = trace(e.target, e.targetHandle);
      if (res) return res;
    }
    return null;
  };

  outgoingEdges.forEach(edge => {
    const res = trace(edge.target, edge.targetHandle);
    if (res) {
      outputs.push(res);
    }
  });

  return outputs;
};

export default function InspectorModal({ nodeId, isOpen, onClose }) {
  const { nodes, edges, setNodes, setEdges } = useProject();
  
  const [node, setNode] = useState(null);
  const [localType, setLocalType] = useState('UPPER');
  const [localScript, setLocalScript] = useState('');
  const [localCondition, setLocalCondition] = useState('');
  const [localExpression, setLocalExpression] = useState('{col1} + {col2}');

  // Condition node dynamic states
  const [localNewColumnName, setLocalNewColumnName] = useState('amount');
  const [localRules, setLocalRules] = useState([]);
  const [localElseVal, setLocalElseVal] = useState('0');
  
  // Custom filter pass-through index
  const [localPassThroughIndex, setLocalPassThroughIndex] = useState(0);

  // Custom variable alias
  const [localCustomName, setLocalCustomName] = useState('');

  // Round decimals config for Math block
  const [localRoundDecimals, setLocalRoundDecimals] = useState('');

  const originalDataRef = useRef({});

  // Synchronize local edit buffer state only when the active node changes
  useEffect(() => {
    const activeNode = nodes.find(n => n.id === nodeId);
    if (activeNode) {
      setNode(activeNode);
      
      originalDataRef.current = {
        type: activeNode.data.type ?? 'UPPER',
        script: activeNode.data.script ?? '',
        condition: activeNode.data.condition ?? '',
        expression: activeNode.data.expression ?? '{col1} + {col2}',
        newColumnName: activeNode.data.newColumnName ?? 'output_col',
        elseVal: activeNode.data.elseVal ?? '0',
        customName: activeNode.data.customName ?? '',
        roundDecimals: activeNode.data.roundDecimals ?? ''
      };

      setLocalType(activeNode.data.type ?? 'UPPER');
      setLocalScript(activeNode.data.script ?? '');
      setLocalCondition(activeNode.data.condition ?? '');
      setLocalExpression(activeNode.data.expression ?? '{col1} + {col2}');
      setLocalNewColumnName(activeNode.data.newColumnName ?? 'output_col');
      setLocalRules(activeNode.data.rules ?? [{ operator: '=', value: 'value', thenVal: 'result' }]);
      setLocalElseVal(activeNode.data.elseVal ?? '0');
      setLocalPassThroughIndex(activeNode.data.passThroughIndex ?? 0);
      setLocalCustomName(activeNode.data.customName ?? '');
      setLocalRoundDecimals(activeNode.data.roundDecimals ?? '');
    }
  }, [nodeId]);

  const handleFinishEditing = (field, currentValue, defaultValue) => {
    if (!currentValue || currentValue.trim() === '') {
      const fallback = originalDataRef.current[field] || defaultValue;
      if (field === 'expression') {
        setLocalExpression(fallback);
        setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, expression: fallback } } : n));
      } else if (field === 'script') {
        setLocalScript(fallback);
        setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, script: fallback } } : n));
      } else if (field === 'condition') {
        setLocalCondition(fallback);
        setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, condition: fallback } } : n));
      } else if (field === 'newColumnName') {
        setLocalNewColumnName(fallback);
        setNodes(nds => nds.map(n => {
          if (n.id === nodeId) {
            return { ...n, data: { ...n.data, newColumnName: fallback } };
          }
          if (n.type === 'outputNode') {
            const outgoingEdges = edges.filter(ed => ed.source === nodeId);
            const connectedColIds = outgoingEdges
              .filter(ed => ed.target === n.id)
              .map(ed => ed.targetHandle);
              
            if (connectedColIds.length > 0) {
              const updatedCols = (n.data.columns || []).map(col => {
                if (connectedColIds.includes(col.id)) {
                  return { ...col, name: fallback };
                }
                return col;
              });
              return { ...n, data: { ...n.data, columns: updatedCols } };
            }
          }
          return n;
        }));
      } else if (field === 'customName') {
        setLocalCustomName(fallback);
        setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, customName: fallback } } : n));
      } else if (field === 'elseVal') {
        setLocalElseVal(fallback);
        setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, elseVal: fallback } } : n));
      }
    } else {
      originalDataRef.current[field] = currentValue;
    }
  };

  if (!isOpen || !node) return null;

  const handleTypeChange = (e) => {
    const val = e.target.value;
    setLocalType(val);
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, type: val } } : n));
  };

  const handleScriptChange = (e) => {
    const val = e.target.value;
    setLocalScript(val);
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, script: val } } : n));
  };

  const handleExpressionChange = (e) => {
    const val = e.target.value;
    setLocalExpression(val);
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, expression: val } } : n));
  };

  const handleRoundDecimalsChange = (e) => {
    const val = e.target.value;
    setLocalRoundDecimals(val);
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, roundDecimals: val } } : n));
  };

  const handleConditionChange = (e) => {
    const val = e.target.value;
    setLocalCondition(val);
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, condition: val } } : n));
  };

  const handlePassThroughIndexChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setLocalPassThroughIndex(val);
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, passThroughIndex: val } } : n));
  };

  const handleCustomNameChange = (e) => {
    const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
    setLocalCustomName(val);
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, customName: val } } : n));
  };

  const handleNewColumnNameChange = (e) => {
    const val = e.target.value.toLowerCase().replace(/[^\p{L}\p{N}_]/gu, '');
    setLocalNewColumnName(val);
    
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        return { ...n, data: { ...n.data, newColumnName: val } };
      }
      if (n.type === 'outputNode') {
        const outgoingEdges = edges.filter(ed => ed.source === nodeId);
        const connectedColIds = outgoingEdges
          .filter(ed => ed.target === n.id)
          .map(ed => ed.targetHandle);
          
        if (connectedColIds.length > 0) {
          const updatedCols = (n.data.columns || []).map(col => {
            if (connectedColIds.includes(col.id)) {
              return { ...col, name: val };
            }
            return col;
          });
          return { ...n, data: { ...n.data, columns: updatedCols } };
        }
      }
      return n;
    }));
  };

  const handleRuleChange = (idx, field, val) => {
    const updated = localRules.map((rule, i) => {
      if (i === idx) {
        return { ...rule, [field]: val };
      }
      return rule;
    });
    setLocalRules(updated);
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, rules: updated } } : n));
  };

  const addRule = () => {
    const updated = [...localRules, { operator: '=', value: '', thenVal: '' }];
    setLocalRules(updated);
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, rules: updated } } : n));
  };

  const removeRule = (idx) => {
    const updated = localRules.filter((_, i) => i !== idx);
    setLocalRules(updated);
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, rules: updated } } : n));
  };

  const handleElseValChange = (e) => {
    const val = e.target.value;
    setLocalElseVal(val);
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, elseVal: val } } : n));
  };

  const handleReset = () => {
    if (node.type === 'transformNode') {
      setLocalType('UPPER');
      setLocalScript('');
      setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { type: 'UPPER', script: '' } } : n));
    } else if (node.type === 'mathNode') {
      setLocalExpression('{col1} + {col2}');
      setLocalRoundDecimals('');
      setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { expression: '{col1} + {col2}', roundDecimals: '' } } : n));
    } else if (node.type === 'filterNode') {
      setLocalCondition("{col} = 'value'");
      setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { condition: "{col} = 'value'" } } : n));
    } else if (node.type === 'conditionNode') {
      setLocalNewColumnName('output_col');
      setLocalRules([{ operator: '=', value: 'value', thenVal: 'result' }]);
      setLocalElseVal('default');
      setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { newColumnName: 'output_col', rules: [{ operator: '=', value: 'value', thenVal: 'result' }], elseVal: 'default' } } : n));
    }
  };

  const handleDelete = () => {
    setNodes(nds => nds.filter(n => n.id !== nodeId));
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    onClose();
  };

  const getInspectionDetails = () => {
    if (node.type === 'transformNode') {
      const type = localType || 'UPPER';
      if (type === 'UPPER') return "Converts all text characters of this mapped column into UPPERCASE (e.g. 'alice' to 'ALICE').";
      if (type === 'LOWER') return "Converts all text characters of this mapped column into lowercase (e.g. 'Alice' to 'alice').";
      if (type === 'TRIM') return "Trims leading and trailing spaces from text (e.g. ' Alice ' to 'Alice') to avoid alignment mismatches.";
      if (type === 'CUSTOM') return "Applies a custom SQLite expression script to this column. Uses {col} to represent input values.";
    }
    if (node.type === 'mathNode') {
      return `Performs mathematical arithmetic on columns. Use {col1}, {col2}, {col3}, {col4}, {col5} matching their active left connections. Non-numeric rows are safely skipped.`;
    }
    if (node.type === 'filterNode') {
      return `Filters entire database rows of your stitched dataset. It will keep only records where this column matches: ${localCondition || "{col} = ''"}.`;
    }
    if (node.type === 'joinNode') {
      return "LEFT JOIN matching engine. It joins your secondary sheet to the base sheet case-insensitively, trimming surrounding spaces automatically, so mismatched names align perfectly.";
    }
    if (node.type === 'conditionNode') {
      return `Generates a brand new output column: '${localNewColumnName || 'amount'}' by evaluating custom conditional IF-ELSE rules. Ideal for bucketing or scoring values!`;
    }
    return "";
  };

  const getNodeIcon = () => {
    if (node.type === 'transformNode') return <Sparkles size={16} style={{ color: '#a855f7' }} />;
    if (node.type === 'mathNode') return <Calculator size={16} style={{ color: '#3b82f6' }} />;
    if (node.type === 'filterNode') return <Filter size={16} style={{ color: '#ec4899' }} />;
    if (node.type === 'joinNode') return <Link2 size={16} style={{ color: '#06b6d4' }} />;
    if (node.type === 'conditionNode') return <ListChecks size={16} style={{ color: '#10b981' }} />;
    return <Sliders size={16} />;
  };

  const sourceInfo = getUpstreamSourceInfo(node.id, edges, nodes);
  const upstreamSources = getUpstreamSourcesInfo(node.id, edges, nodes);
  const outputInfoList = getDownstreamOutputInfo(node.id, edges, nodes);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>
            {getNodeIcon()} Inspector: {
              node.type === 'transformNode' ? 'Transform Block' : 
              node.type === 'mathNode' ? 'Math Block' : 
              node.type === 'filterNode' ? 'Filter Block' : 
              node.type === 'conditionNode' ? 'Conditional Block' : 
              'Join Block'
            }
          </h3>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        <div className={styles.body}>
          {/* Visual Operation Inspection Indicator */}
          <div className={styles.inspectCard}>
            <Info size={18} className={styles.inspectIcon} />
            <p className={styles.inspectText}>{getInspectionDetails()}</p>
          </div>

          {/* Connection Path Details */}
          {(node.type === 'filterNode' || node.type === 'transformNode' || node.type === 'conditionNode' || node.type === 'mathNode') && (
            <div className={styles.connectionsCard}>
              <h5 className={styles.connectionsCardTitle}>Active Connection Path</h5>
              <div className={styles.connectionsGrid}>
                <div className={styles.connectionSide}>
                  <span className={styles.sideLabel}>Source Input(s)</span>
                  {upstreamSources.length > 0 ? (
                    upstreamSources.map((src, idx) => (
                      <div key={idx} className={styles.sideValue} style={{ display: 'flex', alignItems: 'center', marginBottom: '6px', gap: '6px' }}>
                        <span style={{
                          backgroundColor: '#f3e8ff',
                          color: '#7e22ce',
                          border: '1px solid #d8b4fe',
                          borderRadius: '4px',
                          padding: '1px 6px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          fontFamily: 'monospace'
                        }}>
                          {src.customName ? `{${src.customName}}` : `{col${idx + 1}}`}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className={styles.fileLabel} title={src.fileName}>{src.fileName.replace(/\.[^/.]+$/, "")}</span>
                          <span className={styles.colLabel} style={{ fontSize: '11px', color: '#6b7280' }}>↳ {src.columnName}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <span className={styles.sideEmpty}>Not connected</span>
                  )}
                </div>
                
                <div className={styles.connectionArrow}>➔</div>
                
                <div className={styles.connectionSide}>
                  <span className={styles.sideLabel}>Destination Output</span>
                  {outputInfoList.length > 0 ? (
                    outputInfoList.map((out, idx) => (
                      <div key={idx} className={styles.sideValue}>
                        <span className={styles.fileLabelOutput} title={out.name}>{out.name}</span>
                        <span className={styles.colLabel}>↳ {out.columnName}</span>
                      </div>
                    ))
                  ) : (
                    <span className={styles.sideEmpty}>Not connected</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Edit Panel */}
          <div className={styles.editPanel}>
            <h4 className={styles.panelTitle}>Pipeline Configuration</h4>

            {node.type !== 'joinNode' && (
              <div className={styles.formGroup} style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Custom Variable Name (Alias):</label>
                <input 
                  type="text" 
                  className={styles.input} 
                  value={localCustomName || ''} 
                  onChange={handleCustomNameChange}
                  onBlur={() => handleFinishEditing('customName', localCustomName, '')}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleFinishEditing('customName', localCustomName, ''); }}
                  placeholder="e.g. percentage_calculator (only letters, numbers, and underscores)"
                />
                <span className={styles.hint}>
                  You can reference this block's calculated value downstream as <code>{`{${localCustomName || 'alias'}}`}</code> (no spaces, only letters, numbers, and underscores).
                </span>
              </div>
            )}

            {node.type === 'transformNode' && (
              <TransformInspector
                localType={localType}
                handleTypeChange={handleTypeChange}
                localScript={localScript}
                handleScriptChange={handleScriptChange}
                handleFinishEditing={handleFinishEditing}
                upstreamSources={upstreamSources}
              />
            )}

            {node.type === 'mathNode' && (
              <MathInspector
                localExpression={localExpression}
                handleExpressionChange={handleExpressionChange}
                handleFinishEditing={handleFinishEditing}
                localRoundDecimals={localRoundDecimals}
                handleRoundDecimalsChange={handleRoundDecimalsChange}
              />
            )}

            {node.type === 'filterNode' && (
              <FilterInspector
                localCondition={localCondition}
                handleConditionChange={handleConditionChange}
                handleFinishEditing={handleFinishEditing}
                localPassThroughIndex={localPassThroughIndex}
                handlePassThroughIndexChange={handlePassThroughIndexChange}
                upstreamSources={upstreamSources}
              />
            )}

            {node.type === 'joinNode' && (
              <JoinInspector />
            )}

            {node.type === 'conditionNode' && (
              <ConditionInspector
                localNewColumnName={localNewColumnName}
                handleNewColumnNameChange={handleNewColumnNameChange}
                handleFinishEditing={handleFinishEditing}
                localRules={localRules}
                handleRuleChange={handleRuleChange}
                removeRule={removeRule}
                addRule={addRule}
                localElseVal={localElseVal}
                handleElseValChange={handleElseValChange}
              />
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.delBtn} onClick={handleDelete} title="Delete block from canvas">
            <Trash2 size={14} /> Delete Block
          </button>
          
          <div className={styles.footerActions}>
            {node.type !== 'joinNode' && (
              <button className={styles.resetBtn} onClick={handleReset}>
                Reset to Default
              </button>
            )}
            <button className={styles.saveBtn} onClick={onClose}>
              Close Inspector
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
