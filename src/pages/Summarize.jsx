import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  ArrowRight, 
  BookOpen, 
  Copy, 
  Check, 
  Sparkles, 
  ShieldCheck, 
  Volume2, 
  VolumeX, 
  Square, 
  Save, 
  Download 
} from 'lucide-react';

const Summarize = () => {
    const [topic, setTopic] = useState('');
    const [summaryTopic, setSummaryTopic] = useState('');
    const [summary, setSummary] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [saved, setSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const currentSummaryRef = useRef('');

    // Audio Speech Synthesis & timeout cleanup on unmount
    const summarizeGenRef = useRef(0);
    const utteranceGenRef = useRef(0);
    const copyTimeoutRef = useRef(null);
    const saveTimeoutRef = useRef(null);
    useEffect(() => {
        return () => {
            summarizeGenRef.current += 1;
            utteranceGenRef.current += 1;
            if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    const handleSummarize = async () => {
        if (!topic.trim() || isLoading) return;
        setIsLoading(true);
        setError('');
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
        setIsSpeaking(false);
        const thisGen = ++summarizeGenRef.current;
        try {
            const token = localStorage.getItem('auth_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch('/api/summarize', {
                method: 'POST',
                headers,
                body: JSON.stringify({ topic: topic.trim() })
            });

            if (thisGen !== summarizeGenRef.current) return;

            if (!response.ok) {
                let errDetail = 'Failed to synthesize summary';
                try {
                    const errData = await response.json();
                    errDetail = errData.detail || errDetail;
                } catch (_) {}
                throw new Error(errDetail);
            }

            const data = await response.json();
            if (thisGen !== summarizeGenRef.current) return;
            if (!data || typeof data.summary !== 'string' || !data.summary.trim()) {
                throw new Error('Received an invalid or empty summary from AI service.');
            }
            setSummary(data.summary);
            currentSummaryRef.current = data.summary;
            setSummaryTopic(topic.trim());
            setSaved(false);
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        } catch (err) {
            if (thisGen === summarizeGenRef.current) {
                setError(err.message || 'Error occurred while generating summary.');
            }
        } finally {
            if (thisGen === summarizeGenRef.current) {
                setIsLoading(false);
            }
        }
    };

    const handleCopy = async () => {
        if (!summary) return;
        try {
            await navigator.clipboard.writeText(summary);
            setCopied(true);
            if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
            copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
        } catch (copyErr) {
            console.error("Clipboard copy failed:", copyErr);
        }
    };

    // Text to Speech Toggle
    const handleToggleTTS = () => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window) || !summary) return;

        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        } else {
            const thisUtteranceGen = ++utteranceGenRef.current;
            const utterance = new SpeechSynthesisUtterance(summary);
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.onend = () => {
                if (thisUtteranceGen === utteranceGenRef.current) setIsSpeaking(false);
            };
            utterance.onerror = () => {
                if (thisUtteranceGen === utteranceGenRef.current) setIsSpeaking(false);
            };
            window.speechSynthesis.speak(utterance);
            setIsSpeaking(true);
        }
    };

    // Save to Library
    const handleSaveToLibrary = async () => {
        if (!summary || isSaving) return;
        const contentToSave = summary;
        const activeTopic = (summaryTopic && summaryTopic.trim()) ? summaryTopic.trim() : (topic && topic.trim()) ? topic.trim() : 'Study Summary';
        setIsSaving(true);
        try {
            const token = localStorage.getItem('auth_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch('/api/library', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    material_type: 'summary',
                    title: `Summary: ${activeTopic.slice(0, 45)}...`,
                    topic: activeTopic.slice(0, 40),
                    content_json: contentToSave,
                    tags: 'summary,takeaways,study_guide'
                })
            });
            if (res.ok) {
                if (currentSummaryRef.current === contentToSave) {
                    setSaved(true);
                    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                    saveTimeoutRef.current = setTimeout(() => setSaved(false), 3000);
                }
            } else {
                let errDetail = 'Failed to save summary to library.';
                try {
                    const errData = await res.json();
                    errDetail = errData.detail || errDetail;
                } catch (_) {}
                alert(errDetail);
            }
        } catch (err) {
            console.error("Save error:", err);
            alert("Network error saving summary: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    // Download as Markdown
    const handleDownloadMarkdown = () => {
        if (!summary) return;
        const activeTopic = summaryTopic || topic;
        const mdContent = `# Study Summary: ${activeTopic}\n\n*Generated by AI Study Buddy*\n\n---\n\n${summary}\n`;
        const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `summary_${activeTopic.slice(0, 20).toLowerCase().replace(/\s+/g, '_')}.md`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    return (
        <div className="py-12 min-h-screen">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500/20 border border-teal-500/30 text-teal-400 mb-3 shadow-[0_0_20px_rgba(20,184,166,0.25)]">
                        <FileText className="w-7 h-7" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
                        Smart Topic Summarizer
                    </h1>
                    <p className="text-slate-400 text-sm max-w-lg mx-auto">
                        Condense lengthy articles, technical papers, or syllabus chapters into structured core takeaways with audio speech synthesis.
                    </p>
                </div>

                {error && (
                    <div className="mb-6 max-w-md mx-auto p-4 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs">
                        {error}
                    </div>
                )}

                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Input Panel */}
                    <div className="glass-panel p-6 sm:p-8 rounded-3xl flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <label className="text-xs font-mono uppercase tracking-wider text-slate-400">
                                    Source Topic or Text
                                </label>
                                <span className="text-[11px] font-mono text-slate-500">{topic.length}/1000</span>
                            </div>
                            <textarea
                                className="w-full h-80 p-4 rounded-2xl glass-input text-sm font-sans placeholder:text-slate-600 resize-none leading-relaxed"
                                placeholder="Paste or type a topic, textbook chapter, or concept... (e.g. Photosynthesis, Supply & Demand, Newton's Laws, Machine Learning Basics)"
                                value={topic}
                                maxLength={1000}
                                onChange={(e) => setTopic(e.target.value)}
                            />
                        </div>

                        <button
                            onClick={handleSummarize}
                            disabled={isLoading || !topic.trim()}
                            className="mt-6 w-full py-3.5 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:brightness-110 active:scale-95 transition-all shadow-[0_0_25px_rgba(16,185,129,0.3)] disabled:opacity-40 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                                    <span>Synthesizing Summary...</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    <span>Generate Structured Summary</span>
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>

                    {/* Output Panel */}
                    <div className="glass-panel p-6 sm:p-8 rounded-3xl flex flex-col justify-between relative overflow-hidden">
                        <div>
                            <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/5">
                                <div className="flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-emerald-400" />
                                    <span className="text-xs font-mono uppercase tracking-wider text-slate-400 truncate max-w-[200px]">
                                        Executive Summary {summaryTopic ? `(${summaryTopic.slice(0, 25)})` : ''}
                                    </span>
                                </div>
                                {summary && (
                                    <div className="flex items-center gap-1.5">
                                        {/* Audio TTS Button */}
                                        <button
                                            onClick={handleToggleTTS}
                                            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 font-mono transition-colors ${
                                                isSpeaking 
                                                    ? 'bg-emerald-500/30 border-emerald-400 text-emerald-300 animate-pulse' 
                                                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-emerald-400'
                                            }`}
                                            title={isSpeaking ? "Stop Reading" : "Read Summary Aloud (TTS)"}
                                        >
                                            {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                                            <span>{isSpeaking ? 'Stop' : 'Listen'}</span>
                                        </button>

                                        {/* Save to Library */}
                                        <button
                                            onClick={handleSaveToLibrary}
                                            disabled={isSaving}
                                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 text-xs flex items-center gap-1 font-mono disabled:opacity-50"
                                            title="Save to Personal Study Library"
                                        >
                                            {saved ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
                                            <span>{isSaving ? 'Saving...' : (saved ? 'Saved!' : 'Save')}</span>
                                        </button>

                                        {/* Download Markdown */}
                                        <button
                                            onClick={handleDownloadMarkdown}
                                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 text-xs flex items-center gap-1 font-mono"
                                            title="Download Markdown File (.md)"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                        </button>

                                        {/* Copy Text */}
                                        <button
                                            onClick={handleCopy}
                                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 text-xs flex items-center gap-1 font-mono"
                                        >
                                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                            <span>{copied ? 'Copied' : 'Copy'}</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {summary ? (
                                <div className="h-80 overflow-y-auto pr-2 text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                                    {summary}
                                </div>
                            ) : (
                                <div className="h-80 flex flex-col items-center justify-center text-slate-600 text-center p-6 border-2 border-dashed border-slate-800 rounded-2xl">
                                    <BookOpen className="w-12 h-12 text-slate-700 mb-3" />
                                    <p className="text-sm font-mono text-slate-400">Your AI-generated summary will render here</p>
                                    <span className="text-xs text-slate-600 mt-1">Enter a topic on the left to begin synthesis</span>
                                </div>
                            )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-500">
                            <span className="flex items-center gap-1 text-emerald-500/80">
                                <ShieldCheck className="w-3 h-3 text-emerald-400" /> Grounded in Academic Facts
                            </span>
                            <span>Text-to-Speech & Export Enabled</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Summarize;
