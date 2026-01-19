import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const Hero = () => {
    return (
        <section className="relative overflow-hidden pt-16 pb-24 lg:pt-32">
            {/* Background blobs */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none opacity-50">
                <div className="absolute top-20 left-10 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
                <div className="absolute top-20 right-10 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-blue-700 font-medium text-sm mb-8 animate-fade-in">
                    <Sparkles className="w-4 h-4" />
                    <span>New: AI-Powered Quiz Generation</span>
                </div>

                <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-6">
                    Your Intelligent <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                        Study Companion
                    </span>
                </h1>

                <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
                    Transform your learning with AI-powered summarization, flashcards, quizzes, and personalized study sessions.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link to="/chat" className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 group">
                        Start Learning Now
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="w-full sm:w-auto px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold text-lg hover:bg-slate-50 transition-all shadow-sm">
                        View Features
                    </button>
                </div>
            </div>
        </section>
    );
};

export default Hero;
