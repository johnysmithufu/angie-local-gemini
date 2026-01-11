import React, { useState, useEffect, useRef } from 'react';
import { GeminiClient, Message } from './GeminiClient';
import { MCPOrchestrator } from '../core/MCPOrchestrator';
import { useChatPersistence } from './hooks/useChatPersistence'; // Use the hook we created
import { ErrorBoundary } from './ErrorBoundary'; // Use the safety boundary
import html2canvas from 'html2canvas';

// Icons
import { Mic, MicOff, Camera, Send, Loader, Settings, Save, X, Trash2 } from 'lucide-react';

interface ChatInterfaceProps {
    apiBaseUrl: string;
    nonce: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ apiBaseUrl, nonce }) => {
    // State
    const [apiKey, setApiKey] = useState<string>('');
    const [isConfigured, setIsConfigured] = useState<boolean>(false);
    const [showSettings, setShowSettings] = useState<boolean>(false);

    // Chat State
    const { messages, setMessages, clearMemory } = useChatPersistence('angie_v2_history', []);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);

    // Refs
    const orchestratorRef = useRef(new MCPOrchestrator());
    const clientRef = useRef<GeminiClient | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 1. Initial Check: Does the server have a key?
    useEffect(() => {
        checkConfiguration();
    }, []);

    const checkConfiguration = async () => {
        try {
            const res = await fetch(`${apiBaseUrl}/angie/v1/config/check`, {
                headers: { 'X-WP-Nonce': nonce }
            });
            const data = await res.json();
            if (data.has_key) {
                setIsConfigured(true);
                // Initialize Client with placeholder (server handles real key)
                clientRef.current = new GeminiClient('server_side_key', apiBaseUrl, nonce);
            } else {
                setShowSettings(true);
            }
        } catch (e) {
            console.error("Config check failed", e);
        }
    };

    // 2. Save Settings Handler
    const handleSaveSettings = async () => {
        try {
            const res = await fetch(`${apiBaseUrl}/angie/v1/config/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
                body: JSON.stringify({ api_key: apiKey })
            });

            if (res.ok) {
                setIsConfigured(true);
                setShowSettings(false);
                clientRef.current = new GeminiClient('server_side_key', apiBaseUrl, nonce);
                setMessages([{ role: 'model', content: "I'm ready! How can I help you with WordPress today?" }]);
            } else {
                alert("Failed to save API key.");
            }
        } catch (e) {
            alert("Error saving settings.");
        }
    };

    // 3. Standard Chat Handlers (Voice, Vision, Submit)
    const toggleVoice = () => {
        const recognition = (window as any).recognition;
        if (!recognition) return alert("Voice not supported.");
        isListening ? (recognition.stop(), setIsListening(false)) : (recognition.start(), setIsListening(true));
    };

    // Setup voice recognition
    useEffect(() => {
        if ('webkitSpeechRecognition' in window) {
            const recognition = new (window as any).webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setInput(prev => prev + " " + transcript);
                setIsListening(false);
            };

            (window as any).recognition = recognition;
        }
    }, []);

    const takeScreenshot = async () => {
        try {
            const canvas = await html2canvas(document.body, { ignoreElements: (el) => el.id === 'angie-chat-root' });
            setCapturedImage(canvas.toDataURL('image/jpeg', 0.6));
        } catch (e) { console.error(e); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!input.trim() && !capturedImage) || isStreaming || !clientRef.current) return;

        const userMsg: Message = { role: 'user', content: input, images: capturedImage ? [capturedImage.split(',')[1]] : undefined };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setCapturedImage(null);
        setIsStreaming(true);

        // Optimistic UI
        setMessages(prev => [...prev, { role: 'model', content: '' }]);

        try {
            const tools = orchestratorRef.current.getRegistry();
            let fullResponse = "";

            await clientRef.current.generateContentStream(
                messages, // Pass history correctly
                userMsg.content,
                userMsg.images,
                tools,
                (chunk, done) => {
                    if (done) { setIsStreaming(false); return; }
                    fullResponse += chunk;
                    setMessages(prev => {
                        const newMsgs = [...prev];
                        newMsgs[newMsgs.length - 1].content = fullResponse;
                        return newMsgs;
                    });
                }
            );
        } catch (error) {
            setMessages(prev => [...prev, { role: 'system', content: `Error: ${error}` }]);
            setIsStreaming(false);
        }
    };

    // 4. Render
    if (showSettings || !isConfigured) {
        return (
            <div id="angie-chat-root" className="fixed bottom-4 right-4 w-96 bg-white shadow-2xl rounded-xl border border-gray-200 z-50 p-6 font-sans">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Settings size={20} /> Setup Angie
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                    Enter your Google Gemini API Key to enable the assistant.
                </p>
                <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full p-2 border rounded mb-4"
                />
                <button
                    onClick={handleSaveSettings}
                    className="w-full bg-blue-600 text-white p-2 rounded flex justify-center items-center gap-2 hover:bg-blue-700"
                >
                    <Save size={16} /> Save & Connect
                </button>
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <div id="angie-chat-root" className="fixed bottom-4 right-4 w-96 h-[600px] bg-white shadow-2xl rounded-xl flex flex-col border border-gray-200 z-50 font-sans">
                {/* Header */}
                <div className="p-4 bg-slate-900 text-white rounded-t-xl flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                        <h3 className="font-bold">Angie V2</h3>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={clearMemory} title="Clear Memory" className="text-slate-400 hover:text-white"><Trash2 size={16}/></button>
                        <button onClick={() => setShowSettings(true)} className="text-slate-400 hover:text-white"><Settings size={16}/></button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-3 rounded-lg text-sm shadow-sm ${
                                msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-slate-800 border'
                            }`}>
                                {msg.images && <div className="mb-2 text-xs opacity-75">[Image Attached]</div>}
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                            </div>
                        </div>
                    ))}
                    {isStreaming && <div className="flex justify-start"><span className="bg-gray-200 text-gray-500 text-xs px-2 py-1 rounded-full animate-pulse">Thinking...</span></div>}
                    <div ref={messagesEndRef} />
                </div>

                {/* Screenshot Preview */}
                {capturedImage && (
                    <div className="p-2 bg-slate-100 border-t flex justify-between items-center px-4">
                        <span className="text-xs text-slate-500">Image ready</span>
                        <button onClick={() => setCapturedImage(null)} className="text-red-500 text-xs"><X size={14}/></button>
                    </div>
                )}

                {/* Input */}
                <form onSubmit={handleSubmit} className="p-4 border-t bg-white rounded-b-xl">
                    <div className="flex gap-2">
                        <button type="button" onClick={takeScreenshot} className="p-2 text-slate-500 hover:text-blue-600"><Camera size={20} /></button>
                        <button type="button" onClick={toggleVoice} className={`p-2 ${isListening ? 'text-red-500 animate-pulse' : 'text-slate-500'}`}><Mic size={20} /></button>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask Angie..."
                            className="flex-1 border-0 focus:ring-0 text-sm bg-transparent outline-none"
                        />
                        <button type="submit" disabled={isStreaming} className="p-2 text-blue-600 disabled:opacity-50">
                            {isStreaming ? <Loader size={20} className="animate-spin" /> : <Send size={20} />}
                        </button>
                    </div>
                </form>
            </div>
        </ErrorBoundary>
    );
};
