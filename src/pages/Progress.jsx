import React, { useEffect, useState, useRef } from 'react';
import { BarChart3, Calendar, RotateCcw, Award, Flame, Activity, Clock, Bot, Zap } from 'lucide-react';

const Progress = () => {
    const [stats, setStats] = useState({ study_hours: 0, quizzes_taken: 0, streak_days: 0 });
    const [heatmapData, setHeatmapData] = useState([]);
    const [chartImage, setChartImage] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const progressRequestGenRef = useRef(0);

    const fetchAnalytics = async () => {
        setLoading(true);
        setFetchError(null);
        const token = localStorage.getItem('auth_token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const thisGen = ++progressRequestGenRef.current;
        try {
            const [progRes, heatRes, dashRes, sessRes] = await Promise.all([
                fetch('/api/progress', { headers }),
                fetch('/api/analytics/activity-heatmap', { headers }),
                fetch('/api/analytics/dashboard', { headers }),
                fetch('/api/sessions/history', { headers })
            ]);

            if (thisGen !== progressRequestGenRef.current) return;

            let hasErrors = false;
            if (progRes.ok) {
                const data = await progRes.json();
                if (thisGen !== progressRequestGenRef.current) return;
                setStats(data);
            } else {
                setStats({ study_hours: 0, quizzes_taken: 0, streak_days: 0 });
                hasErrors = true;
            }

            if (heatRes.ok) {
                const data = await heatRes.json();
                if (thisGen !== progressRequestGenRef.current) return;
                if (data && Array.isArray(data.days)) {
                    setHeatmapData(data.days);
                } else {
                    setHeatmapData([]);
                }
            } else {
                setHeatmapData([]);
                hasErrors = true;
            }

            if (dashRes.ok) {
                const data = await dashRes.json();
                if (thisGen !== progressRequestGenRef.current) return;
                if (data && data.chart) {
                    setChartImage(`data:image/png;base64,${data.chart}`);
                } else {
                    setChartImage(null);
                }
            } else {
                setChartImage(null);
                hasErrors = true;
            }

            if (sessRes.ok) {
                const data = await sessRes.json();
                if (thisGen !== progressRequestGenRef.current) return;
                if (Array.isArray(data)) {
                    setSessions(data);
                } else {
                    setSessions([]);
                }
            } else {
                setSessions([]);
                hasErrors = true;
            }

            if (hasErrors) {
                setFetchError("Some analytics modules were temporarily unavailable.");
            }
        } catch (err) {
            console.error("Error fetching progress batch:", err);
            if (thisGen === progressRequestGenRef.current) {
                setFetchError("Network error while loading analytics.");
            }
        } finally {
            if (thisGen === progressRequestGenRef.current) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        fetchAnalytics();
        return () => {
            progressRequestGenRef.current++;
        };
    }, []);

    const resetStats = async () => {
        if (!confirm("Are you sure you want to reset all recorded study progress?")) return;
        progressRequestGenRef.current++;
        const token = localStorage.getItem('auth_token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        try {
            const res = await fetch('/api/progress', { method: 'DELETE', headers });
            if (res.ok) {
                setStats({ study_hours: 0, quizzes_taken: 0, streak_days: 0 });
                setChartImage(null);
                setSessions([]);
                fetchAnalytics();
            } else {
                setLoading(false);
                alert("Failed to reset progress on server.");
            }
        } catch (err) {
            setLoading(false);
            console.error("Reset error:", err);
            alert("Network error resetting progress.");
        }
    };

    const getActivityIcon = (type) => {
        switch (type) {
            case 'timer_focus':
                return <Clock className="w-4 h-4 text-emerald-400" />;
            case 'quiz':
                return <Zap className="w-4 h-4 text-amber-400" />;
            case 'ai_chat':
                return <Bot className="w-4 h-4 text-cyan-400" />;
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

    return (
        <div className="py-12 min-h-screen">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-6 border-b border-white/5">
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs mb-2">
                            <Activity className="w-3.5 h-3.5" />
                            <span>Learning Activity & Milestones</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                            Study Analytics & Learning Progress
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">
                            Real-time focus tracking, learning metrics, and assessment history across all study sessions.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchAnalytics}
                            className="px-3.5 py-2 rounded-xl glass-panel text-slate-300 hover:text-white font-mono text-xs flex items-center gap-1.5 transition-all"
                        >
                            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                        </button>
                        <button
                            onClick={resetStats}
                            className="px-3.5 py-2 rounded-xl bg-rose-950/40 border border-rose-800/50 hover:bg-rose-900/40 text-rose-300 font-mono text-xs transition-all"
                        >
                            Reset Data
                        </button>
                    </div>
                </div>

                {fetchError && (
                    <div className="mb-6 p-3 rounded-xl bg-amber-950/50 border border-amber-800/50 text-amber-300 text-xs font-mono flex items-center justify-between">
                        <span>⚠️ {fetchError}</span>
                        <button onClick={() => setFetchError(null)} className="text-slate-400 hover:text-white px-2">✕</button>
                    </div>
                )}

                {/* Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <div className="glass-panel p-6 rounded-3xl relative overflow-hidden border border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center border border-amber-500/30">
                                <Flame className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-mono text-amber-400 font-bold px-2 py-0.5 rounded-full bg-amber-500/10">Active Streak</span>
                        </div>
                        <p className="text-xs font-mono text-slate-400 mb-1">Consecutive Day Streak</p>
                        <div className="text-4xl font-extrabold text-white font-mono">
                            {stats.streak_days} <span className="text-sm font-sans font-normal text-slate-500">days</span>
                        </div>
                    </div>

                    <div className="glass-panel p-6 rounded-3xl relative overflow-hidden border border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-500/30">
                                <Calendar className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-mono text-emerald-400 font-bold px-2 py-0.5 rounded-full bg-emerald-500/10">Deep Work</span>
                        </div>
                        <p className="text-xs font-mono text-slate-400 mb-1">Total Hours Studied</p>
                        <div className="text-4xl font-extrabold text-white font-mono">
                            {stats.study_hours} <span className="text-sm font-sans font-normal text-slate-500">hours</span>
                        </div>
                    </div>

                    <div className="glass-panel p-6 rounded-3xl relative overflow-hidden border border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-teal-500/20 text-teal-400 rounded-2xl flex items-center justify-center border border-teal-500/30">
                                <Award className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-mono text-teal-400 font-bold px-2 py-0.5 rounded-full bg-teal-500/10">Assessments</span>
                        </div>
                        <p className="text-xs font-mono text-slate-400 mb-1">Total Quizzes Attempted</p>
                        <div className="text-4xl font-extrabold text-white font-mono">
                            {stats.quizzes_taken} <span className="text-sm font-sans font-normal text-slate-500">quizzes</span>
                        </div>
                    </div>
                </div>

                {/* GitHub-Style Study Activity Heatmap */}
                <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 mb-8">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-emerald-400" />
                            <h2 className="text-sm font-bold text-white font-mono">Verified Activity Heatmap (16 Weeks)</h2>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                            <span>0</span>
                            <span className="w-2.5 h-2.5 rounded bg-slate-800/80" />
                            <span className="w-2.5 h-2.5 rounded bg-emerald-950 border border-emerald-800/40" />
                            <span className="w-2.5 h-2.5 rounded bg-emerald-800" />
                            <span className="w-2.5 h-2.5 rounded bg-emerald-600" />
                            <span className="w-2.5 h-2.5 rounded bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                            <span>5+</span>
                        </div>
                    </div>
                    
                    {/* Real Database-Aggregated 16-Week Grid */}
                    <div className="flex gap-1.5 overflow-x-auto pb-2">
                        {Array.from({ length: 16 }).map((_, weekIdx) => {
                            const weekDays = heatmapData.slice(weekIdx * 7, (weekIdx + 1) * 7);
                            return (
                                <div key={weekIdx} className="flex flex-col gap-1.5">
                                    {(weekDays.length > 0 ? weekDays : Array.from({ length: 7 })).map((day, dayIdx) => {
                                        const isDayObj = day && typeof day === 'object';
                                        const rawIntensity = isDayObj ? day.intensity : 0;
                                        const intensity = Math.max(0, Math.min(4, Math.floor(rawIntensity || 0)));
                                        const dateLabel = isDayObj ? day.date : `Day ${dayIdx}`;
                                        const countLabel = isDayObj ? day.count : 0;
                                        const durationLabel = isDayObj ? day.duration_minutes : 0;

                                        const colors = [
                                            'bg-slate-800/60 hover:bg-slate-700/80',
                                            'bg-emerald-950 border border-emerald-800/40',
                                            'bg-emerald-800 border border-emerald-600/50',
                                            'bg-emerald-600 border border-emerald-400/60',
                                            'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                                        ];

                                        return (
                                            <div
                                                key={dayIdx}
                                                title={`${dateLabel}: ${countLabel} study sessions (${durationLabel} mins)`}
                                                className={`w-3.5 h-3.5 rounded-[3px] transition-all cursor-pointer ${colors[intensity]}`}
                                            />
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mt-3">
                        <span>Data grouped by UTC Calendar Day</span>
                        <span>Source: Verified PostgreSQL study_sessions</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    {/* Recent Sessions Table */}
                    <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5">
                        <div className="flex items-center justify-between mb-6 pb-3 border-b border-white/5">
                            <div>
                                <h2 className="text-base font-bold text-white flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-emerald-400" />
                                    Recent Study Sessions Log
                                </h2>
                                <p className="text-xs text-slate-400 font-mono mt-0.5">Persisted in SQLite database</p>
                            </div>
                            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">{sessions.length} Logged</span>
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
                                                <div className="text-[11px] font-mono text-slate-500">
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
                            <div className="h-60 flex flex-col items-center justify-center text-slate-600 font-mono text-xs">
                                <Clock className="w-8 h-8 text-slate-700 mb-2" />
                                <span>No study sessions recorded yet. Start a chat or focus timer!</span>
                            </div>
                        )}
                    </div>

                    {/* Visual Activity Graph */}
                    <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-6 pb-3 border-b border-white/5">
                                <div>
                                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                                        <BarChart3 className="w-4 h-4 text-emerald-400" />
                                        Activity Distribution Chart
                                    </h2>
                                    <p className="text-xs text-slate-400 font-mono mt-0.5">Pandas + Matplotlib rendering</p>
                                </div>
                                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">LIVE</span>
                            </div>

                            {chartImage ? (
                                <div className="flex justify-center bg-slate-950/70 p-3 rounded-2xl border border-slate-900 overflow-hidden">
                                    <img src={chartImage} alt="Study Activity Analytics" className="max-h-64 rounded-xl object-contain" />
                                </div>
                            ) : (
                                <div className="h-60 flex flex-col items-center justify-center text-slate-600 font-mono text-xs border border-dashed border-slate-800 rounded-2xl">
                                    <BarChart3 className="w-8 h-8 text-slate-700 mb-2" />
                                    <span>Visual chart generates automatically after your sessions.</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Progress;
