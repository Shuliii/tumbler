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
import { AdminApp } from './admin/AdminApp';

// Two screens in one app: /admin is the shop's order page, everything else is the designer.
const isAdmin = location.pathname.startsWith('/admin');

createRoot(document.getElementById('root')!).render(<StrictMode>{isAdmin ? <AdminApp /> : <App />}</StrictMode>);
