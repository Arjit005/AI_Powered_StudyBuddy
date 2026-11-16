import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Sparkles, Send, Bot, RotateCcw, AlertCircle, Headphones } from 'lucide-react';
import SpotlightCard from '../components/ui/SpotlightCard';

const Voice = () => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [browserSupported, setBrowserSupported] = useState(true);
    const recognitionRef = useRef(null);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setBrowserSupported(false);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            let fullTranscript = '';
            for (let i = 0; i < event.results.length; i++) {
                fullTranscript += event.results[i][0].transcript;
            }
            setTranscript(fullTranscript);
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
            if (event.error === 'not-allowed') {
                setError('Microphone access was denied. Please allow microphone permissions in your browser.');
            } else if (event.error === 'no-speech') {
                setError('No speech detected. Please speak closer to your microphone.');
            } else if (event.error === 'network') {
                setError('Speech recognition network error. Please verify your connection.');
            } else {
                setError(`Microphone error (${event.error}). Please try again.`);
            }
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    const toggleListening = () => {
        if (!browserSupported) return;

        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            setTranscript('');
            try {
                recognitionRef.current?.start();
                setIsListening(true);
            } catch (err) {
                console.error('Failed to start speech recognition:', err);
            }
        }
    };

    const handleAskAi = async () => {
        if (!transcript.trim() || isLoading) return;

        // Stop listening while generating
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        }

        setIsLoading(true);
        setAiResponse('');

        try {
            const token = localStorage.getItem('auth_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers,
                body: JSON.stringify({ message: transcript }),
            });

            if (!res.ok) throw new Error('AI consultation failed');
            const data = await res.json();
            const reply = data.response || 'No response generated.';
            setAiResponse(reply);

            // Auto-read response if speech synthesis available
            if ('speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined') {
                window.speechSynthesis.cancel();
                const cleanText = reply.replace(/[#*`_\[\]()]/g, '');
                const utterance = new SpeechSynthesisUtterance(cleanText);
                utterance.rate = 1.0;
                utterance.onend = () => setIsSpeaking(false);
                utterance.onerror = () => setIsSpeaking(false);
                window.speechSynthesis.speak(utterance);
                setIsSpeaking(true);
            }
        } catch (err) {
            console.error("Voice response error:", err);
            setAiResponse('⚠️ Unable to connect to the AI tutor right now. Please check your connection and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSpeechPlayback = () => {
        if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance === 'undefined' || !aiResponse) return;

        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        } else {
            const cleanText = aiResponse.replace(/[#*`_\[\]()]/g, '');
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.rate = 1.0;
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = () => setIsSpeaking(false);
            window.speechSynthesis.speak(utterance);
            setIsSpeaking(true);
        }
    };

    return (
        <div className="py-12 min-h-screen bg-[#07090E] text-slate-100">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mb-4 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                        <Headphones className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-3">
                        Voice Study & Recitation Room
                    </h1>
                    <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
                        Speak naturally to discuss concepts, practice oral exam explanations, and listen to Socratic feedback.
                    </p>
                </div>

                {/* Browser Compatibility Notice */}
                {!browserSupported && (
                    <div className="mb-6 p-4 rounded-2xl bg-amber-950/40 border border-amber-800/60 flex items-start gap-3 text-amber-300 text-xs font-mono">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                        <div>
                            <b>Browser Audio Notice:</b> Live microphone speech recognition is optimized for Chrome, Edge, and Chromium browsers. On Firefox or Safari, you can type your query in the prompt box below to receive oral audio synthesis answers!
                        </div>
                    </div>
                )}

                {/* Central Interactive Voice Hub */}
                <SpotlightCard className="p-8 sm:p-12 text-center mb-8 border border-slate-800 shadow-2xl">
                    {/* Visualizer Pulsing Ring */}
                    <div className="relative w-36 h-36 mx-auto mb-8 flex items-center justify-center">
                        {isListening && (
                            <>
                                <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping duration-1000" />
                                <div className="absolute -inset-4 rounded-full bg-cyan-500/10 animate-pulse duration-700" />
                            </>
                        )}
                        <button
                            onClick={toggleListening}
                            disabled={!browserSupported}
                            className={`relative z-10 w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl active:scale-95 ${
                                isListening
                                    ? 'bg-rose-500 text-white shadow-rose-500/40'
                                    : 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 hover:brightness-110 shadow-emerald-500/30'
                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                            title={isListening ? 'Click to pause mic' : 'Click to start speaking'}
                        >
                            {isListening ? (
                                <MicOff className="w-10 h-10 animate-bounce" />
                            ) : (
                                <Mic className="w-10 h-10" />
                            )}
                        </button>
                    </div>

                    <div className="mb-6">
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold border ${
                            isListening
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                            <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                            {isListening ? 'Listening (Speak your question)...' : 'Microphone Inactive — Tap to Speak'}
                        </span>
                    </div>

                    {/* Speech Transcript Area */}
                    <div className="max-w-2xl mx-auto text-left mb-6">
                        <label className="block text-xs font-mono text-slate-400 mb-2">
                            Transcribed Speech / Recitation Input:
                        </label>
                        <div className="relative">
                            <textarea
                                value={transcript}
                                onChange={(e) => setTranscript(e.target.value)}
                                placeholder="Your spoken words will transcribe here automatically, or you can type here..."
                                rows={3}
                                className="w-full p-4 rounded-2xl glass-input text-sm font-sans placeholder:text-slate-600 focus:border-emerald-500/60"
                            />
                            {transcript && (
                                <button
                                    onClick={() => setTranscript('')}
                                    className="absolute top-3 right-3 text-xs font-mono text-slate-500 hover:text-rose-400"
                                    title="Clear transcript"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleAskAi}
                        disabled={isLoading || !transcript.trim()}
                        className="px-8 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 hover:brightness-110 active:scale-95 transition-all shadow-[0_0_25px_rgba(16,185,129,0.3)] disabled:opacity-40 inline-flex items-center gap-2"
                    >
                        {isLoading ? (
                            <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Sparkles className="w-4 h-4" />
                        )}
                        <span>Ask AI Tutor &amp; Listen</span>
                    </button>
                </SpotlightCard>

                {/* AI Spoken Response Card */}
                {aiResponse && (
                    <SpotlightCard className="p-6 sm:p-8 border border-emerald-500/30 shadow-2xl">
                        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/5">
                            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                                <Bot className="w-4 h-4" />
                                <span>AI Oral Response</span>
                            </div>
                            <button
                                onClick={toggleSpeechPlayback}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-mono text-slate-300 hover:text-white transition-all"
                            >
                                {isSpeaking ? (
                                    <>
                                        <VolumeX className="w-4 h-4 text-emerald-400 animate-pulse" />
                                        <span>Stop Audio</span>
                                    </>
                                ) : (
                                    <>
                                        <Volume2 className="w-4 h-4 text-emerald-400" />
                                        <span>Listen Again</span>
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="text-slate-200 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-sans">
                            {aiResponse}
                        </div>
                    </SpotlightCard>
                )}
            </div>
        </div>
    );
};

export default Voice;
