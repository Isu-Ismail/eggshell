import { ProjectProvider } from './context/ProjectContext';
import Workspace from './pages/workspace/Workspace';
import ExternalPreview from './pages/preview/ExternalPreview';
import ExternalEditor from './pages/editor/ExternalEditor';
import './index.css';

function App() {
  const params = new URLSearchParams(window.location.search);
  const isPreviewPage = params.get('page') === 'preview';
  const isEditorPage = params.get('page') === 'editor';

  return (
    <ProjectProvider>
      {isEditorPage ? (
        <ExternalEditor />
      ) : isPreviewPage ? (
        <ExternalPreview />
      ) : (
        <Workspace />
      )}
    </ProjectProvider>
  );
}

export default App;
