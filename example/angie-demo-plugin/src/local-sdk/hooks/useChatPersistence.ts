/**
 * OMISSION FIX: Gemini Suggestion - "Persistence"
 * Ensures the chat history survives page reloads using localStorage.
 */
import { useState, useEffect } from 'react';
import { Message } from '../GeminiClient';

export function useChatPersistence(key: string, initialValue: Message[]) {
    // 1. Initialize state from localStorage if available
    const [messages, setMessages] = useState<Message[]>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.warn("Angie: Failed to load history", error);
            return initialValue;
        }
    });

    // 2. Sync changes to localStorage
    useEffect(() => {
        try {
            window.localStorage.setItem(key, JSON.stringify(messages));
        } catch (error) {
            console.warn("Angie: Failed to save history", error);
        }
    }, [key, messages]);

    // 3. Add a "Clear Memory" function
    const clearMemory = () => {
        try {
            window.localStorage.removeItem(key);
            setMessages(initialValue);
        } catch (error) {
            console.error(error);
        }
    };

    return { messages, setMessages, clearMemory };
}
