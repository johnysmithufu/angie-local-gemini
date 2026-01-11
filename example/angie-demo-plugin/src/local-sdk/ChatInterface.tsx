import React, { useState, useEffect, useRef } from 'react';
import { GeminiClient, Message } from './GeminiClient';
import { MCPOrchestrator } from '../core/MCPOrchestrator';
import { useChatPersistence } from './hooks/useChatPersistence';
import { ErrorBoundary } from './ErrorBoundary';
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

    // 2. Save Settings Handler - IMPROVED ERROR HANDLING
    const handleSaveSettings = async () => {
        if (!apiKey.trim()) {
            alert("Please enter an API Key");
            return;
        }

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
                // Parse error message if possible
                const errData = await res.json().catch(() => ({}));
                console.error("Save Error:", errData);
                alert(`Failed to save API key. Server responded with: ${res.status} ${errData.message || res.statusText}`);
            }
        } catch (e) {
            console.error(e);
            alert("Network error saving settings. Check console for details.");
        }
    };

    // 3. Standard Chat Handlers
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
            const canvas = await html2canvas(document.body, { ignoreElements: (el) => el.classList.contains('angie-floating-window') });
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

        setMessages(prev => [...prev, { role: 'model', content: '' }]);

        try {
            const tools = orchestratorRef.current.getRegistry();
            let fullResponse = "";

            await clientRef.current.generateContentStream(
                messages,
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

    // 4. Render Settings Mode
    if (showSettings || !isConfigured) {
        return (
            <div className="angie-floating-window angie-settings-mode">
                <div className="angie-settings-container">
                    <h2 className="angie-settings-title">
                        <Settings size={20} /> Setup Angie
                    </h2>
                    <p className="angie-settings-desc">
                        Enter your Google Gemini API Key to enable the assistant.
                    </p>
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="angie-settings-input"
                    />
                    <button
                        onClick={handleSaveSettings}
                        className="angie-save-btn"
                    >
                        <Save size={16} /> Save & Connect
                    </button>
                </div>
            </div>
        );
    }

    // 5. Render Chat Mode
    return (
        <ErrorBoundary>
            <div className="angie-floating-window">
                {/* Header */}
                <div className="angie-header">
                    <div className="angie-title">
                        <span className="angie-status-dot"></span>
                        <h3>Angie V2</h3>
                    </div>
                    <div className="angie-header-actions">
                        <button onClick={clearMemory} title="Clear Memory" className="angie-icon-btn"><Trash2 size={16}/></button>
                        <button onClick={() => setShowSettings(true)} className="angie-icon-btn"><Settings size={16}/></button>
                    </div>
                </div>

                {/* Messages */}
                <div className="angie-messages">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`angie-message-row ${msg.role}`}>
                            <div className={`angie-bubble ${msg.role}`}>
                                {msg.images && <div className="mb-2 text-xs opacity-75">[Image Attached]</div>}
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                            </div>
                        </div>
                    ))}
                    {isStreaming && (
                        <div className="angie-message-row model">
                            <span className="text-xs text-gray-400">Thinking...</span>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Screenshot Preview */}
                {capturedImage && (
                    <div className="angie-image-preview">
                        <span>Image ready</span>
                        <button onClick={() => setCapturedImage(null)} style={{color:'#ef4444', border:'none', background:'none', cursor:'pointer'}}><X size={14}/></button>
                    </div>
                )}

                {/* Input */}
                <form onSubmit={handleSubmit} className="angie-input-area">
                    <div className="angie-input-wrapper">
                        <button type="button" onClick={takeScreenshot} className="angie-action-btn" title="Screenshot"><Camera size={20} /></button>
                        <button type="button" onClick={toggleVoice} className={`angie-action-btn ${isListening ? 'active' : ''}`} title="Voice"><Mic size={20} /></button>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask Angie..."
                            className="angie-text-input"
                        />
                        <button type="submit" disabled={isStreaming} className="angie-action-btn angie-send-btn">
                            {isStreaming ? <Loader size={20} className="angie-loading-spinner" /> : <Send size={20} />}
                        </button>
                    </div>
                </form>
            </div>
        </ErrorBoundary>
    );
};
