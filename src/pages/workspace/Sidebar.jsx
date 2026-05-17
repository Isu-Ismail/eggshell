import { useRef, useState, useEffect } from 'react';
import { importFileToDB } from '../../services/importService';
import { useProject } from '../../context/ProjectContext';
import { useSqlite } from '../../hooks/useSqlite';
import { UploadCloud, Loader, Trash2, XCircle, ChevronLeft, PlusCircle, HelpCircle, Sparkles, Filter, Link2, BrainCircuit, Eye, EyeOff, ListChecks } from 'lucide-react';
import { ConfirmModal, AlertModal } from '../../components/ui/Modal';
import styles from './Sidebar.module.css';

export default function Sidebar({ isCollapsed, onCollapse, onOpenTutorial, onOpenAiModal, onOpenWhyChoose }) {
  const fileInputRef = useRef(null);
  const outputTemplateRef = useRef(null);
  
  const { 
    addFile, files, removeFile, clearAllFiles, 
    addOutputNode, addTransformNode, addFilterNode, addJoinNode, addConditionNode,
    nodes, addFileToCanvas, removeFileFromCanvas, addOutputNodeFromTemplate
  } = useProject();
  const { isReady, execute } = useSqlite();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ file: '', count: 0 });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [alertState, setAlertState] = useState({ isOpen: false, title: '', message: '' });
  
  const [isOpMenuOpen, setIsOpMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpMenuOpen(false);
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
        addFile(parsedData);
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

  return (
    <div className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
  <div className={styles.headerRow}>
    <div className={styles.brandingGroup}>
      <div className={styles.brandBox} onClick={onOpenWhyChoose} title="Click to view why Melder is better than Excel">
        <h2 className={styles.title}>Melder</h2>
        {!isCollapsed && (
          <button 
            className={styles.brandHelpBtn} 
            onClick={(e) => { e.stopPropagation(); onOpenWhyChoose(); }}
            title="Why Choose Melder?"
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
            accept=".xlsx,.csv" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleUpload}
          />
        </div>

        <button className={styles.addOutputBtn} onClick={addOutputNode} title="Create blank output file layout">
          <PlusCircle size={18} /> Add Output File
        </button>

        <button className={styles.importOutputBtn} onClick={() => isReady && !loading && outputTemplateRef.current.click()} title="Import excel sheet to pre-fill output columns">
          <UploadCloud size={18} /> Import Output Layout
        </button>
        <input 
          type="file" 
          accept=".xlsx,.csv" 
          ref={outputTemplateRef} 
          style={{ display: 'none' }} 
          onChange={handleUploadOutputTemplate}
        />

        <button className={styles.aiBtn} onClick={onOpenAiModal} title="Configure visual pipeline using AI Scripting Prompt JSON configs">
          <BrainCircuit size={18} /> AI Scripting Panel
        </button>

        <div className={styles.opBtnContainer} ref={dropdownRef}>
          <button 
            className={styles.addOpBtn} 
            onClick={() => setIsOpMenuOpen(!isOpMenuOpen)} 
            title="Add transformation/join/filter operation block to canvas"
          >
            <PlusCircle size={18} /> Add Block...
          </button>
          
          {isOpMenuOpen && (
            <div className={styles.opDropdown}>
              <button 
                onClick={() => { addTransformNode(); setIsOpMenuOpen(false); }}
                title="Visual String Transform Node (Upper/Lower/Trim/Custom)"
              >
                <Sparkles size={14} /> Transform Block
              </button>
              <button 
                onClick={() => { addConditionNode(); setIsOpMenuOpen(false); }}
                title="Visual If-Else Conditional Block (for amount mappings, scoring, etc.)"
              >
                <ListChecks size={14} /> Conditional Block
              </button>
              <button 
                onClick={() => { addFilterNode(); setIsOpMenuOpen(false); }}
                title="Visual SQL Filter Node (e.g. {col} = 'value')"
              >
                <Filter size={14} /> Filter Block
              </button>
              <button 
                onClick={() => { addJoinNode(); setIsOpMenuOpen(false); }}
                title="Visual LEFT JOIN Mismatch Key Node"
              >
                <Link2 size={14} /> Join Block
              </button>
            </div>
          )}
        </div>
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
