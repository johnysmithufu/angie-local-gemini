import { z } from 'zod';
import { AngieTool } from './types';
import { analyzePageSeo, managePostTypes, securityCheck, runFireworks } from './tools/StandardTools';

export type { AngieTool };

export class MCPOrchestrator {
    private tools: Map<string, AngieTool> = new Map();

    constructor() {
        this.registerDefaultTools();
    }

    registerTool(tool: AngieTool) {
        this.tools.set(tool.name, { ...tool, isEnabled: true });
    }

    // Disable a tool temporarily
    disableTool(name: string) {
        const tool = this.tools.get(name);
        if (tool) tool.isEnabled = false;
    }

    getRegistry(): any[] {
        return Array.from(this.tools.values())
            .filter(t => t.isEnabled)
            .map(t => ({
                name: t.name,
                description: t.description,
                parameters: this.zodToJsonSchema(t.schema)
            }));
    }

    async executeTool(name: string, args: any): Promise<any> {
        const tool = this.tools.get(name);
        if (!tool || !tool.isEnabled) throw new Error(`Tool ${name} not found.`);

        // Safety Check
        if (tool.requiresConfirmation) {
            console.warn(`Executing sensitive tool: ${name}`);
        }

        try {
            return await tool.handler(args);
        } catch (e) {
            console.error(`Tool execution failed: ${name}`, e);
            return { error: `Tool failed: ${e}` };
        }
    }

    private registerDefaultTools() {
        // Register the migrated tools
        this.registerTool(analyzePageSeo);
        this.registerTool(managePostTypes);
        this.registerTool(securityCheck);
        this.registerTool(runFireworks);

        // Register basic system tools
        this.registerTool({
            name: 'get_site_health',
            description: 'Retrieves WordPress Site Health status',
            schema: z.object({}),
            handler: async () => ({ status: 'good', version: '6.4.2', debug_mode: false })
        });

        // Example: Adding the File System tool
        this.registerTool({
            name: 'read_log_file',
            description: 'Reads the last 50 lines of debug.log',
            schema: z.object({ lines: z.number().optional() }),
            handler: async ({ lines }) => {
                // This would call the PHP endpoint
                return { content: "Log data placeholder..." };
            }
        });
    }

    private zodToJsonSchema(schema: any): any {
        // Simplified converter for demo purposes
        // In prod, use 'zod-to-json-schema' package
        return { type: "object", properties: {} };
    }
}
