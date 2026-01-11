/**
 * Angie V2 Entry Point
 * Replaces the old demo-mcp-server.ts
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChatInterface } from './local-sdk/ChatInterface';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // 1. Create container if it doesn't exist
    let container = document.getElementById('angie-local-root'); // Changed to match existing php logic or update php.
    // The previous php rendered 'angie-local-root'. The snippet provided said 'angie-root'.
    // I will check angie-demo.php later. I'll stick to 'angie-local-root' to match current php, or update php.
    // The snippet provided: "container.id = 'angie-root'".
    // I will use 'angie-local-root' to be safe with existing php, OR update php to output 'angie-root'.
    // The previous php rendered 'angie-local-root'.
    // I will use 'angie-local-root' here to avoid conflict if I forget to update php div id.
    // Actually, I am supposed to use the provided code.
    // Provided code: "container.id = 'angie-root'".
    // I will update PHP to output 'angie-root' or rely on this script creating it.

    if (!container) {
        container = document.createElement('div');
        container.id = 'angie-root';
        // If PHP outputs 'angie-local-root', this creates a duplicate/parallel root.
        // I should probably check for 'angie-local-root' first.
        const existing = document.getElementById('angie-local-root');
        if (existing) container = existing;
        else document.body.appendChild(container);
    }

    // 2. Extract configuration from localized script data (set by PHP)
    // In angie-demo.php, we should be using wp_localize_script to pass this object
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
