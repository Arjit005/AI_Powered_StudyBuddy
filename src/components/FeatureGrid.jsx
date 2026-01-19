import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, FileText, BookOpen, Zap, Clock, BarChart, Mic, Share2 } from 'lucide-react';

const icons = {
    Chat: MessageSquare,
    Summarize: FileText,
    Flashcards: BookOpen,
    Quiz: Zap,
    Timer: Clock,
    Progress: BarChart,
    Voice: Mic,
    Maps: Share2
};

const features = [
    { icon: 'Chat', title: 'AI Chat', desc: 'Ask questions and get instant explanations from your AI tutor', link: '/chat' },
    { icon: 'Summarize', title: 'Smart Summarization', desc: 'Condense study materials into concise, focused summaries', link: '/summarize' },
    { icon: 'Flashcards', title: 'Flashcards', desc: 'Auto-generate flashcards for effective spaced repetition', link: '/flashcards' },
    { icon: 'Quiz', title: 'Quiz Generation', desc: 'Create interactive quizzes to test your knowledge', link: '/quiz' },
    { icon: 'Timer', title: 'Study Timer', desc: 'Track focus time with smart break reminders', link: '/timer' },
    { icon: 'Progress', title: 'Progress Tracking', desc: 'Monitor your learning journey with detailed analytics', link: '/progress' },
    { icon: 'Voice', title: 'Voice Notes', desc: 'Record and transcribe study notes automatically', link: '/voice' },
    { icon: 'Maps', title: 'Concept Maps', desc: 'Visualize complex topics with AI-generated diagrams', link: '/maps' },
];

const FeatureGrid = () => {
    return (
        <section id="features" className="py-24 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">Powerful Study Features</h2>
                    <p className="text-slate-600 max-w-2xl mx-auto">Everything you need to master your subjects in one place.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {features.map((feature, idx) => {
                        const Icon = icons[feature.icon];
                        return (
                            <Link key={idx} to={feature.link} className="block group p-8 rounded-2xl border border-slate-100 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-900/5 transition-all duration-300 bg-white hover:-translate-y-1">
                                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                    <Icon className="w-6 h-6 text-blue-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors">
                                    {feature.title}
                                </h3>
                                <p className="text-slate-600 leading-relaxed text-sm">
                                    {feature.desc}
                                </p>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default FeatureGrid;
