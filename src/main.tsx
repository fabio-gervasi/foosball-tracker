import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { QueryProvider } from './providers/QueryProvider';
import './styles/main.css';

createRoot(document.getElementById('root')!).render(
  <QueryProvider>
    <App />
  </QueryProvider>
);
