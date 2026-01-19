
import React, { useState } from 'react';
import { Send, User, Bot, Trash2 } from 'lucide-react';

const ChatInterface = () => {
    const [messages, setMessages] = useState([
        { role: 'ai', content: 'Hello! I am your AI Study Buddy. How can I help you today?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const clearChat = async () => {
        if (!confirm("Are you sure you want to delete your chat history?")) return;
        try {
            await fetch('/api/chat', { method: 'DELETE' });
            setMessages([{ role: 'ai', content: 'Chat history cleared. How can I help you today?' }]);
        } catch (err) {
            console.error(err);
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: input }),
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();
            const aiMessage = { role: 'ai', content: data.response };
            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            console.error('Error:', error);
            setMessages(prev => [...prev, { role: 'ai', content: 'Sorry, I encountered an error. Please try again.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <section id="chat" className="py-16 bg-slate-50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col h-[600px] w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
                    <div className="bg-blue-600 p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white">
                            <Bot className="w-6 h-6" />
                            <span className="font-bold">AI Tutor Chat</span>
                        </div>
                        <button
                            onClick={clearChat}
                            className="p-2 bg-blue-500 hover:bg-blue-400 rounded-lg text-white transition-colors"
                            title="Clear Chat History"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.role === 'ai' && (
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                        <Bot className="w-5 h-5 text-blue-600" />
                                    </div>
                                )}
                                <div className={`max-w-[80%] p-4 rounded-2xl ${msg.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-br-none'
                                    : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm'
                                    }`}>
                                    <p className="leading-relaxed">{msg.content}</p>
                                </div>
                                {msg.role === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                                        <User className="w-5 h-5 text-slate-600" />
                                    </div>
                                )}
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-3 justify-start">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                    <Bot className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-bl-none shadow-sm">
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></div>
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-white border-t border-slate-200">
                        <form onSubmit={sendMessage} className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask me anything..."
                                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all text-slate-700"
                            />
                            <button
                                type="submit"
                                disabled={isLoading || !input.trim()}
                                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
                            >
                                <Send className="w-5 h-5" />
                                <span className="hidden sm:inline">Send</span>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ChatInterface;
