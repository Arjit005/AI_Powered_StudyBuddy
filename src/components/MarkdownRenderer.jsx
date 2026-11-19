import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import MermaidViewer from './MermaidViewer';
import { Terminal, Copy, Check } from 'lucide-react';

const MermaidBlock = ({ chart, title }) => {
    return (
        <MermaidViewer
            chart={chart}
            title={title || "Diagram"}
        />
    );
};

export default function MarkdownRenderer({ 
    content, 
    citations = [], 
    onSelectCitation,
    className = "",
    diagramTitle
}) {
    const [copiedCodeIdx, setCopiedCodeIdx] = useState(null);

    const handleCopyCode = async (codeText, idx) => {
        try {
            await navigator.clipboard.writeText(codeText);
            setCopiedCodeIdx(idx);
            setTimeout(() => {
                setCopiedCodeIdx(currentIdx => currentIdx === idx ? null : currentIdx);
            }, 2000);
        } catch (err) {
            console.error("Clipboard write error:", err);
        }
    };

    if (!content) return null;

    // Partial markdown streaming tolerance: if ends with unclosed ```, close it for rendering
    let sanitizedContent = content;
    const fenceCount = (content.match(/```/g) || []).length;
    if (fenceCount % 2 !== 0) {
        sanitizedContent = content + "\n```";
    }

    const components = {
        h1: ({ node, ...props }) => <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight my-4" {...props} />,
        h2: ({ node, ...props }) => <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight my-3 pb-1 border-b border-white/10" {...props} />,
        h3: ({ node, ...props }) => <h3 className="text-base sm:text-lg font-semibold text-white tracking-tight my-2.5" {...props} />,
        h4: ({ node, ...props }) => <h4 className="text-sm sm:text-base font-semibold text-white tracking-tight my-2" {...props} />,
        p: ({ node, children, ...props }) => {
            return (
                <p className="my-2 text-[14px] sm:text-[15px] leading-relaxed text-slate-200" {...props}>
                    {React.Children.map(children, child => {
                        if (typeof child === 'string' && /\[(\d+)\]/.test(child)) {
                            const parts = [];
                            let lastIdx = 0;
                            const regex = /\[(\d+)\]/g;
                            let m;
                            while ((m = regex.exec(child)) !== null) {
                                if (m.index > lastIdx) {
                                    parts.push(child.slice(lastIdx, m.index));
                                }
                                const n = parseInt(m[1], 10);
                                const cit = citations.find(c => c.n === n);
                                parts.push(
                                    <button
                                        key={`cit-${m.index}`}
                                        type="button"
                                        onClick={() => onSelectCitation && onSelectCitation(cit || { n })}
                                        className="inline-flex items-center justify-center px-1.5 py-0.2 mx-0.5 text-[11px] font-mono font-bold rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 hover:scale-105 active:scale-95 transition-all cursor-pointer align-super"
                                        title={cit ? `Source: ${cit.source_title || 'Document'}` : `Source [${n}]`}
                                        aria-label={`Open citation ${n}`}
                                    >
                                        [{n}]
                                    </button>
                                );
                                lastIdx = m.index + m[0].length;
                            }
                            if (lastIdx < child.length) {
                                parts.push(child.slice(lastIdx));
                            }
                            return parts;
                        }
                        return child;
                    })}
                </p>
            );
        },
        ul: ({ node, ...props }) => <ul className="list-disc pl-5 my-2.5 space-y-1.5 text-slate-200 text-[14px]" {...props} />,
        ol: ({ node, ...props }) => <ol className="list-decimal pl-5 my-2.5 space-y-1.5 text-slate-200 text-[14px]" {...props} />,
        li: ({ node, ...props }) => <li className="text-slate-200 leading-relaxed" {...props} />,
        strong: ({ node, ...props }) => <strong className="font-bold text-white" {...props} />,
        em: ({ node, ...props }) => <em className="italic text-slate-200" {...props} />,
        hr: () => <hr className="border-t border-white/10 my-6" />,
        blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-2 border-emerald-500/60 pl-4 py-1.5 my-3 italic text-slate-300 bg-white/[0.02] rounded-r-lg" {...props} />
        ),
        table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-4 rounded-xl border border-white/10">
                <table className="min-w-full divide-y divide-white/10 text-xs sm:text-sm text-left" {...props} />
            </div>
        ),
        thead: ({ node, ...props }) => <thead className="bg-white/[0.04] text-slate-200 font-semibold" {...props} />,
        tbody: ({ node, ...props }) => <tbody className="divide-y divide-white/5 text-slate-300" {...props} />,
        tr: ({ node, ...props }) => <tr className="hover:bg-white/[0.02]" {...props} />,
        th: ({ node, ...props }) => <th className="px-3 py-2 text-slate-200" {...props} />,
        td: ({ node, ...props }) => <td className="px-3 py-2 text-slate-300" {...props} />,
        span: ({ node, className, children, ...props }) => {
            const isMath = className && (className.includes('katex') || className.includes('math'));
            return (
                <span className={`${className || ''} ${isMath ? 'max-w-full overflow-x-auto inline-block align-middle' : ''}`} {...props}>
                    {children}
                </span>
            );
        },
        code: ({ node, inline, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const lang = match ? match[1].toLowerCase() : '';
            const codeString = String(children).replace(/\n$/, '');

            if (!inline && lang === 'mermaid') {
                return <MermaidBlock chart={codeString} title={diagramTitle} />;
            }

            if (!inline && (match || codeString.includes('\n'))) {
                const codeIdx = Math.random().toString(36).substring(7);
                return (
                    <div className="rounded-2xl overflow-hidden glass-panel border border-emerald-950/60 my-3 font-mono text-xs not-prose">
                        <div className="px-4 py-2 bg-[#090d16] border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{lang || 'code'}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleCopyCode(codeString, codeIdx)}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 text-xs transition-colors"
                            >
                                {copiedCodeIdx === codeIdx ? (
                                    <>
                                        <Check className="w-3 h-3 text-emerald-400" />
                                        <span className="text-emerald-400">Copied</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-3 h-3" />
                                        <span>Copy Code</span>
                                    </>
                                )}
                            </button>
                        </div>
                        <pre className="p-4 bg-[#06090f] overflow-x-auto text-emerald-300 leading-normal">
                            <code>{codeString}</code>
                        </pre>
                    </div>
                );
            }

            return (
                <code className="bg-white/[0.06] rounded px-1.5 py-0.5 text-emerald-300 text-[0.9em] font-mono whitespace-nowrap" {...props}>
                    {children}
                </code>
            );
        }
    };

    return (
        <div className={`font-sans leading-relaxed text-slate-200 w-full ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={components}
            >
                {sanitizedContent}
            </ReactMarkdown>

            {citations && citations.length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Sources:</span>
                    {citations.map((c, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => onSelectCitation && onSelectCitation(c)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-300 text-xs transition-all hover:bg-emerald-900/40"
                        >
                            <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
                                {c.n || i + 1}
                            </span>
                            <span className="truncate max-w-[140px] text-xs">
                                {c.source_title || `Document #${c.source_id || i + 1}`}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
