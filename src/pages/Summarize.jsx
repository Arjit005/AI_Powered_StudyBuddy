import React, { useState } from 'react';
import { FileText, ArrowRight, BookOpen } from 'lucide-react';

const Summarize = () => {
    const [topic, setTopic] = useState('');
    const [summary, setSummary] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSummarize = async () => {
        if (!topic.trim()) return;
        setIsLoading(true);
        try {
            const response = await fetch('/api/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: topic })
            });

            if (!response.ok) throw new Error('API Error');

            const data = await response.json();
            setSummary(data.summary);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="pt-24 pb-12 min-h-screen bg-slate-50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 mb-4">
                        <FileText className="w-8 h-8" />
                    </div>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">Topic Summarizer</h1>
                    <p className="text-xl text-slate-600">Enter a complex topic, and I'll explain it simply for you.</p>
                </div>

                <div className="grid gap-8 md:grid-cols-2">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Topic / Concept</label>
                        <textarea
                            className="w-full h-96 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none transition-all text-lg"
                            placeholder="e.g. Quantum Computing, The French Revolution..."
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                        ></textarea>
                        <button
                            onClick={handleSummarize}
                            disabled={isLoading || !topic.trim()}
                            className="mt-4 w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isLoading ? 'Generating Summary...' : 'Summarize Topic'}
                            {!isLoading && <ArrowRight className="w-5 h-5" />}
                        </button>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                        <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-indigo-600" />
                            AI Summary
                        </label>
                        <div className="w-full h-96 p-6 rounded-xl bg-slate-50 border border-slate-100 overflow-y-auto prose prose-slate">
                            {summary ? (
                                <p className="leading-relaxed text-slate-700">{summary}</p>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                    <FileText className="w-12 h-12 mb-2 opacity-20" />
                                    <p>Summary will appear here</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Summarize;
