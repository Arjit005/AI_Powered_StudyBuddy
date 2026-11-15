import React from 'react';
import { Check, Sparkles, Shield, Zap, Terminal } from 'lucide-react';
import { Link } from 'react-router-dom';

const Pricing = () => {
    return (
        <div className="pt-24 pb-16 min-h-screen bg-slate-950 text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs mb-3">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Academic & Developer Plans</span>
                    </div>
                    <h1 className="text-4xl font-extrabold text-white mb-3 tracking-tight">
                        Simple, Transparent Learning Tiers
                    </h1>
                    <p className="text-slate-400 text-sm max-w-lg mx-auto">
                        Empower your study workflow with MCP tooling, unlimited canvas modeling, and persistent hybrid memory.
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                    {/* Free Plan */}
                    <div className="glass-panel p-8 rounded-3xl border border-white/10 hover:border-emerald-500/30 transition-all flex flex-col justify-between">
                        <div>
                            <h3 className="text-xl font-bold text-white mb-1">Scholar Basic</h3>
                            <p className="text-slate-400 text-xs mb-6">Essential study tools for every student.</p>
                            <div className="text-4xl font-extrabold text-white mb-6">$0<span className="text-sm font-normal text-slate-400">/forever</span></div>
                            <button className="w-full py-3 px-4 bg-slate-800 text-slate-300 font-semibold rounded-xl text-xs hover:bg-slate-700 transition-colors mb-6 border border-white/5">
                                Current Plan
                            </button>
                            <ul className="space-y-3.5 text-xs text-slate-300">
                                {['10 AI Tutoring Sessions / day', 'Basic Summaries with Audio TTS', '3 MCQ Quizzes / day', 'Active Recall Flashcards', 'Pomodoro Focus Timer'].map(feat => (
                                    <li key={feat} className="flex items-center gap-2.5">
                                        <Check className="w-4 h-4 text-emerald-400 shrink-0" /> {feat}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Pro Plan */}
                    <div className="glass-panel-glow p-8 rounded-3xl border border-emerald-500/50 shadow-2xl shadow-emerald-950/60 relative transform md:-translate-y-3 flex flex-col justify-between">
                        <div className="absolute top-0 right-0 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-[10px] font-extrabold px-3 py-1 rounded-bl-xl rounded-tr-3xl uppercase tracking-wider">
                            POPULAR
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white mb-1">Pro Engineer</h3>
                            <p className="text-emerald-400/90 text-xs mb-6">Full MCP capability & canvas modeling.</p>
                            <div className="text-4xl font-extrabold text-white mb-6">$9<span className="text-sm font-normal text-slate-400">/mo</span></div>
                            <Link 
                                to="/chat" 
                                className="block text-center w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl text-xs hover:brightness-110 transition-all mb-6 shadow-lg shadow-emerald-950/40"
                            >
                                Start Pro Access
                            </Link>
                            <ul className="space-y-3.5 text-xs text-slate-200">
                                {[
                                    'Unlimited AI Tutor with Hybrid Memory',
                                    'Visual Canvas Studio with Excalidraw Export',
                                    'Model Context Protocol (MCP) STDIO Hub',
                                    'Unlimited Study Library & Notes Persistence',
                                    'Instant High-Detail Mermaid Diagrams',
                                    'Spaced-Repetition Leitner Flashcards',
                                    'Priority Multi-Model Inference Failover'
                                ].map(feat => (
                                    <li key={feat} className="flex items-center gap-2.5">
                                        <Check className="w-4 h-4 text-emerald-400 shrink-0" /> {feat}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Team Plan */}
                    <div className="glass-panel p-8 rounded-3xl border border-white/10 hover:border-emerald-500/30 transition-all flex flex-col justify-between">
                        <div>
                            <h3 className="text-xl font-bold text-white mb-1">Study Cohort</h3>
                            <p className="text-slate-400 text-xs mb-6">Designed for university labs & teams.</p>
                            <div className="text-4xl font-extrabold text-white mb-6">$29<span className="text-sm font-normal text-slate-400">/mo</span></div>
                            <a 
                                href="mailto:support@studybuddy.ai?subject=Inquiry%20about%20Study%20Cohort%20Plan" 
                                className="w-full block text-center py-3 px-4 bg-slate-800 text-slate-300 font-semibold rounded-xl text-xs hover:bg-slate-700 hover:text-white transition-colors mb-6 border border-white/5"
                            >
                                Contact Team
                            </a>
                            <ul className="space-y-3.5 text-xs text-slate-300">
                                {[
                                    'Up to 10 Team Members',
                                    'Shared Study Library & Decks',
                                    'Collaborative Architecture Modeling',
                                    'Centralized Analytics Dashboard',
                                    'Custom MCP Endpoint Connectors'
                                ].map(feat => (
                                    <li key={feat} className="flex items-center gap-2.5">
                                        <Check className="w-4 h-4 text-emerald-400 shrink-0" /> {feat}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Pricing;
