import React, { useEffect, useState, useRef } from 'react';
import { BarChart3, Calendar, RotateCcw, Award, Flame, Activity, Clock, Bot, Zap, AlertTriangle, X } from 'lucide-react';
import { apiRequest } from '../config/apiClient';

const Progress = () => {
    const [stats, setStats] = useState({ study_hours: 0, quizzes_taken: 0, streak_days: 0 });
    const [heatmapData, setHeatmapData] = useState([]);
    const [chartImage, setChartImage] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const progressRequestGenRef = useRef(0);

    const [isResetting, setIsResetting] = useState(false);
    const [resetDialogOpen, setResetDialogOpen] = useState(false);
    const [resetConfirmationText, setResetConfirmationText] = useState('');
    const resetInProgressRef = useRef(false);
    const cancelButtonRef = useRef(null);

    const fetchAnalytics = async () => {
        if (resetInProgressRef.current) return;
        setLoading(true);
        setFetchError(null);

        const thisGen = ++progressRequestGenRef.current;
        try {
            const [progResult, heatResult, dashResult, sessResult] = await Promise.allSettled([
                apiRequest('/api/progress', { auth: 'required' }),
                apiRequest('/api/analytics/activity-heatmap', { auth: 'required' }),
                apiRequest('/api/analytics/dashboard', { auth: 'required' }),
                apiRequest('/api/sessions/history', { auth: 'required' })
            ]);

            if (thisGen !== progressRequestGenRef.current || resetInProgressRef.current) return;

            let hasErrors = false;
            if (progResult.status === 'fulfilled') {
                const data = progResult.value;
                if (data && typeof data === 'object') {
                    const rawHours = Number(data.study_hours);
                    const rawQuizzes = Number(data.quizzes_taken);
                    const rawStreak = Number(data.streak_days);
                    setStats({
                        study_hours: Number.isFinite(rawHours) && rawHours >= 0 ? rawHours : 0,
                        quizzes_taken: Number.isFinite(rawQuizzes) && rawQuizzes >= 0 ? Math.floor(rawQuizzes) : 0,
                        streak_days: Number.isFinite(rawStreak) && rawStreak >= 0 ? Math.floor(rawStreak) : 0
                    });
                } else {
                    setStats({ study_hours: 0, quizzes_taken: 0, streak_days: 0 });
                }
            } else {
                setStats({ study_hours: 0, quizzes_taken: 0, streak_days: 0 });
                hasErrors = true;
            }

            if (heatResult.status === 'fulfilled') {
                const data = heatResult.value;
                setHeatmapData(Array.isArray(data) ? data : []);
            } else {
                setHeatmapData([]);
                hasErrors = true;
            }

            if (dashResult.status === 'fulfilled') {
                const data = dashResult.value;
                if (data && typeof data === 'object' && data.plot_base64) {
                    setChartImage(`data:image/png;base64,${data.plot_base64}`);
                } else {
                    setChartImage(null);
                }
            } else {
                setChartImage(null);
            }

            if (sessResult.status === 'fulfilled') {
                const data = sessResult.value;
                setSessions(Array.isArray(data) ? data : []);
            } else {
                setSessions([]);
                hasErrors = true;
            }

            if (hasErrors) {
                setFetchError('Some analytics data could not be retrieved from the server.');
            }
            setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        } catch (err) {
            console.error("Analytics fetch error:", err);
            if (thisGen === progressRequestGenRef.current) {
                setFetchError('Failed to load study analytics.');
            }
        } finally {
            if (thisGen === progressRequestGenRef.current) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, []);

    // Focus cancel button on reset dialog open
    useEffect(() => {
        if (resetDialogOpen) {
            setTimeout(() => cancelButtonRef.current?.focus(), 50);
        } else {
            setResetConfirmationText('');
        }
    }, [resetDialogOpen]);

    const handleConfirmReset = async () => {
        if (resetConfirmationText.trim().toUpperCase() !== 'RESET') return;
        setResetDialogOpen(false);
        setIsResetting(true);
        resetInProgressRef.current = true;
        const thisResetGen = ++progressRequestGenRef.current;

        try {
            await apiRequest('/api/progress/reset', {
                method: 'DELETE',
                auth: 'required',
                responseType: 'none',
            });
            if (thisResetGen !== progressRequestGenRef.current) return;
            setStats({ study_hours: 0, quizzes_taken: 0, streak_days: 0 });
            setChartImage(null);
            setSessions([]);
            setHeatmapData([]);
            resetInProgressRef.current = false;
            fetchAnalytics();
        } catch (err) {
            console.error("Reset error:", err);
            alert(err.kind === 'http'
                ? 'Failed to reset progress on server.'
                : 'Network error resetting progress.');
            resetInProgressRef.current = false;
            if (thisResetGen === progressRequestGenRef.current) {
                fetchAnalytics();
            }
        } finally {
            resetInProgressRef.current = false;
            setIsResetting(false);
        }
    };

    const getActivityIcon = (type) => {
        switch (type) {
            case 'timer_focus':
                return <Clock className="w-4 h-4 text-emerald-400" />;
            case 'quiz':
                return <Zap className="w-4 h-4 text-emerald-400" />;
            case 'ai_chat':
                return <Bot className="w-4 h-4 text-emerald-400" />;
            default:
                return <Activity className="w-4 h-4 text-slate-400" />;
        }
    };

    const formatActivityName = (type) => {
        switch (type) {
            case 'timer_focus':
                return 'Pomodoro Deep Focus';
            case 'quiz':
                return 'Quiz Assessment';
            case 'ai_chat':
                return 'AI Tutor Chat Session';
            default:
                return type;
        }
    };

    // Heatmap summary calculations
    const totalSessionsInHeatmap = (heatmapData || []).reduce((acc, curr) => acc + (Number(curr?.count) || 0), 0);
    const activeDaysCount = (heatmapData || []).filter(curr => (Number(curr?.count) || 0) > 0).length;
    const avgSessionsPerDay = heatmapData && heatmapData.length > 0 ? (totalSessionsInHeatmap / heatmapData.length).toFixed(1) : '0.0';

    return (
        <div className="py-8 sm:py-12 min-h-screen">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
                {/* Header (FIX-07: Only Refresh in Header) */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-6 border-b border-white/10">
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs mb-2">
                            <Activity className="w-3.5 h-3.5" />
                            <span>Learning Activity & Milestones</span>
                        </div>
                        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                            Study Analytics & Learning Progress
                        </h1>
                        <p className="text-slate-400 text-xs sm:text-sm mt-1">
                            Real-time focus tracking, learning metrics, and assessment history across all study sessions.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchAnalytics}
                            disabled={loading}
                            className="px-4 py-2.5 rounded-xl glass-panel text-slate-300 hover:text-white font-mono text-xs flex items-center gap-2 transition-all cursor-pointer border border-white/15 focus-visible:ring-2 focus-visible:ring-emerald-500/70"
                        >
                            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>

                {fetchError && (
                    <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-800/50 text-amber-300 text-xs font-mono flex items-center justify-between">
                        <span>⚠️ {fetchError}</span>
                        <button onClick={() => setFetchError(null)} className="text-slate-400 hover:text-white px-2">✕</button>
                    </div>
                )}

                {/* Metrics Grid (FIX-12: micro-label, value + unit, insight line) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="glass-panel p-6 rounded-3xl relative overflow-hidden border border-white/10">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">Active Streak</span>
                            <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/20">
                                <Flame className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono my-1">
                            {stats.streak_days} <span className="text-sm font-sans font-normal text-slate-400">days</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                            {stats.streak_days > 0 ? `${stats.streak_days} consecutive days completed` : 'Start a study session to begin your streak'}
                        </p>
                    </div>

                    <div className="glass-panel p-6 rounded-3xl relative overflow-hidden border border-white/10">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">Total Hours Studied</span>
                            <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/20">
                                <Calendar className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono my-1">
                            {stats.study_hours} <span className="text-sm font-sans font-normal text-slate-400">hours</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                            {stats.study_hours > 0 ? `Cumulative study time logged across tools` : 'Use the Focus Timer or Chat to log hours'}
                        </p>
                    </div>

                    <div className="glass-panel p-6 rounded-3xl relative overflow-hidden border border-white/10">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">Assessments</span>
                            <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/20">
                                <Award className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono my-1">
                            {stats.quizzes_taken} <span className="text-sm font-sans font-normal text-slate-400">quizzes</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                            {stats.quizzes_taken > 0 ? `${stats.quizzes_taken} quizzes attempted` : 'Generate an interactive quiz to test knowledge'}
                        </p>
                    </div>
                </div>

                {/* GitHub-Style Full-Width Activity Heatmap (FIX-06) */}
                <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-white/10">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-emerald-400" />
                            <h2 className="text-sm font-bold text-white font-mono">Activity Heatmap (16 Weeks)</h2>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                            <span>0</span>
                            <span className="w-3 h-3 rounded-[3px] bg-white/[0.06] border border-white/[0.08]" />
                            <span className="w-3 h-3 rounded-[3px] bg-emerald-950/70 border border-emerald-800/40" />
                            <span className="w-3 h-3 rounded-[3px] bg-emerald-800 border border-emerald-600/50" />
                            <span className="w-3 h-3 rounded-[3px] bg-emerald-600 border border-emerald-400/60" />
                            <span className="w-3 h-3 rounded-[3px] bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            <span>5+</span>
                        </div>
                    </div>
                    
                    {/* Heatmap Grid & Right-Hand Summary Block (Full Width utilization) */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center">
                        <div className="lg:col-span-3 overflow-x-auto pb-2">
                            <div className="grid grid-flow-col grid-rows-7 gap-1.5 min-w-[500px]">
                                {Array.from({ length: 16 }).flatMap((_, weekIdx) => {
                                    const weekDays = (heatmapData || []).slice(weekIdx * 7, (weekIdx + 1) * 7);
                                    return (weekDays.length > 0 ? weekDays : Array.from({ length: 7 })).map((day, dayIdx) => {
                                        const isDayObj = day && typeof day === 'object';
                                        const rawIntensity = isDayObj ? day.intensity : 0;
                                        const parsedIntensity = Number(rawIntensity);
                                        const intensity = Number.isFinite(parsedIntensity)
                                            ? Math.max(0, Math.min(4, Math.floor(parsedIntensity)))
                                            : 0;
                                        const dateLabel = isDayObj ? day.date : `Week ${weekIdx + 1}`;
                                        const countLabel = isDayObj ? day.count : 0;
                                        const durationLabel = isDayObj ? day.duration_minutes : 0;

                                        const colors = [
                                            'bg-white/[0.06] border border-white/[0.08] hover:border-white/20',
                                            'bg-emerald-950/80 border border-emerald-800/50',
                                            'bg-emerald-800 border border-emerald-600/50',
                                            'bg-emerald-600 border border-emerald-400/60',
                                            'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                        ];

                                        return (
                                            <div
                                                key={`${weekIdx}-${dayIdx}`}
                                                title={`${dateLabel}: ${countLabel} sessions (${durationLabel}m)`}
                                                className={`w-full aspect-square min-w-[12px] min-h-[12px] rounded-[3px] transition-all cursor-pointer ${colors[intensity]}`}
                                            />
                                        );
                                    });
                                })}
                            </div>
                        </div>

                        {/* Summary Metrics Block */}
                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3 font-mono text-xs">
                            <div className="flex justify-between items-center text-slate-400">
                                <span>Active Days:</span>
                                <span className="text-white font-bold">{activeDaysCount} days</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-400">
                                <span>Total Sessions:</span>
                                <span className="text-emerald-400 font-bold">{totalSessionsInHeatmap}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-400">
                                <span>Avg Sessions / Day:</span>
                                <span className="text-white font-bold">{avgSessionsPerDay}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-400">
                                <span>Best Streak:</span>
                                <span className="text-amber-400 font-bold">{stats.streak_days} days</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono text-slate-400 mt-4 pt-3 border-t border-white/5">
                        <span className="truncate">Data grouped by UTC Calendar Day</span>
                        <span className="truncate text-slate-400">
                            Updated {lastUpdated ? lastUpdated : 'recently'}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Recent Sessions Table */}
                    <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10">
                        <div className="flex items-center justify-between mb-6 pb-3 border-b border-white/10">
                            <div>
                                <h2 className="text-base font-bold text-white flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-emerald-400" />
                                    Recent Study Sessions Log
                                </h2>
                                <p className="text-xs text-slate-400 mt-0.5">Saved to your personal study history</p>
                            </div>
                            <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-semibold">{sessions.length} Logged</span>
                        </div>

                        {sessions.length > 0 ? (
                            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                                {sessions.map((s) => (
                                    <div key={s.id} className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-xl bg-slate-800/80">
                                                {getActivityIcon(s.activity_type)}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-slate-200">{formatActivityName(s.activity_type)}</div>
                                                <div className="text-xs font-mono text-slate-400">
                                                    {s.created_at ? new Date(s.created_at).toLocaleString() : 'Recent'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="font-mono text-emerald-400 font-bold">
                                            {s.duration_seconds > 0 ? `${Math.round(s.duration_seconds / 60)} min` : '< 1 min'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-60 flex flex-col items-center justify-center text-slate-400 font-mono text-xs">
                                <Clock className="w-8 h-8 text-slate-600 mb-2" />
                                <span>No sessions recorded yet. Start a study session.</span>
                            </div>
                        )}
                    </div>

                    {/* Visual Activity Graph */}
                    <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-6 pb-3 border-b border-white/10">
                                <div>
                                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                                        <BarChart3 className="w-4 h-4 text-emerald-400" />
                                        Activity Distribution Chart
                                    </h2>
                                    <p className="text-xs text-slate-400 font-mono mt-0.5">Statistical session breakdown</p>
                                </div>
                                <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">LIVE</span>
                            </div>

                            {chartImage ? (
                                <div className="flex justify-center bg-slate-950/70 p-3 rounded-2xl border border-slate-900 overflow-hidden">
                                    <img src={chartImage} alt="Study Activity Analytics" className="max-h-64 rounded-xl object-contain" />
                                </div>
                            ) : (
                                <div className="h-60 flex flex-col items-center justify-center text-slate-400 font-mono text-xs border border-dashed border-slate-800 rounded-2xl">
                                    <BarChart3 className="w-8 h-8 text-slate-600 mb-2" />
                                    <span>Visual chart generates automatically after your sessions.</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Danger Zone: Dedicated bottom section for destructive reset (FIX-07) */}
                <div className="p-6 rounded-3xl border border-rose-500/30 bg-rose-950/10 space-y-4">
                    <div className="flex items-center gap-2 text-rose-400">
                        <AlertTriangle className="w-5 h-5" />
                        <h3 className="text-sm font-bold font-mono uppercase tracking-wider">Danger Zone</h3>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                        Resetting your progress permanently clears all recorded study sessions, activity streaks, quiz scores, and heatmap statistics from your account. This action cannot be undone.
                    </p>
                    <div>
                        <button
                            type="button"
                            onClick={() => setResetDialogOpen(true)}
                            className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono text-xs font-bold transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-500/70"
                        >
                            Reset Data...
                        </button>
                    </div>
                </div>
            </div>

            {/* Accessible Confirmation Modal (FIX-07) */}
            {resetDialogOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="reset-dialog-title"
                    className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setResetDialogOpen(false)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') setResetDialogOpen(false);
                    }}
                >
                    <div
                        className="glass-panel max-w-md w-full rounded-3xl p-6 sm:p-8 border border-rose-500/40 shadow-2xl space-y-5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between pb-3 border-b border-rose-500/20">
                            <div className="flex items-center gap-2.5 text-rose-400">
                                <AlertTriangle className="w-5 h-5" />
                                <h3 id="reset-dialog-title" className="text-base font-bold text-white">
                                    Confirm Progress Reset
                                </h3>
                            </div>
                            <button
                                onClick={() => setResetDialogOpen(false)}
                                className="p-1.5 rounded-xl bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
                            Are you sure you want to reset your study analytics? All logs, heatmap events, and streaks will be erased.
                        </p>

                        <div className="space-y-2">
                            <label className="text-xs font-mono text-slate-400">
                                Type <span className="text-rose-400 font-bold">RESET</span> to confirm:
                            </label>
                            <input
                                type="text"
                                value={resetConfirmationText}
                                onChange={(e) => setResetConfirmationText(e.target.value)}
                                placeholder="RESET"
                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-slate-100 font-mono text-xs focus:outline-none focus:border-rose-500"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                ref={cancelButtonRef}
                                type="button"
                                onClick={() => setResetDialogOpen(false)}
                                className="px-4 py-2 rounded-xl bg-slate-900 border border-white/15 text-slate-300 hover:text-white font-mono text-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500/70"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmReset}
                                disabled={resetConfirmationText.trim().toUpperCase() !== 'RESET' || isResetting}
                                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {isResetting ? 'Resetting...' : 'Yes, Delete All Data'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Progress;
