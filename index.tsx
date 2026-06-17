
import React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import App from './App';
import './index.css'; 

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

try {
    // Safely resolve createRoot from either named export (standard ESM) or default export (some bundles)
    const createRoot = ReactDOMClient?.createRoot || (ReactDOMClient as any)?.default?.createRoot;

    if (!createRoot) {
        console.error("ReactDOMClient exports:", ReactDOMClient);
        throw new Error("Failed to resolve createRoot from react-dom/client");
    }

    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
} catch (error) {
    console.error("Failed to mount application:", error);
    // Added z-index and background to ensure error is visible over the app background
    rootElement.innerHTML = `<div style="color: #ff6b6b; padding: 20px; background: rgba(0,0,0,0.9); position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999; overflow: auto;">
        <h1 style="font-size: 24px; margin-bottom: 10px;">Application Error</h1>
        <p>Failed to load application. Please check the console for details.</p>
        <pre style="background: #333; padding: 10px; border-radius: 5px; white-space: pre-wrap;">${error instanceof Error ? error.message : String(error)}</pre>
        <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 5px; cursor: pointer;">Reload Page</button>
    </div>`;
}
