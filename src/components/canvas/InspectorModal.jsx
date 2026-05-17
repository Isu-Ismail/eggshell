import { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { Trash2, Info, Sliders, Settings, Sparkles, Filter, Link2, ListChecks } from 'lucide-react';
import styles from './InspectorModal.module.css';

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

  return getUpstreamSourceInfo(sourceNode.id, currentEdges, currentNodes);
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

  // Condition node dynamic states
  const [localNewColumnName, setLocalNewColumnName] = useState('amount');
  const [localRules, setLocalRules] = useState([]);
  const [localElseVal, setLocalElseVal] = useState('0');

  // Synchronize local edit buffer state only when the active node changes
  useEffect(() => {
    const activeNode = nodes.find(n => n.id === nodeId);
    if (activeNode) {
      setNode(activeNode);
      setLocalType(activeNode.data.type || 'UPPER');
      setLocalScript(activeNode.data.script || '');
      setLocalCondition(activeNode.data.condition || '');
      setLocalNewColumnName(activeNode.data.newColumnName || 'amount');
      setLocalRules(activeNode.data.rules || [{ operator: '=', value: 'paid', thenVal: '1000' }]);
      setLocalElseVal(activeNode.data.elseVal || '0');
    }
  }, [nodeId, nodes]);

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

  const handleConditionChange = (e) => {
    const val = e.target.value;
    setLocalCondition(val);
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, condition: val } } : n));
  };

  const handleNewColumnNameChange = (e) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
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
    } else if (node.type === 'filterNode') {
      setLocalCondition("{col} = '1st Year'");
      setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { condition: "{col} = '1st Year'" } } : n));
    } else if (node.type === 'conditionNode') {
      setLocalNewColumnName('amount');
      setLocalRules([{ operator: '=', value: 'paid', thenVal: '1000' }]);
      setLocalElseVal('0');
      setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { newColumnName: 'amount', rules: [{ operator: '=', value: 'paid', thenVal: '1000' }], elseVal: '0' } } : n));
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
    if (node.type === 'filterNode') return <Filter size={16} style={{ color: '#ec4899' }} />;
    if (node.type === 'joinNode') return <Link2 size={16} style={{ color: '#06b6d4' }} />;
    if (node.type === 'conditionNode') return <ListChecks size={16} style={{ color: '#10b981' }} />;
    return <Sliders size={16} />;
  };

  const sourceInfo = getUpstreamSourceInfo(node.id, edges, nodes);
  const outputInfoList = getDownstreamOutputInfo(node.id, edges, nodes);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>
            {getNodeIcon()} Inspector: {
              node.type === 'transformNode' ? 'Transform Block' : 
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
          {(node.type === 'filterNode' || node.type === 'transformNode' || node.type === 'conditionNode') && (
            <div className={styles.connectionsCard}>
              <h5 className={styles.connectionsCardTitle}>Active Connection Path</h5>
              <div className={styles.connectionsGrid}>
                <div className={styles.connectionSide}>
                  <span className={styles.sideLabel}>Source Input</span>
                  {sourceInfo ? (
                    <div className={styles.sideValue}>
                      <span className={styles.fileLabel} title={sourceInfo.fileName}>{sourceInfo.fileName}</span>
                      <span className={styles.colLabel}>↳ {sourceInfo.columnName}</span>
                    </div>
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

            {node.type === 'transformNode' && (
              <div className={styles.formGroup}>
                <label className={styles.label}>Transformation Type:</label>
                <select 
                  className={styles.select} 
                  value={localType || 'UPPER'} 
                  onChange={handleTypeChange}
                >
                  <option value="UPPER">UPPERCASE (AA)</option>
                  <option value="LOWER">lowercase (aa)</option>
                  <option value="TRIM">TRIM (Auto)</option>
                  <option value="CUSTOM">Custom Script</option>
                </select>

                {localType === 'CUSTOM' && (
                  <div className={styles.scriptGroup}>
                    <label className={styles.label}>Custom Expression:</label>
                    <input 
                      type="text" 
                      className={styles.input} 
                      value={localScript || ''} 
                      onChange={handleScriptChange}
                      placeholder="e.g. {col} || ' (STUDENT)'"
                      title="Use {col} to represent input values"
                    />
                    <span className={styles.hint}>Tip: Use standard SQLite syntax. Reference input column using <code>{`{col}`}</code>.</span>
                  </div>
                )}
              </div>
            )}

            {node.type === 'filterNode' && (
              <div className={styles.formGroup}>
                <label className={styles.label}>WHERE Filter Condition:</label>
                <input 
                  type="text" 
                  className={styles.input} 
                  value={localCondition || ''} 
                  onChange={handleConditionChange}
                  placeholder="e.g. {col} = '1st Year'"
                />
                <span className={styles.hint}>Use <code>{`{col}`}</code> to reference mapped column values. e.g. <code>{`{col} = '1st Year'`}</code> or <code>{`{col} > 18`}</code>.</span>
              </div>
            )}

            {node.type === 'joinNode' && (
              <div className={styles.joinDetails}>
                <p>
                  <Settings size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} /> 
                  <strong>Zero-Config Mode:</strong> This block connects two sheets automatically. Simply wire the base sheet key to the yellow base handle, the matching sheet key to the purple handle, and let the engine stitch them in order.
                </p>
              </div>
            )}

            {node.type === 'conditionNode' && (
              <div className={styles.formGroup} style={{ gap: '14px' }}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>New Column Name:</label>
                  <input 
                    type="text" 
                    className={styles.input} 
                    value={localNewColumnName} 
                    onChange={handleNewColumnNameChange}
                    placeholder="e.g. amount or weight_category"
                  />
                  <span className={styles.hint}>The name of the new column to append (lowercase, no spaces).</span>
                </div>

                <div className={styles.rulesSection}>
                  <h5 className={styles.rulesSectionTitle}>Conditional Rules (If/Else-If)</h5>
                  {localRules.map((rule, idx) => (
                    <div key={idx} className={styles.ruleRow}>
                      <span className={styles.ruleLabel}>IF &#123;col&#125;</span>
                      <select 
                        className={styles.ruleSelect}
                        value={rule.operator}
                        onChange={(e) => handleRuleChange(idx, 'operator', e.target.value)}
                      >
                        <option value="=">=</option>
                        <option value="!=">!=</option>
                        <option value=">">&gt;</option>
                        <option value="<">&lt;</option>
                        <option value=">=">&gt;=</option>
                        <option value="<=">&lt;=</option>
                        <option value="CONTAINS">CONTAINS</option>
                      </select>
                      <input 
                        type="text" 
                        className={styles.ruleInput}
                        value={rule.value}
                        onChange={(e) => handleRuleChange(idx, 'value', e.target.value)}
                        placeholder="val"
                      />
                      <span className={styles.ruleLabel}>THEN</span>
                      <input 
                        type="text" 
                        className={styles.ruleInput}
                        value={rule.thenVal}
                        onChange={(e) => handleRuleChange(idx, 'thenVal', e.target.value)}
                        placeholder="result"
                      />
                      {localRules.length > 1 && (
                        <button 
                          className={styles.ruleDelBtn}
                          onClick={() => removeRule(idx)}
                          title="Remove Rule"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button className={styles.addRuleBtn} onClick={addRule}>
                    + Add Rule
                  </button>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>ELSE Default Value:</label>
                  <input 
                    type="text" 
                    className={styles.input} 
                    value={localElseVal} 
                    onChange={handleElseValChange}
                    placeholder="e.g. 0 or normal"
                  />
                  <span className={styles.hint}>The default fallback value written if none of the above conditions match.</span>
                </div>
              </div>
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
