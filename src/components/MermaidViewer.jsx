import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { ZoomIn, ZoomOut, RotateCcw, Download, Copy, Check, Maximize2, X, AlertCircle } from 'lucide-react';

let mermaidInitialized = false;

const initMermaid = () => {
    if (!mermaidInitialized) {
        mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            securityLevel: 'strict',
            themeVariables: {
                darkMode: true,
                background: '#0b0f17',
                primaryColor: '#064e3b',
                primaryTextColor: '#ecfdf5',
                primaryBorderColor: '#10b981',
                lineColor: '#34d399',
                secondaryColor: '#131b2e',
                tertiaryColor: '#1e293b',
                fontFamily: 'JetBrains Mono, monospace, Inter, sans-serif',
                fontSize: '13px',
            },
        });
        mermaidInitialized = true;
    }
};

const MermaidViewer = ({ chart, title = "Architecture Diagram" }) => {
    const containerRef = useRef(null);
    const copyTimeoutRef = useRef(null);
    const [svgContent, setSvgContent] = useState('');
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        return () => {
            if (copyTimeoutRef.current) {
                clearTimeout(copyTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!chart || !chart.trim()) {
            setSvgContent('');
            setError(null);
            return;
        }
        initMermaid();

        let isCancelled = false;
        setSvgContent(''); // Clear previous SVG while compiling
        setError(null);

        const renderChart = async () => {
            const id = 'mermaid-' + Math.random().toString(36).substring(2, 9);
            try {
                // Clean markdown code blocks if passed with backticks
                let cleanChart = chart.trim();
                if (cleanChart.startsWith('```mermaid')) {
                    cleanChart = cleanChart.replace(/^```mermaid\s*/, '').replace(/```$/, '').trim();
                } else if (cleanChart.startsWith('```')) {
                    cleanChart = cleanChart.replace(/^```\s*/, '').replace(/```$/, '').trim();
                }

                const { svg } = await mermaid.render(id, cleanChart);
                if (!isCancelled) {
                    setSvgContent(svg);
                }
            } catch (err) {
                console.error("Mermaid Render Error:", err);
                if (!isCancelled) {
                    setError(err.message || "Failed to render diagram syntax.");
                }
            }
        };

        renderChart();

        return () => {
            isCancelled = true;
        };
    }, [chart]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(chart || '');
            setCopied(true);
            if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
            copyTimeoutRef.current = setTimeout(() => {
                setCopied(false);
                copyTimeoutRef.current = null;
            }, 2000);
        } catch (err) {
            console.error("Clipboard copy failed:", err);
        }
    };

    const handleDownloadSvg = () => {
        if (!svgContent) return;
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.toLowerCase().replace(/\s+/g, '_')}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    return (
        <div className="rounded-2xl glass-panel border border-emerald-500/20 my-4 overflow-hidden shadow-xl">
            {/* Top Toolbar */}
            <div className="px-4 py-2.5 bg-[#0e1626]/90 border-b border-emerald-950/60 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="font-mono font-bold text-slate-200">{title}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Interactive SVG
                    </span>
                </div>

                <div className="flex items-center gap-1.5 font-mono">
                    <button
                        onClick={() => setZoom(prev => Math.min(prev + 0.15, 2.5))}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                        title="Zoom In"
                    >
                        <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setZoom(prev => Math.max(prev - 0.15, 0.5))}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                        title="Zoom Out"
                    >
                        <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setZoom(1)}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                        title="Reset Zoom"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={handleCopy}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400"
                        title="Copy Mermaid Code"
                    >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                        onClick={handleDownloadSvg}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400"
                        title="Download SVG"
                    >
                        <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setIsFullscreen(true)}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400"
                        title="Fullscreen"
                    >
                        <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Diagram Canvas */}
            <div className="p-4 sm:p-6 bg-[#070a10] overflow-auto flex items-center justify-center min-h-[280px] max-h-[550px]">
                {error ? (
                    <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 font-mono space-y-2 max-w-md">
                        <div className="flex items-center gap-2 font-bold text-rose-400">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>Mermaid Syntax Warning</span>
                        </div>
                        <p className="text-[11px] text-slate-400">Raw source code is displayed below:</p>
                        <pre className="p-2.5 rounded bg-black/60 overflow-x-auto text-[11px] text-emerald-400">
                            {chart}
                        </pre>
                    </div>
                ) : svgContent ? (
                    <div
                        ref={containerRef}
                        style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                        className="transition-transform duration-200 flex items-center justify-center w-full"
                        dangerouslySetInnerHTML={{ __html: svgContent }}
                    />
                ) : (!chart || !chart.trim()) ? (
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                        <span>No diagram code provided.</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                        <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                        <span>Compiling vector diagram...</span>
                    </div>
                )}
            </div>

            {/* Fullscreen View Modal */}
            {isFullscreen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={`${title} Fullscreen Inspection`}
                    tabIndex={-1}
                    className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col p-6 animate-in fade-in duration-200"
                    onClick={() => setIsFullscreen(false)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            e.stopPropagation();
                            setIsFullscreen(false);
                        }
                    }}
                >
                    <div className="flex justify-between items-center pb-4 border-b border-white/10" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white font-mono">{title} - Fullscreen Inspection</span>
                        </div>
                        <button
                            onClick={() => setIsFullscreen(false)}
                            className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div
                        className="flex-1 flex items-center justify-center overflow-auto p-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {error ? (
                            <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-mono max-w-lg">
                                {error}
                            </div>
                        ) : svgContent ? (
                            <div
                                style={{ transform: `scale(${zoom * 1.3})`, transformOrigin: 'center center' }}
                                className="transition-transform duration-200 max-w-full"
                                dangerouslySetInnerHTML={{ __html: svgContent }}
                            />
                        ) : (!chart || !chart.trim()) ? (
                            <div className="text-slate-400 font-mono text-sm">No diagram code provided.</div>
                        ) : (
                            <div className="text-slate-400 font-mono text-sm animate-pulse">Compiling vector diagram...</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MermaidViewer;
