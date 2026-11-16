import React, { useState } from 'react';
import MermaidViewer from './MermaidViewer';
import { Copy, Check, Terminal } from 'lucide-react';

const StructuredMessage = ({ content }) => {
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

    // Split message by code blocks (```...```)
    const parts = [];
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
        // Preceding text
        if (match.index > lastIndex) {
            parts.push({
                type: 'text',
                content: content.slice(lastIndex, match.index)
            });
        }

        const lang = (match[1] || 'text').toLowerCase().trim();
        const code = match[2];

        if (lang === 'mermaid') {
            parts.push({
                type: 'mermaid',
                chart: code
            });
        } else {
            parts.push({
                type: 'code',
                lang: lang,
                code: code
            });
        }

        lastIndex = match.index + match[0].length;
    }

    // Remaining text after last code block
    if (lastIndex < content.length) {
        parts.push({
            type: 'text',
            content: content.slice(lastIndex)
        });
    }

    // Fallback if no code blocks were found
    if (parts.length === 0) {
        parts.push({ type: 'text', content });
    }

    return (
        <div className="space-y-3 font-sans leading-relaxed">
            {parts.map((part, idx) => {
                if (part.type === 'mermaid') {
                    return (
                        <MermaidViewer
                            key={idx}
                            chart={part.chart}
                            title="Interactive Architectural Flow"
                        />
                    );
                }

                if (part.type === 'code') {
                    return (
                        <div key={idx} className="rounded-2xl overflow-hidden glass-panel border border-emerald-950/60 my-3 font-mono text-xs">
                            <div className="px-4 py-2 bg-[#090d16] border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">{part.lang || 'code'}</span>
                                </div>
                                <button
                                    onClick={() => handleCopyCode(part.code, idx)}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 text-[11px] transition-colors"
                                >
                                    {copiedCodeIdx === idx ? (
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
                                <code>{part.code}</code>
                            </pre>
                        </div>
                    );
                }

                // Render structured text
                return (
                    <div key={idx} className="whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed text-slate-200">
                        {part.content}
                    </div>
                );
            })}
        </div>
    );
};

export default StructuredMessage;
