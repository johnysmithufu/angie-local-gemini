import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "./InMemoryTransport";
import { GeminiClient } from "./GeminiClient";

export class LocalHostController {
    private static instance: LocalHostController;
    private mcpClient: Client | null = null;
    private geminiClient: GeminiClient;
    private tools: any[] = [];
    private listeners: Function[] = [];

    private constructor() {
        const apiKey = (window as any).angieLocalSettings?.apiKey || '';
        this.geminiClient = new GeminiClient(apiKey);
    }

    public static getInstance(): LocalHostController {
        if (!LocalHostController.instance) {
            LocalHostController.instance = new LocalHostController();
        }
        return LocalHostController.instance;
    }

    public updateApiKey(key: string) {
        this.geminiClient.setKey(key);
    }

    public subscribe(listener: Function) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notify(event: string, data?: any) {
        this.listeners.forEach(l => l(event, data));
    }

    public async registerServer(serverInstance: any) {
        const clientTransport = new InMemoryTransport();
        const serverTransport = new InMemoryTransport();

        clientTransport.connect(serverTransport);
        await serverInstance.connect(serverTransport);

        this.mcpClient = new Client(
            { name: "AngieLocalHost", version: "1.0.0" },
            { capabilities: {} }
        );
        await this.mcpClient.connect(clientTransport);

        const result = await this.mcpClient.listTools();
        this.tools = result.tools;
        this.notify('TOOLS_UPDATED', this.tools);
    }

    // Accepts 'model' argument now
    public async processMessage(history: any[], userMessage: string, model: string = 'gemini-2.5-flash'): Promise<any[]> {
        const newHistory = [...history, { role: 'user', content: userMessage }];

        try {
            // Step 1: Query Gemini (Pass model)
            const llmResponse = await this.geminiClient.generate(newHistory, this.tools, model);

            if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
                newHistory.push({
                    role: 'model',
                    content: '',
                    toolCalls: llmResponse.toolCalls
                });

                for (const call of llmResponse.toolCalls) {
                    try {
                        const result = await this.mcpClient?.callTool({
                            name: call.name,
                            arguments: call.args
                        });
                        newHistory.push({
                            role: 'tool',
                            name: call.name,
                            content: JSON.stringify(result)
                        });
                    } catch (e: any) {
                        newHistory.push({
                            role: 'tool',
                            name: call.name,
                            content: `Error executing ${call.name}: ${e.message}`
                        });
                    }
                }

                // Step 2: Summary (Pass model)
                const finalResponse = await this.geminiClient.generate(newHistory, [], model);
                newHistory.push({ role: 'model', content: finalResponse.text });
            } else {
                newHistory.push({ role: 'model', content: llmResponse.text });
            }

            return newHistory;
        } catch (e: any) {
            newHistory.push({ role: 'model', content: `**Error:** ${e.message}` });
            return newHistory;
        }
    }
}
