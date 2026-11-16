import React, { useState, useRef } from 'react';
import { Sparkles, X, ZoomIn, Download, Network, Layers, Cpu, CheckCircle2 } from 'lucide-react';
import MermaidViewer from '../components/MermaidViewer';

const SUGGESTIONS = [
    "Photosynthesis & Plant Biology",
    "Computer Science: How the Internet Works",
    "Human Circulatory System & Heart Anatomy",
    "Causes and Timeline of World War I",
    "Newton's Laws of Motion & Classical Mechanics"
];

const Maps = () => {
    const [topic, setTopic] = useState('');
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('mermaid'); // 'mermaid' or 'networkx'
    
    // Diagram data
    const [diagramData, setDiagramData] = useState(null);
    const [mapImage, setMapImage] = useState(null);
    const [isZoomed, setIsZoomed] = useState(false);
    const [error, setError] = useState(null);
    const mapRequestGenRef = useRef(0);

    const generateDiagram = async (targetTopic) => {
        const topicToUse = targetTopic || topic;
        if (!topicToUse.trim()) return;
        setLoading(true);
        setError(null);
        setIsZoomed(false);
        setDiagramData(null);
        setMapImage(null);

        const thisGen = ++mapRequestGenRef.current;
        let token = null;
        try {
            token = localStorage.getItem('auth_token');
        } catch (_) {}
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            // Fetch detailed Mermaid diagram and NetworkX topology graph concurrently with independent fault tolerance
            const [diagramResult, mapResult] = await Promise.allSettled([
                fetch('/api/generate-diagram', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ topic: topicToUse.trim() })
                }),
                fetch('/api/generate-map', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ topic: topicToUse.trim() })
                })
            ]);

            if (thisGen !== mapRequestGenRef.current) return;

            let hasDiagram = false;
            let hasMap = false;

            if (diagramResult.status === 'fulfilled' && diagramResult.value.ok) {
                try {
                    const data = await diagramResult.value.json();
                    if (thisGen !== mapRequestGenRef.current) return;
                    if (data && typeof data === 'object' && typeof data.mermaid_code === 'string' && data.mermaid_code.trim()) {
                        setDiagramData(data);
                        hasDiagram = true;
                    }
                } catch (pErr) {
                    console.warn("Diagram JSON parse error:", pErr);
                }
            }

            if (mapResult.status === 'fulfilled' && mapResult.value.ok) {
                try {
                    const mapJson = await mapResult.value.json();
                    if (thisGen !== mapRequestGenRef.current) return;
                    if (mapJson && typeof mapJson.map_image === 'string') {
                        const rawB64 = mapJson.map_image.trim();
                        // Validate Base64 length (<= 5MB) and decodability/padding format
                        const isValidBase64 = (str) => {
                            if (!str || str.length % 4 !== 0) return false;
                            if (!/^[A-Za-z0-9+/]+={0,2}$/.test(str)) return false;
                            try {
                                return typeof atob === 'function' ? !!atob(str.slice(0, 100)) : true;
                            } catch (_) {
                                return false;
                            }
                        };
                        if (rawB64.length <= 5 * 1024 * 1024 && isValidBase64(rawB64)) {
                            setMapImage(`data:image/png;base64,${rawB64}`);
                            hasMap = true;
                        }
                    }
                } catch (pErr) {
                    console.warn("Map JSON parse error:", pErr);
                }
            }

            if (!hasDiagram && !hasMap) {
                throw new Error('The server returned no usable diagram or concept map. Please try again.');
            }

            // Automatically switch to available view if one failed
            if (!hasDiagram && hasMap) {
                setViewMode('networkx');
            } else if (hasDiagram) {
                setViewMode('mermaid');
            }
        } catch (err) {
            console.error("Error generating diagram:", err);
            if (thisGen === mapRequestGenRef.current) {
                setError(err.message || "Failed to synthesize system diagram.");
            }
        } finally {
            if (thisGen === mapRequestGenRef.current) {
                setLoading(false);
            }
        }
    };

    return (
        <div className="py-12 min-h-screen">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 mb-3 shadow-[0_0_20px_rgba(6,182,212,0.25)]">
                        <Network className="w-7 h-7" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
                        Interactive Concept Mind Maps
                    </h1>
                    <p className="text-slate-400 text-sm max-w-xl mx-auto">
                        Generate visual concept maps, flowcharts, and topic breakdowns to understand complex subjects at a glance.
                    </p>
                </div>

                {/* Generator Bar */}
                <div className="max-w-xl mx-auto mb-4 flex gap-3">
                    <input
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && generateDiagram()}
                        placeholder="Enter system/topic (e.g. Distributed Consensus, OAuth 2.0)..."
                        className="flex-1 px-4 py-3 rounded-xl glass-input text-sm font-mono placeholder:text-slate-500"
                    />
                    <button
                        onClick={() => generateDiagram()}
                        disabled={loading || !topic.trim()}
                        className="px-6 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-40 flex items-center gap-2"
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Sparkles className="w-4 h-4" />
                        )}
                        <span>Create Map</span>
                    </button>
                </div>

                {/* Quick suggestions */}
                <div className="flex flex-wrap justify-center gap-2 mb-8 text-xs font-mono text-slate-400">
                    <span className="text-slate-500">Quick explore:</span>
                    {SUGGESTIONS.map((s, idx) => (
                        <button
                            key={idx}
                            onClick={() => {
                                setTopic(s);
                                generateDiagram(s);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:text-emerald-300 transition-colors"
                        >
                            {s}
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="max-w-md mx-auto mb-6 p-4 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs text-center font-mono">
                        {error}
                    </div>
                )}

                {/* Mode Selector Tabs (Visible when data exists) */}
                {(diagramData || mapImage) && (
                    <div className="flex justify-center mb-6">
                        <div className="p-1 rounded-xl bg-slate-900 border border-slate-800 flex gap-1 text-xs font-mono">
                            {diagramData && (
                                <button
                                    onClick={() => setViewMode('mermaid')}
                                    className={`px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 ${
                                        viewMode === 'mermaid'
                                            ? 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <Cpu className="w-3.5 h-3.5" />
                                    <span>Interactive Flowchart</span>
                                </button>
                            )}
                            {mapImage && (
                                <button
                                    onClick={() => setViewMode('networkx')}
                                    className={`px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 ${
                                        viewMode === 'networkx'
                                            ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <Network className="w-3.5 h-3.5" />
                                    <span>Visual Topic Map</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Viewport Card */}
                <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 relative min-h-[480px]">
                    {loading && (
                        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-slate-400 font-mono text-xs">
                            <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                            <span>Designing concept structure & generating visual flowchart...</span>
                        </div>
                    )}

                    {/* Mode 1: Detailed Interactive Mermaid Diagram */}
                    {!loading && diagramData && viewMode === 'mermaid' && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-bold text-white mb-1">{diagramData.title}</h2>
                                <p className="text-xs text-slate-400 font-mono">{diagramData.description}</p>
                            </div>

                            <MermaidViewer
                                chart={diagramData.mermaid_code}
                                title={diagramData.title}
                            />

                            {/* Structured Component Breakdown */}
                            {Array.isArray(diagramData.key_components) && diagramData.key_components.length > 0 && (
                                <div className="mt-6 pt-6 border-t border-white/5 space-y-3">
                                    <h3 className="text-sm font-bold text-emerald-400 font-mono uppercase tracking-wider flex items-center gap-2">
                                        <Layers className="w-4 h-4" /> Key Topic Breakdown & Concepts
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {diagramData.key_components.map((comp, idx) => (
                                            <div key={idx} className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                                <span className="leading-relaxed font-sans">{comp}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Mode 2: NetworkX Matplotlib Graph */}
                    {!loading && mapImage && viewMode === 'networkx' && (
                        <div className="relative group w-full flex flex-col items-center">
                            <img
                                src={mapImage}
                                alt="AI Concept Map"
                                className="max-h-[500px] w-auto object-contain rounded-2xl border border-slate-800 shadow-2xl cursor-pointer hover:scale-[1.01] transition-transform"
                                onClick={() => setIsZoomed(true)}
                            />
                            <div className="mt-4 flex gap-3">
                                <button
                                    onClick={() => setIsZoomed(true)}
                                    className="px-4 py-2 rounded-xl glass-panel text-xs font-mono text-slate-300 hover:text-white flex items-center gap-1.5"
                                >
                                    <ZoomIn className="w-3.5 h-3.5" /> Fullscreen View
                                </button>
                                <a
                                    href={mapImage}
                                    download={`${topic || 'concept'}_topology.png`}
                                    className="px-4 py-2 rounded-xl glass-panel text-xs font-mono text-slate-300 hover:text-white flex items-center gap-1.5"
                                >
                                    <Download className="w-3.5 h-3.5" /> Download PNG
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {!loading && !diagramData && !mapImage && !error && (
                        <div className="text-center text-slate-600 font-mono text-xs py-20">
                            <Network className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                            <p className="text-slate-400">Concept canvas is ready.</p>
                            <p className="text-slate-600 mt-1">Enter a topic above or pick a suggestion to visualize your study material.</p>
                        </div>
                    )}
                </div>

                {/* NetworkX Fullscreen Zoom Modal */}
                {isZoomed && mapImage && (
                    <div
                        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
                        onClick={() => setIsZoomed(false)}
                    >
                        <div className="relative max-w-5xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={() => setIsZoomed(false)}
                                className="absolute -top-12 right-0 p-2 text-white hover:text-emerald-400"
                            >
                                <X className="w-6 h-6" />
                            </button>
                            <img src={mapImage} alt="Fullscreen Map" className="max-h-[85vh] w-auto rounded-xl object-contain border border-slate-800 shadow-2xl" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Maps;
