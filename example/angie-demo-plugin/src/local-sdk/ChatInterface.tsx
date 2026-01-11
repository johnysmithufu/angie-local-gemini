import React, { useState, useEffect, useRef } from 'react';
import { LocalHostController } from './LocalHostController';
import { Send, X, Settings, Sparkles, Wrench, RefreshCw } from 'lucide-react';
import Markdown from 'markdown-to-jsx';

const COLORS = {
    primary: '#2271b1',
    bg: '#ffffff',
    userBg: '#f0f0f1',
    border: '#dcdcde'
};

export const ChatInterface = ({ controller }: { controller: LocalHostController }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);

    // Settings State
    const settings = (window as any).angieLocalSettings;
    const [hasKey, setHasKey] = useState(settings?.hasApiKey || false);
    const [showSettings, setShowSettings] = useState(!settings?.hasApiKey);
    const [apiKeyInput, setApiKeyInput] = useState("");

    // Model State
    const [models, setModels] = useState<string[]>([]);
    const [selectedModel, setSelectedModel] = useState(localStorage.getItem('angie_model') || 'gemini-2.5-flash');
    const [loadingModels, setLoadingModels] = useState(false);

    const msgEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

    // Load models when settings open
    useEffect(() => {
        if (showSettings && hasKey) {
            fetchModels();
        }
    }, [showSettings, hasKey]);

    const fetchModels = async () => {
        setLoadingModels(true);
        try {
            const res = await fetch(settings.root + 'angie-demo/v1/models', {
                headers: { 'X-WP-Nonce': settings.nonce }
            });
            const data = await res.json();
            if (data.models) {
                // Prioritize flash models, simpler sort
                const list = data.models.map((m: any) => m.name).sort();
                setModels(list);
            }
        } catch (e) {
            console.error("Failed to fetch models");
        } finally {
            setLoadingModels(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || isTyping) return;
        const userText = input;
        setInput("");
        setIsTyping(true);
        setMessages(prev => [...prev, { role: 'user', content: userText }]);

        try {
            // Pass the selected model
            const updatedHistory = await controller.processMessage(messages, userText, selectedModel);
            setMessages(updatedHistory);
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'model', content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]);
        } finally {
            setIsTyping(false);
        }
    };

    const saveKey = async () => {
        try {
            const res = await fetch(settings.root + 'angie-demo/v1/save-key', {
                method: 'POST',
                headers: {
                    'X-WP-Nonce': settings.nonce,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ key: apiKeyInput })
            });

            if (!res.ok) throw new Error("Failed to save key");

            setHasKey(true);
            setApiKeyInput("");
            fetchModels(); // Fetch models immediately after saving key
        } catch (e) {
            alert("Failed to save API Key");
        }
    };

    const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSelectedModel(val);
        localStorage.setItem('angie_model', val);
    };

    if (!isOpen) {
        return (
            <button onClick={() => setIsOpen(true)} style={{
                position: 'fixed', bottom: 20, right: 20, width: 60, height: 60,
                borderRadius: '50%', background: COLORS.primary, color: 'white', border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)', cursor: 'pointer', zIndex: 100000,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <Sparkles size={28} />
            </button>
        );
    }

    return (
        <div style={{
            position: 'fixed', bottom: 20, right: 20, width: 380, height: 600,
            background: COLORS.bg, borderRadius: 12, boxShadow: '0 5px 30px rgba(0,0,0,0.2)',
            display: 'flex', flexDirection: 'column', zIndex: 100000, overflow: 'hidden',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            border: `1px solid ${COLORS.border}`
        }}>
            <div style={{ padding: '16px', background: COLORS.primary, color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{display:'flex', alignItems:'center', gap: 8, fontWeight: 600}}>
                    <Sparkles size={20} /> Angie Local
                </div>
                <div style={{display:'flex', gap: 12}}>
                    <Settings size={20} style={{cursor:'pointer', opacity: 0.9}} onClick={() => setShowSettings(!showSettings)} />
                    <X size={20} style={{cursor:'pointer', opacity: 0.9}} onClick={() => setIsOpen(false)} />
                </div>
            </div>

            {showSettings && (
                <div style={{padding: 20, background: '#f8f9fa', borderBottom: `1px solid ${COLORS.border}`, maxHeight: '50%', overflowY: 'auto'}}>
                    <label style={{display:'block', marginBottom: 5, fontSize: 12, fontWeight: 600}}>Google Gemini API Key</label>
                    <div style={{display:'flex', gap: 5, marginBottom: 15}}>
                        <input
                            type="password"
                            value={apiKeyInput}
                            onChange={e => setApiKeyInput(e.target.value)}
                            placeholder={hasKey ? "Key is set" : "AIzaSy..."}
                            style={{width: '100%', padding: '8px', border: '1px solid #8c8f94', borderRadius: 4, flex: 1}}
                        />
                        <button onClick={saveKey} style={{background: COLORS.primary, color:'white', border:'none', padding:'0 12px', borderRadius: 4, cursor:'pointer'}}>Save</button>
                    </div>

                    {hasKey && (
                        <>
                            <div style={{display:'flex', justifyContent:'space-between', marginBottom: 5}}>
                                <label style={{fontSize: 12, fontWeight: 600}}>AI Model</label>
                                <RefreshCw size={12} style={{cursor:'pointer', opacity:0.7}} onClick={fetchModels}/>
                            </div>
                            <select
                                value={selectedModel}
                                onChange={handleModelChange}
                                disabled={loadingModels}
                                style={{width: '100%', padding: '8px', border: '1px solid #8c8f94', borderRadius: 4}}
                            >
                                <option value="gemini-2.5-flash">gemini-2.5-flash (Default)</option>
                                {models.filter(m => m !== 'gemini-2.5-flash').map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                            <p style={{fontSize: 11, color:'#666', marginTop: 5}}>
                                Note: Some models may require billing enabled or have different rate limits.
                            </p>
                        </>
                    )}
                </div>
            )}

            <div style={{flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, background:'#fff'}}>
                {messages.length === 0 && !showSettings && (
                    <div style={{textAlign:'center', color:'#888', marginTop: 80}}>
                        <Sparkles size={48} color="#ddd" />
                        <p>How can I help you?</p>
                        <span style={{fontSize: 11, background: '#f0f0f1', padding: '2px 6px', borderRadius: 4}}>Model: {selectedModel}</span>
                    </div>
                )}
                {messages.map((m, i) => (
                    <div key={i} style={{alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', fontSize: 14}}>
                        {m.role === 'tool' ? (
                            <div style={{fontSize: 11, color: '#646970', background: '#f6f7f7', padding: '6px', borderRadius: 4, border: '1px solid #dcdcde'}}>
                                <Wrench size={12} style={{verticalAlign:'text-bottom'}}/> Ran: <strong>{m.name}</strong>
                            </div>
                        ) : m.toolCalls ? (
                             <div style={{fontSize: 11, color: '#646970', fontStyle:'italic'}}>Running tools...</div>
                        ) : (
                            <div style={{
                                background: m.role === 'user' ? COLORS.primary : COLORS.userBg,
                                color: m.role === 'user' ? 'white' : '#1d2327',
                                padding: '10px 14px', borderRadius: 12,
                                borderBottomRightRadius: m.role === 'user' ? 2 : 12,
                                borderBottomLeftRadius: m.role !== 'user' ? 2 : 12,
                            }}>
                                <Markdown>{m.content}</Markdown>
                            </div>
                        )}
                    </div>
                ))}
                {isTyping && <div style={{fontSize: 12, color: '#888', marginLeft: 10}}>Thinking...</div>}
                <div ref={msgEndRef} />
            </div>

            <div style={{padding: 16, borderTop: `1px solid ${COLORS.border}`, display: 'flex', gap: 10, background: '#fff'}}>
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder="Ask me anything..."
                    style={{flex: 1, padding: '10px 12px', border: '1px solid #8c8f94', borderRadius: 20, outline: 'none', fontSize: 14}}
                />
                <button onClick={handleSend} style={{background: 'none', border: 'none', color: COLORS.primary, cursor: 'pointer'}}>
                    <Send size={24} />
                </button>
            </div>
        </div>
    );
};
