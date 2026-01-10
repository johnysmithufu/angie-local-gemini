import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChatInterface } from './ChatInterface';
import { LocalHostController } from './LocalHostController';
import { McpServer as RealMcpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
export const CallToolRequestSchema = {};
export const ListToolsRequestSchema = {};

export type AngieServerConfig = {
    name: string;
    version: string;
    description?: string;
    server: RealMcpServer;
};

export class AngieMcpSdk {
    private controller: LocalHostController;

    constructor() {
        console.log("Angie Local SDK: Initializing...");
        this.controller = LocalHostController.getInstance();
    }

    async waitForReady() {
        return Promise.resolve();
    }

    async registerServer(config: AngieServerConfig) {
        console.log(`Angie Local SDK: Registering server "${config.name}"...`);
        await this.controller.registerServer(config.server);
        this.mountUI();
    }

    private mountUI() {
        const rootEl = document.getElementById('angie-local-root');
        if (rootEl && !rootEl.hasChildNodes()) {
            const root = createRoot(rootEl);
            root.render(React.createElement(ChatInterface, {
                controller: this.controller
            }));
        }
    }
}
