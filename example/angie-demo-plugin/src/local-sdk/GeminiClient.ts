export class GeminiClient {
    private apiKey: string;
    private baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

    constructor(key: string) {
        this.apiKey = key;
    }

    setKey(key: string) {
        this.apiKey = key;
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

        const toolsPayload = tools.length > 0 ? [{
            function_declarations: tools.map(t => ({
                name: t.name,
                description: t.description,
                parameters: t.inputSchema
            }))
        }] : undefined;

        const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents, tools: toolsPayload })
        });

        const data = await response.json();

        if (data.error) throw new Error(data.error.message);

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
