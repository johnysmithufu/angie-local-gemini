import React, { useState, useEffect, useRef } from 'react';
import { LocalHostController } from './LocalHostController';
import { Send, X, Settings, Sparkles, Wrench } from 'lucide-react';
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

    // Check if key exists on server, default to showing settings if false
    const settings = (window as any).angieLocalSettings;
    const [hasKey, setHasKey] = useState(settings?.hasApiKey || false);
    const [showSettings, setShowSettings] = useState(!settings?.hasApiKey);

    const [apiKeyInput, setApiKeyInput] = useState("");

    const msgEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

    const handleSend = async () => {
        if (!input.trim() || isTyping) return;
        const userText = input;
        setInput("");
        setIsTyping(true);
        setMessages(prev => [...prev, { role: 'user', content: userText }]);

        try {
            const updatedHistory = await controller.processMessage(messages, userText);
            setMessages(updatedHistory);
        } catch (error) {
            console.error(error);
        } finally {
            setIsTyping(false);
        }
    };

    const saveKey = async () => {
        // controller.updateApiKey(apiKeyInput); // Not needed for proxy, PHP handles it

        await fetch(settings.root + 'angie-demo/v1/save-key', {
            method: 'POST',
            headers: {
                'X-WP-Nonce': settings.nonce,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ key: apiKeyInput })
        });

        setHasKey(true);
        setShowSettings(false);
        setApiKeyInput(""); // Clear input for security
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
                <div style={{padding: 20, background: '#f8f9fa', borderBottom: `1px solid ${COLORS.border}`}}>
                    <label style={{display:'block', marginBottom: 5, fontSize: 12, fontWeight: 600}}>Google Gemini API Key</label>
                    <input
                        type="password"
                        value={apiKeyInput}
                        onChange={e => setApiKeyInput(e.target.value)}
                        placeholder={hasKey ? "Key is set (enter to update)" : "AIzaSy..."}
                        style={{width: '100%', padding: '8px', marginBottom: 12, border: '1px solid #8c8f94', borderRadius: 4}}
                    />
                    <button onClick={saveKey} style={{background: COLORS.primary, color:'white', border:'none', padding:'6px 16px', borderRadius: 4, cursor:'pointer'}}>Save</button>
                </div>
            )}

            <div style={{flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, background:'#fff'}}>
                {messages.length === 0 && !showSettings && (
                    <div style={{textAlign:'center', color:'#888', marginTop: 80}}>
                        <Sparkles size={48} color="#ddd" />
                        <p>How can I help you?</p>
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
