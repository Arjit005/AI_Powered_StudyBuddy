import React, { useState, useEffect, useRef } from 'react';
import { FileText, Upload, Trash2, RefreshCw, BookOpen, Sparkles, Plus } from 'lucide-react';

const Sources = () => {
    const [sources, setSources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [activeTab, setActiveTab] = useState('library'); // 'library' | 'upload' | 'discover'

    // Upload form state
    const [titleInput, setTitleInput] = useState('');
    const [textInput, setTextInput] = useState('');
    const [urlInput, setUrlInput] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadType, setUploadType] = useState('pdf'); // 'pdf' | 'url' | 'text'
    const fileInputRef = useRef(null);

    // Selected source guide modal state
    const [selectedSource, setSelectedSource] = useState(null);
    const [sourceGuide, setSourceGuide] = useState(null);
    const [guideError, setGuideError] = useState(null);
    const [loadingGuide, setLoadingGuide] = useState(false);
    const guideRequestGenRef = useRef(0);

    useEffect(() => {
        fetchSources();
    }, []);

    const fetchSources = async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const token = localStorage.getItem('auth_token');
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch('/api/sources', { headers });
            if (res.ok) {
                const data = await res.json();
                setSources(Array.isArray(data) ? data : []);
            } else {
                const errData = await res.json().catch(() => ({}));
                setFetchError(errData.detail || 'Failed to load study sources.');
            }
        } catch (e) {
            console.error("Error fetching sources:", e);
            setFetchError('Network error while retrieving sources.');
        } finally {
            setLoading(false);
        }
    };

    const handleUploadSubmit = async (e) => {
        e.preventDefault();

        // Client-side validation per upload mode
        if (uploadType === 'pdf' && !selectedFile) {
            alert('Please select a PDF document to upload.');
            return;
        } else if (uploadType === 'url' && !urlInput.trim()) {
            alert('Please enter a valid webpage or article URL.');
            return;
        } else if (uploadType === 'text' && !textInput.trim()) {
            alert('Please paste some text notes to index.');
            return;
        }

        setUploading(true);

        const formData = new FormData();
        formData.append('title', titleInput || (selectedFile ? selectedFile.name : 'Study Source'));
        formData.append('source_type', uploadType);

        if (uploadType === 'pdf' && selectedFile) {
            formData.append('file', selectedFile);
        } else if (uploadType === 'url' && urlInput) {
            formData.append('url', urlInput);
        } else if (uploadType === 'text' && textInput) {
            formData.append('content', textInput);
        }

        try {
            const token = localStorage.getItem('auth_token');
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch('/api/sources', {
                method: 'POST',
                headers,
                body: formData
            });
            if (res.ok) {
                setTitleInput('');
                setTextInput('');
                setUrlInput('');
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                setActiveTab('library');
                await fetchSources();
            } else {
                const err = await res.json().catch(() => ({}));
                alert(err.detail || 'Failed to save study material.');
            }
        } catch (err) {
            console.error("Upload error:", err);
            alert('Error uploading source.');
        } finally {
            setUploading(false);
        }
    };

    const openSourceGuide = async (source) => {
        const thisGen = ++guideRequestGenRef.current;
        setSelectedSource(source);
        setSourceGuide(null);
        setGuideError(null);
        setLoadingGuide(true);
        try {
            const token = localStorage.getItem('auth_token');
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`/api/sources/${source.id}/guide`, { headers });
            if (thisGen !== guideRequestGenRef.current) return;
            if (res.ok) {
                const data = await res.json();
                if (thisGen !== guideRequestGenRef.current) return;
                setSourceGuide(data);
            } else {
                const errData = await res.json().catch(() => ({}));
                if (thisGen !== guideRequestGenRef.current) return;
                setGuideError(errData.detail || 'Could not generate study guide for this source.');
            }
        } catch (e) {
            console.error("Guide fetch error:", e);
            if (thisGen === guideRequestGenRef.current) {
                setGuideError('Network error retrieving study guide.');
            }
        } finally {
            if (thisGen === guideRequestGenRef.current) {
                setLoadingGuide(false);
            }
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this study source?")) return;
        try {
            const token = localStorage.getItem('auth_token');
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`/api/sources/${id}`, { method: 'DELETE', headers });
            if (res.ok) {
                setSources(current => current.filter(s => s.id !== id));
                if (selectedSource?.id === id) {
                    guideRequestGenRef.current += 1;
                    setSelectedSource(null);
                    setSourceGuide(null);
                    setLoadingGuide(false);
                }
            } else {
                alert("Failed to delete source.");
            }
        } catch (e) {
            console.error("Delete error:", e);
            alert("Network error deleting source.");
        }
    };

    const handleReindex = async (id) => {
        try {
            const token = localStorage.getItem('auth_token');
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`/api/sources/${id}/reindex`, { method: 'POST', headers });
            if (res.ok) {
                alert("Source successfully re-chunked and re-embedded!");
            } else {
                alert("Failed to reindex source.");
            }
        } catch (e) {
            console.error("Reindex error:", e);
            alert("Network error reindexing source.");
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent flex items-center gap-3">
                        <BookOpen className="w-8 h-8 text-emerald-400" />
                        Study Sources & Reference Notes
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Upload PDFs, articles, and study notes. Your AI Tutor will answer questions directly from your materials with citations.
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-emerald-500/20">
                    <button
                        onClick={() => setActiveTab('library')}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                            activeTab === 'library'
                                ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        Study Materials ({sources.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('upload')}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                            activeTab === 'upload'
                                ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add Source
                    </button>
                </div>
            </div>

            {fetchError && (
                <div className="mb-6 p-3 rounded-xl bg-amber-950/50 border border-amber-800/50 text-amber-300 text-xs font-mono flex items-center justify-between">
                    <span>⚠️ {fetchError}</span>
                    <button onClick={() => setFetchError(null)} className="text-slate-400 hover:text-white px-2">✕</button>
                </div>
            )}

            {/* Main Content Area */}
            {activeTab === 'library' ? (
                <div>
                    {loading ? (
                        <div className="text-center py-20 text-slate-500">Loading study materials...</div>
                    ) : sources.length === 0 ? (
                        <div className="glass-panel p-12 text-center max-w-xl mx-auto border border-emerald-500/20 rounded-2xl">
                            <FileText className="w-16 h-16 text-emerald-400/50 mx-auto mb-4 animate-pulse" />
                            <h3 className="text-lg font-bold text-white mb-2">No Study Materials Added Yet</h3>
                            <p className="text-slate-400 text-sm mb-6">
                                Upload a PDF lecture, paste notes, or add an article so your AI Tutor can answer directly from your materials.
                            </p>
                            <button
                                onClick={() => setActiveTab('upload')}
                                className="px-6 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                            >
                                Add First Study Material
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {sources.map((s) => (
                                <div
                                    key={s.id}
                                    className="glass-panel p-6 rounded-2xl border border-emerald-500/20 hover:border-emerald-500/50 transition-all flex flex-col justify-between group relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all" />
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                                                {s.source_type}
                                            </span>
                                            <span className="text-xs text-slate-400 font-mono">
                                                {s.domain || s.origin}
                                            </span>
                                        </div>
                                        <h3 className="text-base font-bold text-white mb-2 line-clamp-1 group-hover:text-emerald-300 transition-colors">
                                            {s.title}
                                        </h3>
                                        <p className="text-xs text-slate-400 line-clamp-3 mb-4 leading-relaxed">
                                            {s.summary}
                                        </p>
                                    </div>
                                    <div className="pt-4 border-t border-emerald-500/10 flex items-center justify-between">
                                        <button
                                            onClick={() => openSourceGuide(s)}
                                            className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30 transition-all flex items-center gap-1.5"
                                        >
                                            <Sparkles className="w-3.5 h-3.5" />
                                            Source Guide
                                        </button>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleReindex(s.id)}
                                                className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-emerald-400 border border-slate-800 hover:border-emerald-500/40 transition-all"
                                                title="Refresh & Re-index Material"
                                            >
                                                <RefreshCw className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(s.id)}
                                                className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-900/40 transition-all"
                                                title="Delete Source"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                /* Upload Form View */
                <div className="max-w-2xl mx-auto glass-panel p-8 rounded-2xl border border-emerald-500/30 shadow-2xl">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <Upload className="w-5 h-5 text-emerald-400" />
                        Add New Study Material
                    </h2>

                    <div className="flex gap-3 mb-6">
                        <button
                            type="button"
                            onClick={() => {
                                setUploadType('pdf');
                                setSelectedFile(null);
                                if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className={`flex-py-2 px-4 rounded-xl text-xs font-semibold border transition-all flex-1 text-center py-2.5 ${
                                uploadType === 'pdf'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                        >
                            📄 PDF Lecture / Doc
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setUploadType('url');
                                setSelectedFile(null);
                                if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className={`flex-py-2 px-4 rounded-xl text-xs font-semibold border transition-all flex-1 text-center py-2.5 ${
                                uploadType === 'url'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                        >
                            🌐 Web Article URL
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setUploadType('text');
                                setSelectedFile(null);
                                if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className={`flex-py-2 px-4 rounded-xl text-xs font-semibold border transition-all flex-1 text-center py-2.5 ${
                                uploadType === 'text'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                        >
                            📝 Paste Text / Notes
                        </button>
                    </div>

                    <form onSubmit={handleUploadSubmit} className="space-y-5">
                        <div>
                            <label className="block text-xs font-mono font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                                Source Title / Custom Name
                            </label>
                            <input
                                type="text"
                                value={titleInput}
                                onChange={(e) => setTitleInput(e.target.value)}
                                placeholder="e.g., Quantum Computing Chapter 4"
                                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500 font-sans"
                            />
                        </div>

                        {uploadType === 'pdf' && (
                            <div>
                                <label className="block text-xs font-mono font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                                    Upload PDF Document
                                </label>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf"
                                    onChange={(e) => setSelectedFile(e.target.files[0])}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 text-xs file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-500 file:text-slate-950 hover:file:bg-emerald-400 cursor-pointer"
                                />
                            </div>
                        )}

                        {uploadType === 'url' && (
                            <div>
                                <label className="block text-xs font-mono font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                                    Web Article URL
                                </label>
                                <input
                                    type="url"
                                    value={urlInput}
                                    onChange={(e) => setUrlInput(e.target.value)}
                                    placeholder="https://example.com/article-on-machine-learning"
                                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500 font-sans"
                                />
                            </div>
                        )}

                        {uploadType === 'text' && (
                            <div>
                                <label className="block text-xs font-mono font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                                    Study Notes / Raw Content
                                </label>
                                <textarea
                                    rows="6"
                                    value={textInput}
                                    onChange={(e) => setTextInput(e.target.value)}
                                    placeholder="Paste comprehensive notes, lecture transcripts, or textbook excerpts here..."
                                    className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-emerald-500 font-sans"
                                ></textarea>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-4 border-t border-emerald-500/20">
                            <button
                                type="button"
                                onClick={() => setActiveTab('library')}
                                className="px-5 py-2.5 rounded-xl bg-slate-900 text-slate-400 hover:text-white text-xs font-semibold border border-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={uploading}
                                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs hover:from-emerald-400 hover:to-teal-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50 flex items-center gap-2"
                            >
                                {uploading ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Reading & Processing Notes...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        Add Material & Create Study Guide
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Source Guide Modal */}
            {selectedSource && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="glass-panel w-full max-w-3xl max-h-[90vh] overflow-y-auto p-8 rounded-3xl border border-emerald-500/40 shadow-2xl relative">
                        <button
                            onClick={() => {
                                guideRequestGenRef.current += 1;
                                setSelectedSource(null);
                                setSourceGuide(null);
                                setLoadingGuide(false);
                            }}
                            className="absolute top-6 right-6 p-2 rounded-full bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                        >
                            ✕
                        </button>

                        <div className="flex items-center gap-3 mb-4">
                            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-emerald-950 text-emerald-300 border border-emerald-800">
                                {selectedSource.source_type}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                                {selectedSource.domain || selectedSource.origin}
                            </span>
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-4">
                            {selectedSource.title}
                        </h2>

                        {loadingGuide ? (
                            <div className="py-16 text-center text-emerald-400 font-mono animate-pulse">
                                Generating AI Source Guide & Key Concepts...
                            </div>
                        ) : sourceGuide ? (
                            <div className="space-y-6">
                                {/* Summary Section */}
                                <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/20">
                                    <h4 className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold mb-2">
                                        Executive Summary
                                    </h4>
                                    <p className="text-sm text-slate-200 leading-relaxed">
                                        {sourceGuide.summary}
                                    </p>
                                </div>

                                {/* Key Topics */}
                                <div>
                                    <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold mb-3">
                                        Key Technical Themes
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {Array.isArray(sourceGuide.key_topics) && sourceGuide.key_topics.length > 0 ? (
                                            sourceGuide.key_topics.map((topic, idx) => (
                                                <span
                                                    key={idx}
                                                    className="px-3 py-1 rounded-xl text-xs font-semibold bg-slate-900 text-emerald-300 border border-emerald-500/30 shadow-sm"
                                                >
                                                    {topic}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-slate-500">No key themes extracted.</span>
                                        )}
                                    </div>
                                </div>

                                {/* Suggested Study Questions */}
                                <div>
                                    <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold mb-3">
                                        Suggested Study Questions
                                    </h4>
                                    <ul className="space-y-2">
                                        {Array.isArray(sourceGuide.suggested_questions) && sourceGuide.suggested_questions.length > 0 ? (
                                            sourceGuide.suggested_questions.map((q, idx) => (
                                                <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                                                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono font-bold shrink-0 text-[10px]">
                                                        {idx + 1}
                                                    </span>
                                                    <span className="mt-0.5">{q}</span>
                                                </li>
                                            ))
                                        ) : (
                                            <li className="text-xs text-slate-500">No suggested questions available.</li>
                                        )}
                                    </ul>
                                </div>
                            </div>
                        ) : guideError ? (
                            <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-mono">
                                ⚠️ {guideError}
                            </div>
                        ) : (
                            <div className="text-slate-400 text-sm">Failed to load source guide.</div>
                        )}

                        <div className="mt-8 pt-4 border-t border-emerald-500/20 flex justify-end">
                            <button
                                onClick={() => {
                                    guideRequestGenRef.current += 1;
                                    setSelectedSource(null);
                                    setSourceGuide(null);
                                    setLoadingGuide(false);
                                }}
                                className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sources;
