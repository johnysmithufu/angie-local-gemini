/**
 * Gemini Client
 * Routes requests through the WordPress Backend to avoid CORS/CSP issues.
 */
export class GeminiClient {
    // We don't need to store the key in the client anymore; the PHP side handles it.
    constructor(key: string) {}

    setKey(key: string) {
        // No-op for client-side, but kept for interface compatibility
    }

    private cleanSchema(schema: any): any {
        if (typeof schema !== 'object' || schema === null) return schema;
        const clean = { ...schema };
        delete clean.$schema;
        delete clean.additionalProperties;
        if (clean.properties) {
            for (const key in clean.properties) {
                clean.properties[key] = this.cleanSchema(clean.properties[key]);
            }
        }
        if (clean.items) clean.items = this.cleanSchema(clean.items);
        return clean;
    }

    async generate(history: any[], tools: any[]): Promise<{ text: string, toolCalls?: any[] }> {
        // Get WP settings from window
        const settings = (window as any).angieLocalSettings;
        if (!settings || !settings.root || !settings.nonce) {
            throw new Error("WordPress settings missing. Cannot connect to backend.");
        }

        const contents = history.map(msg => {
            if (msg.role === 'tool') {
                return {
                    role: 'function',
                    parts: [{
                        functionResponse: {
                            name: msg.name,
                            response: { name: msg.name, content: msg.content }
                        }
                    }]
                };
            }
            if (msg.role === 'model' && msg.toolCalls) {
                return {
                    role: 'model',
                    parts: msg.toolCalls.map((tc: any) => ({
                        functionCall: { name: tc.name, args: tc.args }
                    }))
                };
            }
            return {
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            };
        });

        const toolsPayload = tools.length > 0 ? [{
            function_declarations: tools.map(t => ({
                name: t.name,
                description: t.description,
                parameters: this.cleanSchema(t.inputSchema)
            }))
        }] : undefined;

        // Call our local PHP Proxy
        // URL: /wp-json/angie-demo/v1/generate
        // Ensure root has trailing slash
        const root = settings.root.endsWith('/') ? settings.root : settings.root + '/';
        const url = `${root}angie-demo/v1/generate`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': settings.nonce
            },
            body: JSON.stringify({ contents, tools: toolsPayload })
        });

        let data;
        try {
            data = await response.json();
        } catch (e) {
             throw new Error("Failed to parse response from server. Check PHP logs.");
        }

        // Handle WordPress specific errors
        if (data.code && data.message && data.data?.status) {
            throw new Error(`WordPress Error: ${data.message}`);
        }

        // Handle Gemini specific errors forwarded by PHP
        if (data.error) {
            console.error("Gemini API Error:", JSON.stringify(data.error, null, 2));
            throw new Error(data.error.message || "Unknown API Error");
        }

        const candidate = data.candidates?.[0]?.content;
        const parts = candidate?.parts || [];

        const textPart = parts.find((p: any) => p.text);
        const fcParts = parts.filter((p: any) => p.functionCall);

        return {
            text: textPart ? textPart.text : '',
            toolCalls: fcParts.map((p: any) => ({
                name: p.functionCall.name,
                args: p.functionCall.args
            }))
        };
    }
}
