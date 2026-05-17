import { ProjectProvider } from './context/ProjectContext';
import Workspace from './pages/workspace/Workspace';
import ExternalPreview from './pages/preview/ExternalPreview';
import './index.css';

function App() {
  const params = new URLSearchParams(window.location.search);
  const isPreviewPage = params.get('page') === 'preview';

  return (
    <ProjectProvider>
      {isPreviewPage ? <ExternalPreview /> : <Workspace />}
    </ProjectProvider>
  );
}

export default App;
