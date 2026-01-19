
import React from 'react';
import { Check } from 'lucide-react';

const Pricing = () => {
    return (
        <div className="pt-24 pb-12 min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">Simple, Transparent Pricing</h1>
                    <p className="text-xl text-slate-600">Invest in your education with our affordable plans.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                    {/* Free Plan */}
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Basic</h3>
                        <p className="text-slate-500 mb-6">Essential study tools for everyone.</p>
                        <div className="text-4xl font-bold text-slate-900 mb-6">$0</div>
                        <button className="w-full py-3 px-4 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors mb-8">Current Plan</button>
                        <ul className="space-y-4">
                            {['5 AI Chats / day', 'Basic Summaries', '3 Quizzes / day', 'Timer'].map(feat => (
                                <li key={feat} className="flex items-center gap-3 text-slate-600">
                                    <Check className="w-5 h-5 text-green-500" /> {feat}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Pro Plan */}
                    <div className="bg-slate-900 p-8 rounded-2xl border border-slate-900 shadow-xl relative transform md:-translate-y-4">
                        <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl">POPULAR</div>
                        <h3 className="text-xl font-bold text-white mb-2">Pro Scholar</h3>
                        <p className="text-slate-400 mb-6">Unlock unlimited potential.</p>
                        <div className="text-4xl font-bold text-white mb-6">$9<span className="text-lg text-slate-400 font-normal">/mo</span></div>
                        <button className="w-full py-3 px-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors mb-8 shadow-lg shadow-blue-600/30">Upgrade Now</button>
                        <ul className="space-y-4">
                            {['Unlimited AI Chat (GPT-4)', 'Advanced Summarization', 'Unlimited Quizzes', 'Voice Notes', 'Progress Analytics'].map(feat => (
                                <li key={feat} className="flex items-center gap-3 text-slate-300">
                                    <Check className="w-5 h-5 text-blue-400" /> {feat}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Team Plan */}
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Study Group</h3>
                        <p className="text-slate-500 mb-6">Perfect for project teams.</p>
                        <div className="text-4xl font-bold text-slate-900 mb-6">$29<span className="text-lg text-slate-400 font-normal">/mo</span></div>
                        <button className="w-full py-3 px-4 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:border-slate-300 transition-colors mb-8">Contact Sales</button>
                        <ul className="space-y-4">
                            {['5 Team Members', 'Shared Notes', 'Collaborative Maps', 'Admin Dashboard', 'Priority Support'].map(feat => (
                                <li key={feat} className="flex items-center gap-3 text-slate-600">
                                    <Check className="w-5 h-5 text-green-500" /> {feat}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Pricing;
