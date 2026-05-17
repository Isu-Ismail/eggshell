import { useReactFlow } from '@xyflow/react';
import { useProject } from '../../context/ProjectContext';
import { Eye, Hand, MousePointer, ZoomIn, ZoomOut, Maximize, Sparkles } from 'lucide-react';
import styles from './Workspace.module.css';

export default function CanvasControls({ isSelectMode, setIsSelectMode }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { autoArrangeCanvas } = useProject();

  const handleOpenPreview = () => {
    const previewUrl = window.location.origin + window.location.pathname + '?page=preview';
    window.open(previewUrl, '_blank');
  };

  return (
    <div className={styles.zoomPanel}>
      <button 
        className={styles.previewTabBtn} 
        onClick={handleOpenPreview} 
        title="Open Live Preview in New Tab (Eye Mode)"
      >
        <Eye size={18} />
      </button>
      <button 
        className={`${styles.zoomBtn} ${!isSelectMode ? styles.activeBtn : ''}`}
        onClick={() => setIsSelectMode(false)}
        title="Pan Mode (Drag Canvas to Navigate)"
      >
        <Hand size={18} />
      </button>
      <button 
        className={`${styles.zoomBtn} ${isSelectMode ? styles.activeBtn : ''}`}
        onClick={() => setIsSelectMode(true)}
        title="Select Mode (Drag a Box to Multi-Select)"
      >
        <MousePointer size={18} />
      </button>
      <button 
        className={styles.zoomBtn} 
        onClick={() => zoomIn()} 
        title="Zoom In (Maximize)"
      >
        <ZoomIn size={18} />
      </button>
      <button 
        className={styles.zoomBtn} 
        onClick={() => zoomOut()} 
        title="Zoom Out (Minimize)"
      >
        <ZoomOut size={18} />
      </button>
      <button 
        className={styles.zoomBtn} 
        onClick={() => fitView({ padding: 0.2, duration: 400 })} 
        title="Fit All Nodes"
      >
        <Maximize size={18} />
      </button>
      <button 
        className={styles.tidyBtn} 
        onClick={() => {
          autoArrangeCanvas();
          setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 80);
        }} 
        title="Tidy Canvas (Magic Auto-Arrange Nodes & Clean Overlaps)"
      >
        <Sparkles size={18} />
      </button>
    </div>
  );
}
