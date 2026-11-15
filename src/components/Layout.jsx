import React from 'react';
import FeedbackWidget from './FeedbackWidget';

const Layout = ({ children }) => {
    return (
        <div className="min-h-screen bg-[#0b0f17] text-slate-100 font-sans selection:bg-emerald-500 selection:text-white relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none -z-10 animate-pulse-glow" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-[160px] pointer-events-none -z-10 animate-pulse-glow" style={{ animationDelay: '2s' }} />
            <div className="fixed top-[40%] right-[30%] w-[350px] h-[350px] bg-emerald-700/5 rounded-full blur-[120px] pointer-events-none -z-10" />

            <div className="relative z-10 flex flex-col min-h-screen">
                {children}
            </div>

            {/* Global Feedback Floating Widget */}
            <FeedbackWidget />
        </div>
    );
};

export default Layout;
