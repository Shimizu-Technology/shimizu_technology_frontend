// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';          // merged Tailwind + custom CSS
import RootApp from './RootApp';  // top-level router
import { registerServiceWorker } from './serviceWorkerRegistration';

// Register service worker for PWA functionality and push notifications
registerServiceWorker({
  onSuccess: (registration) => {
    console.log('Service worker registered for push notifications', registration);
  },
  onUpdate: (registration) => {
    console.log('Service worker updated', registration);
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>
);
