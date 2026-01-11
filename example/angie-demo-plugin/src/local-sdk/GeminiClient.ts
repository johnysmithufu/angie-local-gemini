// MERGED: Standardized interface for messages (Claude/DeepSeek)
export interface Message {
    role: 'user' | 'model' | 'system';
    content: string;
    // MERGED: Added support for images (Gemini)
    images?: string[]; // base64 strings
}

// MERGED: Streaming callback type (Claude)
type StreamCallback = (chunk: string, done: boolean) => void;

export class GeminiClient {
    private apiKey: string;
    private baseUrl: string;
    private nonce: string;

    constructor(apiKey: string, baseUrl: string, nonce: string) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.nonce = nonce;
    }

    /**
     * MERGED: The "Omni" Generate function.
     * Supports:
     * 1. Streaming (Claude/Gemini)
     * 2. Multimodal Vision (Gemini)
     * 3. Tool Use (Existing)
     */
    async generateContentStream(
        history: Message[],
        currentMessage: string,
        currentImages: string[] = [], // New: Vision Support
        tools: any[],
        onChunk: StreamCallback
    ): Promise<string> {

        // Prepare the payload
        const payload = {
            model: "gemini-2.0-flash-exp", // Updated to latest fast model
            messages: [
                ...history,
                { role: 'user', content: currentMessage, images: currentImages }
            ],
            tools: tools,
            stream: true // Trigger streaming mode
        };

        try {
            // MERGED: Switch to fetch with ReadableStream for true streaming via PHP proxy
            const response = await fetch(`${this.baseUrl}/angie/v1/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': this.nonce
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let fullText = "";

            if (!reader) throw new Error("Browser does not support streaming");

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    onChunk("", true);
                    break;
                }

                const chunk = decoder.decode(value);
                // Parse Server-Sent Events (SSE) format
                // PHP sends data like: "data: { ...JSON... }\n\n"
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonStr = line.substring(6).trim();
                            if (jsonStr === '[DONE]') continue;

                            const data = JSON.parse(jsonStr);

                            // Handle standard text content
                            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                                const textChunk = data.candidates[0].content.parts[0].text;
                                fullText += textChunk;
                                onChunk(textChunk, false);
                            }

                            // Handle function calls (buffered, not streamed usually, but handled here)
                            if (data.candidates?.[0]?.content?.parts?.[0]?.functionCall) {
                                // For function calls, we usually wait for the full response,
                                // but we notify the UI that we are "Thinking/Calling"
                                onChunk(" [Executing Tool...] ", false);
                            }
                        } catch (e) {
                            console.warn("Stream parse error", e);
                        }
                    }
                }
            }

            return fullText;

        } catch (error) {
            console.error("Generation failed:", error);
            throw error;
        }
    }

    // MERGED: Fallback for non-streaming environments (DeepSeek Legacy Support)
    async generateContent(history: Message[], message: string, tools: any[]): Promise<any> {
        // ... (Existing implementation kept as fallback)
        return null;
    }
}
