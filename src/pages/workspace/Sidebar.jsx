import { useRef, useState, useEffect } from 'react';
import { importFileToDB } from '../../services/importService';
import { db } from '../../services/db';
import { useProject } from '../../context/ProjectContext';
import { useSqlite } from '../../hooks/useSqlite';
import { UploadCloud, Loader, Trash2, XCircle, ChevronLeft, PlusCircle, HelpCircle, Sparkles, Filter, Link2, BrainCircuit, Eye, EyeOff, ListChecks, Download, Settings2, Edit, Calculator, Database, Braces } from 'lucide-react';
import { ConfirmModal, AlertModal } from '../../components/ui/Modal';
import styles from './Sidebar.module.css';

export default function Sidebar({ isCollapsed, onCollapse, onOpenTutorial, onOpenAiModal, onOpenWhyChoose, onOpenEditor }) {
  const fileInputRef = useRef(null);
  const outputTemplateRef = useRef(null);
  
  const { 
    addFile, files, removeFile, clearAllFiles, 
    addOutputNode, addTransformNode, addMathNode, addFilterNode, addJoinNode, addConditionNode,
    nodes, edges, addFileToCanvas, removeFileFromCanvas, addOutputNodeFromTemplate,
    exportFullPipelineConfig
  } = useProject();
  const { isReady, execute } = useSqlite();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ file: '', count: 0 });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [alertState, setAlertState] = useState({ isOpen: false, title: '', message: '' });
  
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [isBlocksMenuOpen, setIsBlocksMenuOpen] = useState(false);
  const [blockSearchQuery, setBlockSearchQuery] = useState('');
  const toolsDropdownRef = useRef(null);
  const blocksDropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(e.target)) {
        setIsToolsMenuOpen(false);
      }
      if (blocksDropdownRef.current && !blocksDropdownRef.current.contains(e.target)) {
        setIsBlocksMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleUpload = async (e) => {
    const uploadedFiles = Array.from(e.target.files);
    if (!uploadedFiles.length) return;

    setLoading(true);
    try {
      for (const file of uploadedFiles) {
        setProgress({ file: file.name, count: 0 });
        const parsedData = await importFileToDB(file, (count) => {
          setProgress({ file: file.name, count });
        });
        
        const importedArray = Array.isArray(parsedData) ? parsedData : [parsedData];
        for (const pd of importedArray) {
          await execute(`CREATE TABLE IF NOT EXISTS backup_${pd.id} AS SELECT * FROM ${pd.id};`);
          addFile(pd);
        }
      }
    } catch (err) {
      console.error("Failed to parse/upload file", err);
      setAlertState({ isOpen: true, title: 'Upload Failed', message: err.message || 'Failed to read file.' });
    } finally {
      e.target.value = ''; 
      setLoading(false);
    }
  };

  const handleUploadOutputTemplate = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      setProgress({ file: file.name, count: 0 });
      const parsedData = await importFileToDB(file, () => {});
      addOutputNodeFromTemplate(file.name, parsedData.headers);
    } catch (err) {
      console.error("Failed to parse output template", err);
      setAlertState({ 
        isOpen: true, 
        title: 'Template Import Failed', 
        message: err.message || 'Failed to extract headers from the file.' 
      });
    } finally {
      e.target.value = '';
      setLoading(false);
    }
  };

  const handleDelete = async (fileId) => {
    try {
      await execute(`DROP TABLE IF EXISTS ${fileId}`);
      await execute(`DROP TABLE IF EXISTS backup_${fileId}`);
      removeFile(fileId);
    } catch (err) {
      console.error("Delete err", err);
    }
  };

  const handleClearAll = () => {
    setConfirmOpen(true);
  };

  const executeClearAll = async () => {
    setConfirmOpen(false);
    try {
      for (const f of files) {
        await execute(`DROP TABLE IF EXISTS ${f.id}`);
        await execute(`DROP TABLE IF EXISTS backup_${f.id}`);
      }
      clearAllFiles();
    } catch (err) {
       console.error("Clear err", err);
    }
  };

  const toggleCanvasPresence = (e, fileId, isVisible) => {
    e.stopPropagation();
    if (isVisible) {
      removeFileFromCanvas(fileId);
    } else {
      addFileToCanvas(fileId);
    }
  };

  const blocks = [
    { name: 'Transform Block', desc: 'UPPERCASE, lowercase, TRIM, Serial No, Custom Script', icon: <Sparkles size={14} />, action: addTransformNode, className: styles.toolItemTransform },
    { name: 'Math Block', desc: 'Arithmetic (+, -, *, /) and rounding config', icon: <Calculator size={14} />, action: addMathNode, className: styles.toolItemMath },
    { name: 'Conditional Block', desc: 'IF-ELSE conditional scoring and logic', icon: <ListChecks size={14} />, action: addConditionNode, className: styles.toolItemCondition },
    { name: 'Filter Block', desc: 'WHERE filters (e.g. {col} > 10)', icon: <Filter size={14} />, action: addFilterNode, className: styles.toolItemFilter },
    { name: 'Join Block', desc: 'LEFT JOIN alignment key stitching', icon: <Link2 size={14} />, action: addJoinNode, className: styles.toolItemJoin },
  ];

  const filteredBlocks = blocks.filter(b => 
    b.name.toLowerCase().includes(blockSearchQuery.toLowerCase()) || 
    b.desc.toLowerCase().includes(blockSearchQuery.toLowerCase())
  );

  return (
    <div className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
  <div className={styles.headerRow}>
    <div className={styles.brandingGroup}>
      <div className={styles.brandBox} onClick={onOpenWhyChoose} title="Click to view Welcome Screen and feature showcase">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="EggShell Logo" style={{ width: '24px', height: '24px', marginRight: '8px' }} />
        <h2 className={styles.title}>EggShell</h2>
        {!isCollapsed && (
          <button 
            className={styles.brandHelpBtn} 
            onClick={(e) => { e.stopPropagation(); onOpenWhyChoose(); }}
            title="Welcome to EggShell"
          >
            <HelpCircle size={12} />
          </button>
        )}
      </div>
      {!isCollapsed && (
        <p className={styles.subtitle}>Stitch, transform, and merge datasets seamlessly</p>
      )}
    </div>
    <button className={styles.collapseBtn} onClick={onCollapse} title="Collapse Sidebar">
      <ChevronLeft size={18} />
    </button>
  </div>

      <div className={styles.actionsGroup}>
        <div className={styles.uploadZone} onClick={() => isReady && !loading && fileInputRef.current.click()}>
          {loading ? (
            <Loader size={22} className={`${styles.icon} ${styles.spin}`} />
          ) : (
            <UploadCloud size={22} className={styles.icon} />
          )}
          <span className={styles.uploadText}>
            {loading 
              ? `Uploading... (${progress.count})` 
              : isReady ? "Import Data" : "Loading..."}
          </span>
          <input 
            type="file" 
            multiple
            accept=".xlsx,.csv,.sqlite,.sqlite3,.db" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleUpload}
          />
        </div>

        {/* Standalone Add Output File button */}
        <button 
          className={styles.addOutputBtn} 
          onClick={addOutputNode}
          title="Create blank output file layout"
        >
          <PlusCircle size={16} /> Add Output File
        </button>

        {/* Blocks Dropdown with search */}
        <div className={styles.dropdownContainer} ref={blocksDropdownRef}>
          <button 
            className={styles.blocksBtn} 
            onClick={() => {
              setIsBlocksMenuOpen(!isBlocksMenuOpen);
              setBlockSearchQuery('');
            }} 
            title="Search and add pipeline block nodes to canvas"
          >
            <Settings2 size={16} /> Blocks
          </button>
          
          {isBlocksMenuOpen && (
            <div className={styles.dropdownMenu}>
              <div className={styles.searchWrapper}>
                <input 
                  type="text" 
                  className={styles.searchBar} 
                  placeholder="Search blocks..." 
                  value={blockSearchQuery} 
                  onChange={(e) => setBlockSearchQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()} 
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (filteredBlocks.length > 0) {
                        filteredBlocks[0].action();
                        setIsBlocksMenuOpen(false);
                      }
                    }
                  }}
                  autoFocus
                />
              </div>
              <div className={styles.blocksList}>
                {filteredBlocks.length > 0 ? (
                  filteredBlocks.map((b, idx) => (
                    <button 
                      key={idx}
                      onClick={() => { b.action(); setIsBlocksMenuOpen(false); }}
                      title={b.desc}
                      className={b.className}
                    >
                      {b.icon} {b.name}
                    </button>
                  ))
                ) : (
                  <div className={styles.noResults}>No blocks match search</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tools Dropdown */}
        <div className={styles.dropdownContainer} ref={toolsDropdownRef}>
          <button 
            className={styles.toolsBtn} 
            onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)} 
            title="Expand templates, AI scripting and exports"
          >
            <BrainCircuit size={16} /> Tools
          </button>
          
          {isToolsMenuOpen && (
            <div className={styles.dropdownMenu}>
              <button 
                onClick={() => { outputTemplateRef.current.click(); setIsToolsMenuOpen(false); }}
                title="Import excel sheet to pre-fill output columns"
                className={styles.toolItemTemplate}
              >
                <UploadCloud size={14} /> Import Output Layout
              </button>

              <button 
                onClick={() => { onOpenAiModal(); setIsToolsMenuOpen(false); }}
                title="Configure visual pipeline using AI Scripting Prompt JSON configs"
                className={styles.toolItemAi}
              >
                <BrainCircuit size={14} /> AI Scripting Panel
              </button>

              <button 
                onClick={() => {
                  const configStr = exportFullPipelineConfig();
                  if (!configStr) return;
                  const blob = new Blob([configStr], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `stitcher_full_pipeline_config.json`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                  setIsToolsMenuOpen(false);
                }} 
                title="Download entire canvas pipeline configuration"
                className={styles.toolItemExport}
              >
                <Braces size={14} /> Export Pipeline JSON
              </button>

              <button 
                onClick={async () => {
                  try {
                    const file = await db.getDatabaseFile();
                    const url = URL.createObjectURL(file);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'eggshell_database.sqlite';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  } catch(e) {
                    setAlertState({isOpen: true, title: 'Export Failed', message: e.message});
                  }
                  setIsToolsMenuOpen(false);
                }} 
                title="Download entire SQLite database with all tables and data"
                className={styles.toolItemExport}
              >
                <Database size={14} /> Export SQLite DB
              </button>
            </div>
          )}
        </div>

        <input 
          type="file" 
          accept=".xlsx,.csv" 
          ref={outputTemplateRef} 
          style={{ display: 'none' }} 
          onChange={handleUploadOutputTemplate}
        />
      </div>

      <div className={styles.fileListWrapper}>
        <div className={styles.listHeader}>
          <h3>Uploaded Data</h3>
          {files.length > 0 && (
            <button className={styles.clearBtn} onClick={handleClearAll} title="Clear all data">
              <XCircle size={14} /> Clear
            </button>
          )}
        </div>
        
        <div className={styles.fileList}>
          {files.map(f => {
            const isVisible = nodes.some(n => n.id === f.id);
            return (
              <div 
                key={f.id} 
                className={`${styles.fileCard} ${isVisible ? '' : styles.fileCardHidden}`}
                onClick={(e) => toggleCanvasPresence(e, f.id, isVisible)}
                title={isVisible ? "Click to remove from canvas (keeps database intact)" : "Click to restore back to canvas"}
              >
                <div className={styles.fileInfo}>
                  <span className={styles.fileName} title={f.fileName}>{f.fileName}</span>
                  <span className={styles.fileStats}>{f.rowCount} rows</span>
                </div>
                
                <div className={styles.cardActions} onClick={e => e.stopPropagation()}>
                  <button 
                    className={styles.editBtn} 
                    onClick={() => onOpenEditor(f.id)} 
                    title="Edit File Data (Excel Editor)"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    className={`${styles.visibleBtn} ${isVisible ? styles.visibleActive : ''}`} 
                    onClick={(e) => toggleCanvasPresence(e, f.id, isVisible)}
                    title={isVisible ? "Hide from Canvas" : "Show on Canvas"}
                  >
                    {isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button className={styles.delBtn} onClick={() => handleDelete(f.id)} title="Delete permanently from Database">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.tutorialBtnWrapper}>
        <button className={styles.tutorialBtn} onClick={onOpenTutorial} title="Open interactive cheat-sheet and guides">
          <HelpCircle size={16} /> How-To & Guides
        </button>
      </div>
      
      <ConfirmModal 
        isOpen={confirmOpen}
        title="Clear All Data?"
        message="Are you sure you want to delete all uploaded files? This will permanently wipe the tables from your local database."
        onConfirm={executeClearAll}
        onCancel={() => setConfirmOpen(false)}
      />
      
      <AlertModal 
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        onClose={() => setAlertState({ ...alertState, isOpen: false })}
      />
    </div>
  );
}
