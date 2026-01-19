
import React, { useState } from 'react';
import { Zap, CheckCircle, XCircle } from 'lucide-react';

const Quiz = () => {
    const [topic, setTopic] = useState('');
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(false);
    const [answers, setAnswers] = useState({});
    const [submitted, setSubmitted] = useState(false);

    const generateQuiz = async () => {
        if (!topic.trim()) return;
        setLoading(true);
        setQuiz(null);
        setAnswers({});
        setSubmitted(false);

        try {
            const response = await fetch('/api/generate-quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic })
            });

            if (!response.ok) throw new Error('API Error');
            const data = await response.json();
            setQuiz(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (qId, option) => {
        if (submitted) return;
        setAnswers(prev => ({ ...prev, [qId]: option }));
    };

    const handleSubmit = () => {
        setSubmitted(true);
    };

    return (
        <div className="pt-24 pb-12 min-h-screen bg-slate-50">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 mb-4">
                        <Zap className="w-8 h-8" />
                    </div>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">Quiz Generator</h1>
                    <p className="text-xl text-slate-600">Test your knowledge on any topic instantly.</p>
                </div>

                {!quiz && (
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md mx-auto">
                        <input
                            type="text"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="Enter a topic (e.g., Photosynthesis, Python)"
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 mb-4 text-center text-lg"
                        />
                        <button
                            onClick={generateQuiz}
                            disabled={loading || !topic.trim()}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-amber-500/20 disabled:opacity-50"
                        >
                            {loading ? 'Generating Quiz...' : 'Start Quiz'}
                        </button>
                    </div>
                )}

                {quiz && (
                    <div className="space-y-6">
                        {quiz.questions.map((q, idx) => (
                            <div key={q.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <h3 className="text-xl font-bold text-slate-900 mb-4">
                                    <span className="text-amber-500 mr-2">Q{idx + 1}.</span>
                                    {q.question}
                                </h3>
                                <div className="space-y-3">
                                    {q.options.map((opt) => (
                                        <div
                                            key={opt}
                                            onClick={() => handleSelect(q.id, opt)}
                                            className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between group ${submitted
                                                ? opt === q.answer
                                                    ? 'bg-green-50 border-green-200 text-green-700'
                                                    : answers[q.id] === opt
                                                        ? 'bg-red-50 border-red-200 text-red-700'
                                                        : 'bg-white border-slate-200 opacity-50'
                                                : answers[q.id] === opt
                                                    ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-sm'
                                                    : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-slate-50'
                                                }`}
                                        >
                                            <span className="font-medium">{opt}</span>
                                            {submitted && opt === q.answer && <CheckCircle className="w-5 h-5 text-green-600" />}
                                            {submitted && answers[q.id] === opt && opt !== q.answer && <XCircle className="w-5 h-5 text-red-600" />}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {!submitted && (
                            <div className="flex justify-end">
                                <button
                                    onClick={handleSubmit}
                                    className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg"
                                >
                                    Submit Answers
                                </button>
                            </div>
                        )}
                        {submitted && (
                            <div className="text-center p-8 bg-slate-100 rounded-2xl">
                                <p className="text-xl font-bold text-slate-800">Quiz Completed!</p>
                                <button onClick={() => setQuiz(null)} className="mt-4 text-amber-600 font-semibold hover:underline">
                                    Try another topic
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Quiz;
