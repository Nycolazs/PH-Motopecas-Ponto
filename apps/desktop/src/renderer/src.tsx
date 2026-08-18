import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app.js';
import { applyTheme, readInitialTheme } from './theme.js';
import './styles.css';

applyTheme(readInitialTheme());

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('Renderer root element was not found.');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
