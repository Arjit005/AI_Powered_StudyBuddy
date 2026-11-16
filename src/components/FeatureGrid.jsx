import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, FileText, BookOpen, Zap, Clock, BarChart3, Mic, Share2, ArrowUpRight } from 'lucide-react';
import SpotlightCard from './ui/SpotlightCard';

const icons = {
    Chat: MessageSquare,
    Summarize: FileText,
    Flashcards: BookOpen,
    Quiz: Zap,
    Timer: Clock,
    Progress: BarChart3,
    Voice: Mic,
    Maps: Share2
};

const features = [
    { icon: 'Chat', title: 'Contextual AI Chat', desc: 'Engage with a tutor that retains multi-turn session history and formats code gracefully.', link: '/chat', tag: 'AI Engine', color: 'rgba(16, 185, 129, 0.15)' },
    { icon: 'Summarize', title: 'Smart Summarization', desc: 'Synthesize research papers, textbook chapters, and topics into high-retention bullet points.', link: '/summarize', tag: 'Core', color: 'rgba(6, 182, 212, 0.15)' },
    { icon: 'Flashcards', title: 'Recall Flashcards', desc: 'Auto-generate 3D digital flashcard decks optimized for spaced repetition learning.', link: '/flashcards', tag: 'Interactive', color: 'rgba(59, 130, 246, 0.15)' },
    { icon: 'Quiz', title: 'Dynamic MCQ Quizzes', desc: 'Challenge yourself with AI-generated quizzes featuring instant grading and answer rationales.', link: '/quiz', tag: 'Practice', color: 'rgba(245, 158, 11, 0.15)' },
    { icon: 'Timer', title: 'Pomodoro Focus Timer', desc: 'Track deep-work intervals and build persistent learning streaks with zero distractions.', link: '/timer', tag: 'Focus', color: 'rgba(239, 68, 68, 0.15)' },
    { icon: 'Progress', title: 'Learning Analytics', desc: 'Inspect study duration, total quizzes taken, and daily focus streaks.', link: '/progress', tag: 'Analytics', color: 'rgba(168, 85, 247, 0.15)' },
    { icon: 'Maps', title: 'Concept Graphs', desc: 'Generate visual knowledge maps depicting structural relationships between concepts.', link: '/maps', tag: 'Visuals', color: 'rgba(20, 184, 166, 0.15)' },
    { icon: 'Voice', title: 'Voice Study Room', desc: 'Speech-enabled study sessions for auditory learners and active recitation.', link: '/voice', tag: 'Audio', color: 'rgba(236, 72, 153, 0.15)' },
];

const FeatureGrid = () => {
    return (
        <section id="features" className="py-20 relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 font-mono text-xs mb-3 shadow-inner">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        All-in-One Learning Suite
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
                        Everything You Need to Master Any Subject
                    </h2>
                    <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base">
                        Every tool designed to maximize conceptual clarity, memory retention, and exam readiness.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {features.map((feature, idx) => {
                        const Icon = icons[feature.icon];
                        return (
                            <Link key={idx} to={feature.link} className="block group">
                                <SpotlightCard
                                    spotlightColor={feature.color}
                                    className="p-6 h-full flex flex-col justify-between hover:-translate-y-1.5 transition-transform duration-300 shadow-xl"
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="w-11 h-11 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all duration-300">
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50">
                                                {feature.tag}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors flex items-center justify-between">
                                            <span>{feature.title}</span>
                                            <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all text-emerald-400" />
                                        </h3>
                                        <p className="text-slate-400 leading-relaxed text-xs">
                                            {feature.desc}
                                        </p>
                                    </div>

                                    <div className="mt-6 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-500 group-hover:text-emerald-400 transition-colors">
                                        <span>Launch module</span>
                                        <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                                    </div>
                                </SpotlightCard>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default FeatureGrid;
