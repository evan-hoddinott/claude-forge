import './renderer/assets/fonts/fonts.css';
import './index.css';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import App from './renderer/App';
import { ToastProvider } from './renderer/components/Toast';

createRoot(document.getElementById('root')!).render(
  createElement(ToastProvider, null, createElement(App)),
);
