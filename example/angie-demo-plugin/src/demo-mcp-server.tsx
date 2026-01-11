/**
 * Angie V2 Entry Point
 * Replaces the old demo-mcp-server.ts
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChatInterface } from './local-sdk/ChatInterface';
import './angie-styles.css'; // <--- IMPORT THE CSS FILE HERE

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // 1. Create container if it doesn't exist
    // Check for 'angie-local-root' which is output by the PHP footer hook
    let container = document.getElementById('angie-local-root');

    if (!container) {
        // Fallback: create it and append to body
        container = document.createElement('div');
        container.id = 'angie-local-root';
        document.body.appendChild(container);
    }

    // 2. Extract configuration from localized script data (set by PHP)
    const config = (window as any).angieConfig || {
        apiBaseUrl: '/wp-json', // Fallback
        nonce: ''
    };

    // 3. Mount React App
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <ChatInterface
                apiBaseUrl={config.apiBaseUrl}
                nonce={config.nonce}
            />
        </React.StrictMode>
    );

    console.log("Angie V2 (Omni-Update) Loaded 🚀");
});
