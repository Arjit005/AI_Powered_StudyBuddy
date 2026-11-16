import React, { useState } from 'react';
import { Zap, CheckCircle2, XCircle, Award, RotateCcw, Save, Check } from 'lucide-react';
import confetti from 'canvas-confetti';

const Quiz = () => {
    const [topic, setTopic] = useState('');
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(false);
    const [answers, setAnswers] = useState({});
    const [submitted, setSubmitted] = useState(false);
    const [savedSuccess, setSavedSuccess] = useState(false);
    const [saving, setSaving] = useState(false);
    const [activityLogged, setActivityLogged] = useState(false);
    const [error, setError] = useState('');

    const generateQuiz = async () => {
        if (!topic.trim() || saving || loading) return;
        setLoading(true);
        setQuiz(null);
        setAnswers({});
        setSubmitted(false);
        setActivityLogged(false);
        setError('');

        try {
            const token = localStorage.getItem('auth_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch('/api/generate-quiz', {
                method: 'POST',
                headers,
                body: JSON.stringify({ topic: topic.trim() })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.detail || 'Failed to generate quiz');
            }
            const data = await response.json();
            if (!data || !Array.isArray(data.questions) || data.questions.length === 0) {
                throw new Error('AI engine returned no questions. Please try another topic.');
            }
            const validQuestions = data.questions
                .filter(q => q && typeof q.question === 'string' && Array.isArray(q.options) && q.options.length >= 2)
                .map(q => {
                    const rawAnswer = String(q.correct_answer || q.answer || '').trim();
                    if (!rawAnswer) return null;
                    const normalizedOptions = q.options.map(opt => String(opt).trim());
                    // Reject questions with duplicate options
                    if (new Set(normalizedOptions).size !== normalizedOptions.length) return null;
                    // Find option matching rawAnswer strictly (exact match case-insensitively)
                    const matchingOption = normalizedOptions.find(opt => opt.toLowerCase() === rawAnswer.toLowerCase());
                    if (!matchingOption) return null;
                    return {
                        ...q,
                        question: q.question.trim(),
                        options: normalizedOptions,
                        correct_answer: matchingOption,
                        answer: matchingOption
                    };
                })
                .filter(Boolean);

            if (validQuestions.length === 0) {
                throw new Error('Received malformed quiz questions. Please regenerate.');
            }
            setQuiz({ ...data, questions: validQuestions, instanceId: Date.now() });

            // Track activity non-blocking in background
            fetch('/api/track-activity', {
                method: 'POST',
                headers,
                body: JSON.stringify({ activity_type: 'quiz', duration_seconds: 120 })
            }).then(actRes => {
                setActivityLogged(actRes.ok);
            }).catch(() => {
                setActivityLogged(false);
            });
        } catch (err) {
            setError(err.message || 'Error creating quiz.');
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (qIdx, option) => {
        if (submitted) return;
        setAnswers(prev => ({ ...prev, [qIdx]: option }));
    };

    const calculateScore = () => {
        if (!quiz || !quiz.questions) return 0;
        let score = 0;
        quiz.questions.forEach((q, idx) => {
            const correctAnswer = String(q.correct_answer || q.answer || '').trim().toLowerCase();
            const selectedAnswer = String(answers[idx] || '').trim().toLowerCase();
            if (selectedAnswer && selectedAnswer === correctAnswer) {
                score++;
            }
        });
        return score;
    };

    const handleSubmitQuiz = () => {
        setSubmitted(true);
        const score = calculateScore();
        const total = quiz?.questions?.length || 0;
        // Trigger celebration confetti if score >= 70%
        if (total > 0 && score / total >= 0.7) {
            try {
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 }
                });
            } catch (_) {}
        }
    };

    const handleSaveQuiz = async () => {
        if (!quiz || !quiz.questions || quiz.questions.length === 0 || saving) return;
        const currentInstanceId = quiz.instanceId;
        setSaving(true);
        try {
            const token = localStorage.getItem('auth_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const score = calculateScore();
            const res = await fetch('/api/library', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    material_type: 'quiz',
                    title: `Quiz: ${topic || 'Practice Assessment'} (${score}/${quiz.questions.length})`,
                    topic: topic || 'Quiz',
                    content_json: JSON.stringify({
                        topic,
                        score,
                        total: quiz.questions.length,
                        questions: quiz.questions,
                        user_answers: answers
                    }),
                    tags: 'quiz,mcq,assessment'
                })
            });

            if (res.ok) {
                if (quiz?.instanceId === currentInstanceId) {
                    setSavedSuccess(true);
                    setTimeout(() => setSavedSuccess(false), 3000);
                }
            } else {
                alert('Could not save quiz to personal library.');
            }
        } catch (err) {
            alert('Failed to save quiz: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="py-12 min-h-screen">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 mb-3 shadow-[0_0_20px_rgba(245,158,11,0.25)]">
                        <Zap className="w-7 h-7" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
                        Dynamic MCQ Quiz Engine
                    </h1>
                    <p className="text-slate-400 text-sm max-w-lg mx-auto">
                        Evaluate comprehension on any concept with AI-generated questions and instant feedback.
                    </p>
                </div>

                {error && (
                    <div className="max-w-md mx-auto mb-6 p-4 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs">
                        {error}
                    </div>
                )}

                {/* Generator Form */}
                {!quiz && (
                    <div className="glass-panel p-8 rounded-3xl max-w-lg mx-auto border border-white/10 shadow-2xl text-center">
                        <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
                            Enter Subject or Topic
                        </label>
                        <input
                            type="text"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !loading && generateQuiz()}
                            disabled={loading}
                            placeholder="e.g. Operating Systems Concurrency, Docker, Calculus"
                            className="w-full px-4 py-3.5 rounded-xl glass-input text-sm font-mono placeholder:text-slate-500 mb-4 disabled:opacity-50"
                        />
                        <button
                            onClick={generateQuiz}
                            disabled={loading || !topic.trim()}
                            className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:brightness-110 active:scale-95 transition-all shadow-[0_0_25px_rgba(16,185,129,0.3)] disabled:opacity-40"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                                    Synthesizing Quiz Questions...
                                </span>
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    <Zap className="w-4 h-4" /> Generate Quiz
                                </span>
                            )}
                        </button>
                    </div>
                )}

                {/* Active Quiz Card */}
                {quiz && quiz.questions && (
                    <div className="space-y-6">
                        {/* Quiz Progress & Stats */}
                        <div className="glass-panel p-4 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-emerald-400 font-bold uppercase">{topic}</span>
                                <span className="text-xs text-slate-500">•</span>
                                <span className="text-xs font-mono text-slate-400">{quiz.questions.length} Questions</span>
                            </div>
                            <button
                                onClick={() => {
                                    setQuiz(null);
                                    setTopic('');
                                    setAnswers({});
                                    setSubmitted(false);
                                }}
                                className="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1.5"
                            >
                                <RotateCcw className="w-3.5 h-3.5" /> New Quiz
                            </button>
                        </div>

                        {/* Questions List */}
                        <div className="space-y-6">
                            {quiz.questions.map((q, idx) => {
                                const correctAnswer = q.answer || q.correct_answer;
                                const selectedOption = answers[idx];
                                const norm = (val) => String(val || '').trim().toLowerCase();
                                const isCorrect = submitted && norm(selectedOption) === norm(correctAnswer);
                                const isWrong = submitted && selectedOption && norm(selectedOption) !== norm(correctAnswer);

                                return (
                                    <div key={idx} className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4">
                                        <div className="flex items-start gap-3">
                                            <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                                                {idx + 1}
                                            </span>
                                            <h3 className="text-base font-semibold text-white leading-relaxed">
                                                {q.question}
                                            </h3>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2.5 pt-2">
                                            {q.options && q.options.map((option, optIdx) => {
                                                const isSelected = selectedOption === option;
                                                const isThisCorrect = submitted && norm(option) === norm(correctAnswer);
                                                const isThisWrong = submitted && isSelected && norm(option) !== norm(correctAnswer);

                                                let btnStyle = "glass-input text-slate-300 hover:bg-slate-800/60";
                                                if (isSelected && !submitted) {
                                                    btnStyle = "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]";
                                                }
                                                if (isThisCorrect) {
                                                    btnStyle = "bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]";
                                                } else if (isThisWrong) {
                                                    btnStyle = "bg-rose-950/80 border-rose-600 text-rose-300";
                                                }

                                                return (
                                                    <button
                                                        key={optIdx}
                                                        onClick={() => handleSelect(idx, option)}
                                                        disabled={submitted}
                                                        className={`p-3.5 rounded-xl text-left text-sm font-mono transition-all flex items-center justify-between border ${btnStyle}`}
                                                    >
                                                        <span>{option}</span>
                                                        {isThisCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                                                        {isThisWrong && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {submitted && q.explanation && (
                                            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 font-mono">
                                                <span className="text-emerald-400 font-bold">Explanation: </span>
                                                {q.explanation}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Submission Bar / Results */}
                        <div className="sticky bottom-6 glass-panel-glow p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                            {!submitted ? (
                                <>
                                    <div className="text-xs font-mono text-slate-400">
                                        Answered: <span className="text-emerald-400 font-bold">{Object.keys(answers).length}</span> of {quiz.questions.length}
                                    </div>
                                    <button
                                        onClick={handleSubmitQuiz}
                                        disabled={Object.keys(answers).length === 0}
                                        className="w-full sm:w-auto px-8 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-40"
                                    >
                                        Submit & Calculate Score
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center gap-3">
                                        <Award className="w-6 h-6 text-amber-400" />
                                        <div>
                                            <div className="text-sm font-bold text-white">
                                                Final Score: {calculateScore()} / {quiz.questions.length} ({quiz.questions.length > 0 ? Math.round((calculateScore() / quiz.questions.length) * 100) : 0}%)
                                            </div>
                                            <div className="text-xs font-mono text-slate-400">
                                                {activityLogged ? 'Activity logged to your study dashboard.' : 'Assessment complete.'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        <button
                                            onClick={handleSaveQuiz}
                                            disabled={saving}
                                            className="px-5 py-2.5 rounded-xl font-mono text-xs bg-slate-900 border border-slate-700 hover:border-emerald-500 text-emerald-400 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                                            title="Save Quiz & answers to Library"
                                        >
                                            {savedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
                                            <span>{savedSuccess ? 'Saved' : saving ? 'Saving...' : 'Save Quiz'}</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                setQuiz(null);
                                                setAnswers({});
                                                setSubmitted(false);
                                            }}
                                            disabled={saving}
                                            className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl font-mono text-xs bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300 transition-all text-center disabled:opacity-50"
                                        >
                                            Practice Another Topic
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Quiz;
