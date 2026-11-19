import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../config/apiClient';
import { 
  FileText, 
  ArrowRight, 
  BookOpen, 
  Copy, 
  Check, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Save, 
  Download 
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import MarkdownRenderer from '../components/MarkdownRenderer';

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
            const data = await apiRequest('/api/summarize', {
                method: 'POST',
                auth: 'none',
                json: { topic: topic.trim() }
            });

            if (thisGen !== summarizeGenRef.current) return;

            if (data && typeof data.summary === 'string' && data.summary.trim()) {
                setSummary(data.summary);
                setSummaryTopic(topic.trim());
                currentSummaryRef.current = data.summary;
            } else {
                setError('AI was unable to generate a summary for this topic. Please try another.');
            }
        } catch (err) {
            console.error("Summarizer error:", err);
            if (thisGen === summarizeGenRef.current) {
                setError(err.kind === 'http' 
                    ? (err.hasDetail ? err.message : 'Failed to generate topic summary.')
                    : 'Network error generating summary.');
            }
        } finally {
            if (thisGen === summarizeGenRef.current) {
                setIsLoading(false);
            }
        }
    };

    // Text-to-Speech (TTS)
    const handleToggleTTS = () => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
            alert("Speech synthesis is not supported in this browser.");
            return;
        }

        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            return;
        }

        if (!summary) return;
        window.speechSynthesis.cancel();
        const thisUtteranceGen = ++utteranceGenRef.current;

        // Strip markdown asterisks and hash symbols for clean audio reading
        const plainText = summary
            .replace(/[#*`_~]/g, '')
            .replace(/\[\d+\]/g, '')
            .trim();

        const utterance = new SpeechSynthesisUtterance(plainText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.lang = 'en-US';

        utterance.onstart = () => {
            if (thisUtteranceGen === utteranceGenRef.current) setIsSpeaking(true);
        };
        utterance.onend = () => {
            if (thisUtteranceGen === utteranceGenRef.current) setIsSpeaking(false);
        };
        utterance.onerror = (e) => {
            console.error("TTS Speech Error:", e);
            if (thisUtteranceGen === utteranceGenRef.current) setIsSpeaking(false);
        };

        window.speechSynthesis.speak(utterance);
    };

    // Copy to clipboard
    const handleCopy = () => {
        if (!summary) return;
        navigator.clipboard.writeText(summary);
        setCopied(true);
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    };

    // Save to library
    const handleSaveToLibrary = async () => {
        if (!summary || isSaving) return;
        const activeTopic = summaryTopic || topic;
        const contentToSave = summary;
        setIsSaving(true);
        try {
            await apiRequest('/api/library', {
                method: 'POST',
                auth: 'required',
                responseType: 'none',
                json: {
                    material_type: 'summary',
                    title: `Summary: ${activeTopic.slice(0, 45)}...`,
                    topic: activeTopic.slice(0, 40),
                    content_json: contentToSave,
                    tags: 'summary,takeaways,study_guide'
                }
            });

            if (currentSummaryRef.current === contentToSave) {
                setSaved(true);
                if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = setTimeout(() => setSaved(false), 3000);
            }
        } catch (err) {
            console.error("Save error:", err);
            if (err.kind === 'http') {
                alert(err.hasDetail ? err.message : 'Failed to save summary to library.');
            } else {
                alert(`Network error saving summary: ${err.message}`);
            }
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
        <div className="py-8 sm:py-12 min-h-screen">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
                {/* Unified PageHeader (FIX-12) */}
                <PageHeader 
                    eyebrow="Key Takeaways & Synthesis"
                    title="Smart Topic Summarizer"
                    subtitle="Condense complex concepts, chapters, and academic topics into structured executive takeaways."
                />

                {error && (
                    <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs font-mono">
                        ⚠️ {error}
                    </div>
                )}

                {/* Main Two-Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* Input Panel */}
                    <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10">
                        <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="w-5 h-5 text-emerald-400" />
                            <h2 className="text-base font-bold text-white">What would you like to summarize?</h2>
                        </div>
                        <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                            Paste lecture notes, book excerpts, or type a conceptual question.
                        </p>

                        <div className="relative">
                            <textarea
                                rows="6"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="e.g. Causes of World War I, How Transformer Attention Works, DNA Replication, Cellular Respiration..."
                                maxLength={1000}
                                className="w-full p-4 rounded-2xl glass-input text-sm text-white placeholder-slate-500 resize-none font-sans border border-white/15 focus-visible:ring-2 focus-visible:ring-emerald-500/70"
                            ></textarea>
                            <span className="absolute bottom-3 right-3 text-xs font-mono text-slate-400">
                                {topic.length}/1000
                            </span>
                        </div>

                        {/* Quick Prompts */}
                        <div className="mt-4">
                            <span className="text-xs font-mono text-slate-400 uppercase tracking-wide block mb-2">Example Topics:</span>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    "Quantum Entanglement & Superposition",
                                    "How Neural Networks Learn with Backpropagation",
                                    "Key Causes of the French Revolution"
                                ].map((t, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setTopic(t)}
                                        className="text-xs px-3 py-1.5 rounded-xl bg-slate-900 border border-white/15 text-slate-300 hover:text-white hover:border-emerald-500/40 transition-colors cursor-pointer"
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={handleSummarize}
                            disabled={isLoading || !topic.trim()}
                            className="mt-6 w-full py-3.5 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 transition-all shadow-[0_0_25px_rgba(16,185,129,0.3)] disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500/70"
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

                    {/* Output Panel (FIX-21: clean non-clipped header, FIX-01: MarkdownRenderer) */}
                    <div className="glass-panel p-6 sm:p-8 rounded-3xl flex flex-col justify-between border border-white/10 relative overflow-hidden">
                        <div>
                            <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/10 gap-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span className="text-xs font-mono uppercase tracking-wider text-slate-300 truncate">
                                        Executive Summary
                                    </span>
                                </div>
                                {summary && (
                                    <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                                        {/* Audio TTS Button */}
                                        <button
                                            onClick={handleToggleTTS}
                                            className={`p-1.5 px-2.5 rounded-lg border text-xs flex items-center gap-1 font-mono transition-colors cursor-pointer ${
                                                isSpeaking 
                                                    ? 'bg-emerald-500/30 border-emerald-400 text-emerald-300 animate-pulse' 
                                                    : 'bg-slate-900 border-white/15 text-slate-300 hover:text-emerald-400'
                                            }`}
                                            title={isSpeaking ? "Stop Reading" : "Read Summary Aloud (TTS)"}
                                            aria-label="Read Summary Aloud"
                                        >
                                            {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                                            <span>{isSpeaking ? 'Stop' : 'Listen'}</span>
                                        </button>

                                        {/* Save to Library */}
                                        <button
                                            onClick={handleSaveToLibrary}
                                            disabled={isSaving}
                                            className="p-1.5 px-2.5 rounded-lg bg-slate-900 border border-white/15 text-slate-300 hover:text-emerald-400 text-xs flex items-center gap-1 font-mono disabled:opacity-50 cursor-pointer"
                                            title="Save to Personal Study Library"
                                            aria-label="Save to Library"
                                        >
                                            {saved ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
                                            <span>{isSaving ? 'Saving...' : (saved ? 'Saved!' : 'Save')}</span>
                                        </button>

                                        {/* Download Markdown */}
                                        <button
                                            onClick={handleDownloadMarkdown}
                                            className="p-2 rounded-lg bg-slate-900 border border-white/15 text-slate-300 hover:text-emerald-400 text-xs flex items-center gap-1 font-mono cursor-pointer"
                                            title="Download Markdown File (.md)"
                                            aria-label="Download Markdown"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                        </button>

                                        {/* Copy Text */}
                                        <button
                                            onClick={handleCopy}
                                            className="p-1.5 px-2.5 rounded-lg bg-slate-900 border border-white/15 text-slate-300 hover:text-emerald-400 text-xs flex items-center gap-1 font-mono cursor-pointer"
                                            aria-label="Copy summary text"
                                        >
                                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                            <span>{copied ? 'Copied' : 'Copy'}</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {summary ? (
                                <div className="h-96 overflow-y-auto pr-2 text-sm text-slate-200 leading-relaxed font-sans">
                                    <MarkdownRenderer content={summary} />
                                </div>
                            ) : (
                                <div className="h-96 flex flex-col items-center justify-center text-slate-400 text-center p-6 border-2 border-dashed border-white/10 rounded-2xl">
                                    <BookOpen className="w-12 h-12 text-slate-600 mb-3" />
                                    <p className="text-sm font-mono text-slate-300">Your AI-generated summary will render here</p>
                                    <span className="text-xs text-slate-400 mt-1">Enter a topic on the left to begin synthesis</span>
                                </div>
                            )}
                        </div>

                        {/* Footer (FIX-28: remove fake trust label "Grounded in Academic Facts") */}
                        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono text-slate-400">
                            <span>Summary synthesis</span>
                            <span>Text-to-Speech & Export Enabled</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Summarize;
