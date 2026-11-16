import React, { useState, useRef, useEffect } from 'react';
import { MessageSquarePlus, Star, Send, X, CheckCircle2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const FeedbackWidget = () => {
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const closeTimerRef = useRef(null);
    const isOpenRef = useRef(false);
    const abortControllerRef = useRef(null);
    const submissionSessionRef = useRef(0);

    useEffect(() => {
        isOpenRef.current = isOpen;
    }, [isOpen]);

    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            if (closeTimerRef.current) {
                clearTimeout(closeTimerRef.current);
            }
        };
    }, []);

    const handleOpen = () => {
        submissionSessionRef.current += 1;
        isOpenRef.current = true;
        setIsOpen(true);
    };

    const handleClose = () => {
        submissionSessionRef.current += 1;
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
        isOpenRef.current = false;
        setSubmitting(false);
        setSubmitted(false);
        setComment('');
        setSubmitError(null);
        setIsOpen(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        setSubmitError(null);
        const thisSession = submissionSessionRef.current;
        const controller = new AbortController();
        abortControllerRef.current = controller;
        try {
            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    page: location.pathname,
                    rating,
                    comment
                })
            });
            if (thisSession !== submissionSessionRef.current || !isOpenRef.current) return;
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || 'Feedback submission failed');
            }
            if (thisSession !== submissionSessionRef.current || !isOpenRef.current) return;
            setSubmitted(true);
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
            closeTimerRef.current = setTimeout(() => {
                if (thisSession === submissionSessionRef.current) {
                    setSubmitted(false);
                    setIsOpen(false);
                    isOpenRef.current = false;
                    setComment('');
                    closeTimerRef.current = null;
                }
            }, 2500);
        } catch (err) {
            if (err.name === 'AbortError' || thisSession !== submissionSessionRef.current) return;
            console.error("Feedback error:", err);
            if (isOpenRef.current) {
                setSubmitError(err.message || 'Submission failed. Please try again.');
            }
        } finally {
            if (thisSession === submissionSessionRef.current) {
                setSubmitting(false);
            }
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50">
            {!isOpen ? (
                <button
                    onClick={handleOpen}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:scale-105 transition-all group cursor-pointer"
                    title="Send Feedback"
                >
                    <MessageSquarePlus className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                    <span>Feedback</span>
                </button>
            ) : (
                <div className="glass-panel w-80 p-5 rounded-3xl border border-emerald-500/40 shadow-2xl relative animate-in fade-in slide-in-from-bottom-4 duration-200">
                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-2 mb-3">
                        <MessageSquarePlus className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-white">Rate Your Experience</h4>
                    </div>

                    {submitted ? (
                        <div className="py-8 text-center space-y-2">
                            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
                            <div className="text-sm font-bold text-white">Thank You!</div>
                            <p className="text-xs text-slate-400">Your feedback helps us improve Study Buddy.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="flex items-center justify-center gap-1.5 py-2 bg-slate-900/60 rounded-xl border border-slate-800">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        type="button"
                                        key={star}
                                        onClick={() => setRating(star)}
                                        className="p-1 hover:scale-125 transition-transform"
                                    >
                                        <Star
                                            className={`w-5 h-5 ${
                                                star <= rating
                                                    ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                                                    : 'text-slate-600'
                                            }`}
                                        />
                                    </button>
                                ))}
                            </div>

                            <div>
                                <textarea
                                    rows="3"
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder="What went well? Any features you'd love to see?"
                                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-emerald-500 font-sans"
                                ></textarea>
                            </div>

                            {submitError && (
                                <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-[11px] leading-tight">
                                    {submitError}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs hover:from-emerald-400 hover:to-teal-400 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-1.5"
                            >
                                <Send className="w-3.5 h-3.5" />
                                <span>{submitting ? 'Sending...' : 'Submit Feedback'}</span>
                            </button>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
};

export default FeedbackWidget;
