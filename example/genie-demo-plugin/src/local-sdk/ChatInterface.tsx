import React, { useState, useEffect, useRef } from 'react';
import { GeminiClient, Message } from './GeminiClient';
import { MCPOrchestrator } from '../core/MCPOrchestrator';
import { useChatPersistence } from './hooks/useChatPersistence';
import { ErrorBoundary } from './ErrorBoundary';
import html2canvas from 'html2canvas';

// Icons
import { Mic, MicOff, Camera, Send, Loader, Settings, Save, X, Trash2, ChevronDown, Minus, MessageCircle } from 'lucide-react';

interface ChatInterfaceProps {
    apiBaseUrl: string;
    nonce: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ apiBaseUrl, nonce }) => {
    // State
    const [apiKey, setApiKey] = useState<string>('');
    const [isConfigured, setIsConfigured] = useState<boolean>(false);
    const [showSettings, setShowSettings] = useState<boolean>(false);
    const [isMinimized, setIsMinimized] = useState<boolean>(false);

    // Chat State
    const { messages, setMessages, clearMemory } = useChatPersistence('genie_v2_history', []);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);

    // Model Selection State
    const [models, setModels] = useState<any[]>([]);
    const [selectedModel, setSelectedModel] = useState<string>(() => {
        return localStorage.getItem('genie_v2_selected_model') || 'gemini-2.5-flash-lite';
    });

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
            const res = await fetch(`${apiBaseUrl}/genie/v1/config/check`, {
                headers: { 'X-WP-Nonce': nonce }
            });
            const data = await res.json();
            if (data.has_key) {
                setIsConfigured(true);
                // Initialize Client with placeholder (server handles real key)
                clientRef.current = new GeminiClient('server_side_key', apiBaseUrl, nonce);
                fetchModels();
            } else {
                setShowSettings(true);
            }
        } catch (e) {
            console.error("Config check failed", e);
        }
    };

    const fetchModels = async () => {
        try {
            const res = await fetch(`${apiBaseUrl}/genie/v1/models`, {
                headers: { 'X-WP-Nonce': nonce }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.models) {
                    setModels(data.models);
                }
            }
        } catch (e) {
            console.error("Failed to fetch models", e);
        }
    };

    const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSelectedModel(val);
        localStorage.setItem('genie_v2_selected_model', val);
    };

    // 2. Save Settings Handler - IMPROVED ERROR HANDLING
    const handleSaveSettings = async () => {
        if (!apiKey.trim()) {
            alert("Please enter an API Key");
            return;
        }

        try {
            const res = await fetch(`${apiBaseUrl}/genie/v1/config/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
                body: JSON.stringify({ api_key: apiKey })
            });

            if (res.ok) {
                setIsConfigured(true);
                setShowSettings(false);
                clientRef.current = new GeminiClient('server_side_key', apiBaseUrl, nonce);
                fetchModels();
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
            const canvas = await html2canvas(document.body, { ignoreElements: (el) => el.classList.contains('genie-floating-window') });
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
                },
                selectedModel
            );
        } catch (error) {
            setMessages(prev => [...prev, { role: 'system', content: `Error: ${error}` }]);
            setIsStreaming(false);
        }
    };

    // 4. Render Settings Mode
    if (showSettings || !isConfigured) {
        return (
            <div className={`genie-floating-window genie-settings-mode ${isMinimized ? 'minimized' : ''}`}>
                <div className="genie-settings-container">
                    <h2 className="genie-settings-title">
                        <Settings size={20} /> Setup Genie
                    </h2>
                    <p className="genie-settings-desc">
                        Enter your Google Gemini API Key to enable the assistant.
                    </p>
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="genie-settings-input"
                    />
                    <button
                        onClick={handleSaveSettings}
                        className="genie-save-btn"
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
            {isMinimized && (
                <div className="genie-fab" onClick={() => setIsMinimized(false)} title="Open Genie">
                    <MessageCircle size={28} />
                </div>
            )}
            <div className={`genie-floating-window ${isMinimized ? 'minimized' : ''}`}>
                {/* Header */}
                <div className="genie-header">
                    <div className="genie-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="genie-status-dot"></span>
                        <h3>Genie V2</h3>
                        {models.length > 0 && (
                            <div className="genie-model-selector" style={{ position: 'relative', marginLeft: '8px' }}>
                                <select
                                    value={selectedModel}
                                    onChange={handleModelChange}
                                    style={{
                                        appearance: 'none',
                                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        borderRadius: '4px',
                                        color: '#fff',
                                        padding: '4px 24px 4px 8px',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        outline: 'none'
                                    }}
                                >
                                    {models.map((model: any) => {
                                        // Optional: filter out models that don't support generateContent
                                        const isGenerateSupported = model.supportedGenerationMethods?.includes('generateContent');
                                        if (!isGenerateSupported) return null;

                                        // The API returns models in the format "models/gemini-2.5-flash"
                                        const modelId = model.name.replace('models/', '');
                                        return (
                                            <option key={model.name} value={modelId} style={{ color: '#000' }}>
                                                {model.displayName || modelId}
                                            </option>
                                        );
                                    })}
                                </select>
                                <ChevronDown size={14} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#fff' }} />
                            </div>
                        )}
                    </div>
                    <div className="genie-header-actions">
                        <button onClick={clearMemory} title="Clear Memory" className="genie-icon-btn"><Trash2 size={16}/></button>
                        <button onClick={() => setShowSettings(true)} className="genie-icon-btn"><Settings size={16}/></button>
                        <button onClick={() => setIsMinimized(true)} title="Minimize" className="genie-icon-btn"><Minus size={16}/></button>
                    </div>
                </div>

                {/* Messages */}
                <div className="genie-messages">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`genie-message-row ${msg.role}`}>
                            <div className={`genie-bubble ${msg.role}`}>
                                {msg.images && <div className="mb-2 text-xs opacity-75">[Image Attached]</div>}
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                            </div>
                        </div>
                    ))}
                    {isStreaming && (
                        <div className="genie-message-row model">
                            <span className="text-xs text-gray-400">Thinking...</span>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Screenshot Preview */}
                {capturedImage && (
                    <div className="genie-image-preview">
                        <span>Image ready</span>
                        <button onClick={() => setCapturedImage(null)} style={{color:'#ef4444', border:'none', background:'none', cursor:'pointer'}}><X size={14}/></button>
                    </div>
                )}

                {/* Input */}
                <form onSubmit={handleSubmit} className="genie-input-area">
                    <div className="genie-input-wrapper">
                        <button type="button" onClick={takeScreenshot} className="genie-action-btn" title="Screenshot"><Camera size={20} /></button>
                        <button type="button" onClick={toggleVoice} className={`genie-action-btn ${isListening ? 'active' : ''}`} title="Voice"><Mic size={20} /></button>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask Genie..."
                            className="genie-text-input"
                        />
                        <button type="submit" disabled={isStreaming} className="genie-action-btn genie-send-btn">
                            {isStreaming ? <Loader size={20} className="genie-loading-spinner" /> : <Send size={20} />}
                        </button>
                    </div>
                </form>
            </div>
        </ErrorBoundary>
    );
};
