/**
 * Gemini Client
 * Handles communication with Google's Generative Language API.
 * Includes schema sanitization to prevent "Unknown name" errors.
 */
export class GeminiClient {
    private apiKey: string;
    private baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

    constructor(key: string) {
        this.apiKey = key;
    }

    setKey(key: string) {
        this.apiKey = key;
    }

    /**
     * Recursive function to strip fields that Gemini API rejects
     * ($schema, additionalProperties, etc.)
     */
    private cleanSchema(schema: any): any {
        if (typeof schema !== 'object' || schema === null) {
            return schema;
        }

        // Create a shallow copy
        const clean = { ...schema };

        // Remove forbidden keys
        delete clean.$schema;
        delete clean.additionalProperties;

        // Specific fix for Zod 'optional' logic which sometimes adds 'anyOf' with null
        // Gemini prefers 'nullable: true' or just standard types, but usually standard sanitization is enough.

        // Recurse into 'properties'
        if (clean.properties) {
            for (const key in clean.properties) {
                clean.properties[key] = this.cleanSchema(clean.properties[key]);
            }
        }

        // Recurse into 'items' (for arrays)
        if (clean.items) {
            clean.items = this.cleanSchema(clean.items);
        }

        return clean;
    }

    async generate(history: any[], tools: any[]): Promise<{ text: string, toolCalls?: any[] }> {
        if (!this.apiKey) {
            throw new Error("API Key is missing. Check Settings.");
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

        // Map MCP Tools to Gemini Schema AND sanitize them
        const toolsPayload = tools.length > 0 ? [{
            function_declarations: tools.map(t => ({
                name: t.name,
                description: t.description,
                parameters: this.cleanSchema(t.inputSchema) // <--- SANITIZATION APPLIED HERE
            }))
        }] : undefined;

        const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents, tools: toolsPayload })
        });

        const data = await response.json();

        if (data.error) {
            // Log the full error to console for easier debugging if it happens again
            console.error("Gemini API Error:", JSON.stringify(data.error, null, 2));
            throw new Error(data.error.message);
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
