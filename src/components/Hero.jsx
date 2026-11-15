import React from 'react';
import { Sparkles, ArrowRight, ShieldCheck, Terminal, Cpu, Database } from 'lucide-react';
import { Link } from 'react-router-dom';

const Hero = () => {
    return (
        <section className="relative overflow-hidden pt-12 pb-20 lg:pt-24 lg:pb-28">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                {/* Tech Stack Banner */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 font-mono text-xs mb-8 shadow-[0_0_15px_rgba(16,185,129,0.15)] animate-in fade-in duration-500">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>AI Safety Shield v1.2</span>
                    <span className="text-emerald-500/60">•</span>
                    <span>Multi-Model Failover Pipeline</span>
                </div>

                {/* Main Heading */}
                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6">
                    Master Complex Subjects with <br />
                    <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                        Developer-Grade AI Tutoring
                    </span>
                </h1>

                <p className="text-base sm:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed font-sans">
                    Accelerate your learning curve with context-aware tutoring, dynamic MCQ generation, 
                    knowledge concept graphs, and active-recall flashcards — backed by an enterprise-grade security shield.
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                    <Link
                        to="/chat"
                        className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-bold text-sm sm:text-base rounded-2xl hover:brightness-110 active:scale-95 transition-all shadow-[0_0_30px_rgba(16,185,129,0.35)] flex items-center justify-center gap-2.5 group"
                    >
                        <Terminal className="w-4 h-4" />
                        <span>Launch Study Console</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <button
                        onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                        className="w-full sm:w-auto px-8 py-4 rounded-2xl glass-panel text-slate-300 font-semibold text-sm sm:text-base hover:text-white hover:border-emerald-500/40 transition-all flex items-center justify-center gap-2"
                    >
                        Explore Modules
                    </button>
                </div>

                {/* Developer Architecture Spec Pills */}
                <div className="pt-8 border-t border-slate-800/80 max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
                    <div className="p-4 rounded-2xl glass-panel">
                        <div className="flex items-center gap-2 text-emerald-400 mb-1">
                            <Cpu className="w-4 h-4" />
                            <span className="text-xs font-mono font-semibold">Gemini + Fallbacks</span>
                        </div>
                        <div className="text-sm font-bold text-white">AI Engine</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">Triple-tier failover</div>
                    </div>

                    <div className="p-4 rounded-2xl glass-panel">
                        <div className="flex items-center gap-2 text-teal-400 mb-1">
                            <ShieldCheck className="w-4 h-4" />
                            <span className="text-xs font-mono font-semibold">Prompt Guard</span>
                        </div>
                        <div className="text-sm font-bold text-white">Security Shield</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">Anti-jailbreak filter</div>
                    </div>

                    <div className="p-4 rounded-2xl glass-panel">
                        <div className="flex items-center gap-2 text-cyan-400 mb-1">
                            <Database className="w-4 h-4" />
                            <span className="text-xs font-mono font-semibold">SQLAlchemy ORM</span>
                        </div>
                        <div className="text-sm font-bold text-white">Persistence</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">SQLite User isolation</div>
                    </div>

                    <div className="p-4 rounded-2xl glass-panel">
                        <div className="flex items-center gap-2 text-emerald-400 mb-1">
                            <Terminal className="w-4 h-4" />
                            <span className="text-xs font-mono font-semibold">React 19 + Vite</span>
                        </div>
                        <div className="text-sm font-bold text-white">Glassmorphic UI</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">Tailwind CSS v4</div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Hero;
