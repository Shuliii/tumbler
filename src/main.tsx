import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Fonts are bundled with the app (no Google Fonts call), so print text always matches the preview.
import '@fontsource/pacifico';
import '@fontsource/bebas-neue';
import '@fontsource/playfair-display/700.css';
import '@fontsource/baloo-2/800.css';
import '@fontsource/permanent-marker';
import './styles.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
