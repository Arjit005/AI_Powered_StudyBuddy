import React, { useState, useRef } from 'react';
import { Volume2, VolumeX, Sparkles, RotateCw, Lightbulb, CheckCircle2 } from 'lucide-react';

/**
 * ReactBits-inspired 3D Physics FlipCard
 * Features real 3D CSS perspective, smooth spring transition,
 * cursor-dependent subtle 3D tilt, and double-sided active recall interface.
 */
const FlipCard3D = ({
    frontContent,
    backContent,
    isFlipped,
    onFlip,
    cardCategory = 'Core Concept',
    currentRating = null,
    onReadCard,
    isSpeaking = false,
}) => {
    const cardRef = useRef(null);
    const [tilt, setTilt] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        // Subtle tilt when hovered (max 6 degrees)
        setTilt({ x: -y * 8, y: x * 8 });
    };

    const handleMouseLeave = () => {
        setTilt({ x: 0, y: 0 });
    };

    const ratingBadgeColor = {
        mastered: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        good: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        hard: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    }[currentRating] || 'bg-slate-800 text-slate-400 border-slate-700/50';

    return (
        <div
            className="w-full max-w-xl mx-auto h-84 cursor-pointer select-none"
            style={{ perspective: '1200px' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={onFlip}
        >
            <div
                ref={cardRef}
                className="relative w-full h-full transition-transform duration-700 ease-out"
                style={{
                    transformStyle: 'preserve-3d',
                    transform: `rotateY(${isFlipped ? 180 : 0}deg) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                }}
            >
                {/* ================= FRONT FACE (Prompt) ================= */}
                <div
                    className="absolute inset-0 w-full h-full rounded-3xl p-8 flex flex-col justify-between bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-950/90 border border-slate-800/80 shadow-[0_10px_35px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-all"
                    style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                    }}
                >
                    {/* Atmospheric Glow */}
                    <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                    {/* Header */}
                    <div className="flex justify-between items-center text-xs font-mono">
                        <span className="px-3 py-1 rounded-full bg-slate-950/80 border border-slate-800 text-emerald-400 flex items-center gap-1.5 shadow-sm">
                            <Sparkles className="w-3.5 h-3.5" />
                            QUESTION / PROMPT
                        </span>

                        <div className="flex items-center gap-2">
                            {currentRating && (
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${ratingBadgeColor}`}>
                                    {currentRating}
                                </span>
                            )}
                            <button
                                onClick={onReadCard}
                                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                title="Listen to prompt"
                            >
                                {isSpeaking ? <VolumeX className="w-4 h-4 text-emerald-400 animate-pulse" /> : <Volume2 className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Central Content */}
                    <div className="my-auto text-center px-4">
                        <div className="text-xs uppercase tracking-wider font-mono text-slate-500 mb-3">
                            {cardCategory}
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-white leading-relaxed">
                            {frontContent}
                        </h2>
                    </div>

                    {/* Footer Tip */}
                    <div className="flex items-center justify-between text-xs font-mono text-slate-500 pt-4 border-t border-slate-800/60">
                        <span className="flex items-center gap-1 text-slate-400">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                            Formulate answer in your mind
                        </span>
                        <span className="flex items-center gap-1 text-emerald-400 font-semibold group">
                            <span>Click to reveal answer</span>
                            <RotateCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
                        </span>
                    </div>
                </div>

                {/* ================= BACK FACE (Answer) ================= */}
                <div
                    className="absolute inset-0 w-full h-full rounded-3xl p-8 flex flex-col justify-between bg-gradient-to-br from-slate-900/95 via-slate-950/80 to-emerald-950/20 border border-emerald-500/40 shadow-[0_10px_40px_rgba(16,185,129,0.15)] backdrop-blur-2xl transition-all"
                    style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                    }}
                >
                    {/* Emerald Aurora Glow */}
                    <div className="absolute bottom-0 left-0 w-44 h-44 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

                    {/* Header */}
                    <div className="flex justify-between items-center text-xs font-mono">
                        <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-1.5 shadow-sm font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            SOLUTION / CONCEPT
                        </span>

                        <button
                            onClick={onReadCard}
                            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="Listen to solution"
                        >
                            {isSpeaking ? <VolumeX className="w-4 h-4 text-emerald-400 animate-pulse" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                    </div>

                    {/* Central Content */}
                    <div className="my-auto text-left px-2 max-h-40 overflow-y-auto custom-scrollbar">
                        <div className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed">
                            {backContent}
                        </div>
                    </div>

                    {/* Footer Tip */}
                    <div className="flex items-center justify-between text-xs font-mono text-slate-500 pt-4 border-t border-slate-800/60">
                        <span className="text-slate-400">Rate your recall below</span>
                        <span className="text-slate-400 hover:text-white flex items-center gap-1">
                            <RotateCw className="w-3.5 h-3.5" />
                            Click to flip back
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FlipCard3D;
