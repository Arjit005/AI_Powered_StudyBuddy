import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Flame } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';
import { apiRequest } from '../config/apiClient';

const FOCUS_DURATION_SECONDS = 25 * 60;
const BREAK_DURATION_SECONDS = 5 * 60;
const TRACK_ACTIVITY_ENDPOINT = API_ENDPOINTS.TRACK_ACTIVITY;

const StudyTimer = () => {
    const [timeLeft, setTimeLeft] = useState(FOCUS_DURATION_SECONDS);
    const [isActive, setIsActive] = useState(false);
    const [mode, setMode] = useState('focus'); // 'focus' or 'break'
    const [trackingStatus, setTrackingStatus] = useState(null);
    const targetEndTimeRef = useRef(null);
    const totalTime = mode === 'focus' ? FOCUS_DURATION_SECONDS : BREAK_DURATION_SECONDS;

    useEffect(() => {
        if (!isActive) {
            targetEndTimeRef.current = null;
            return;
        }

        const interval = setInterval(() => {
            const now = Date.now();
            const diff = targetEndTimeRef.current - now;
            const remaining = Math.max(0, Math.ceil(diff / 1000));
            setTimeLeft(remaining);

            if (diff <= 0) {
                clearInterval(interval);
                setIsActive(false);
                targetEndTimeRef.current = null;

                const duration = mode === 'focus' ? FOCUS_DURATION_SECONDS : BREAK_DURATION_SECONDS;
                if (mode === 'focus' && remaining <= 0) {
                    apiRequest(TRACK_ACTIVITY_ENDPOINT, {
                        method: 'POST',
                        auth: 'required',
                        responseType: 'none',
                        json: { activity_type: 'timer_focus', duration_seconds: duration }
                    }).then(() => {
                        setTrackingStatus('Completed session recorded in analytics.');
                    }).catch(err => {
                        console.error("Failed to track time", err);
                        setTrackingStatus(err.kind === 'http'
                            ? 'Could not record session in analytics.'
                            : 'Network error while recording session.');
                    });
                }
            }
        }, 500);

        return () => clearInterval(interval);
    }, [isActive, mode]);

    const toggleTimer = () => {
        if (timeLeft <= 0) return;
        if (!isActive) {
            targetEndTimeRef.current = Date.now() + timeLeft * 1000;
            setIsActive(true);
        } else {
            if (targetEndTimeRef.current) {
                const now = Date.now();
                const remaining = Math.max(0, Math.ceil((targetEndTimeRef.current - now) / 1000));
                setTimeLeft(remaining);
            }
            targetEndTimeRef.current = null;
            setIsActive(false);
        }
    };

    const resetTimer = () => {
        targetEndTimeRef.current = null;
        setIsActive(false);
        setTimeLeft(mode === 'focus' ? FOCUS_DURATION_SECONDS : BREAK_DURATION_SECONDS);
    };

    const switchMode = (newMode) => {
        targetEndTimeRef.current = null;
        setMode(newMode);
        setIsActive(false);
        setTimeLeft(newMode === 'focus' ? FOCUS_DURATION_SECONDS : BREAK_DURATION_SECONDS);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const progressPercentage = ((totalTime - timeLeft) / totalTime) * 100;

    return (
        <div className="py-16 min-h-screen flex flex-col items-center justify-center">
            <div className="max-w-md w-full px-4">
                <div className="glass-panel-glow rounded-3xl p-8 sm:p-10 text-center relative overflow-hidden border border-emerald-500/30 shadow-2xl">
                    {/* Top Progress bar */}
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-800">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-1000"
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>

                    {/* Mode Selector */}
                    <div className="flex justify-center gap-1.5 mb-8 p-1.5 bg-slate-900/90 rounded-2xl border border-white/5 inline-flex">
                        <button
                            onClick={() => switchMode('focus')}
                            className={`px-6 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                                mode === 'focus'
                                    ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Focus Session (25m)
                        </button>
                        <button
                            onClick={() => switchMode('break')}
                            className={`px-6 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                                mode === 'break'
                                    ? 'bg-teal-400 text-slate-950 shadow-[0_0_15px_rgba(20,184,166,0.3)]'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Rest Break (5m)
                        </button>
                    </div>

                    {/* Timer Display */}
                    <div className="mb-10 relative">
                        <div className="text-7xl sm:text-8xl font-black text-white font-mono tracking-tighter drop-shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                            {formatTime(timeLeft)}
                        </div>
                        <p className="text-xs font-mono text-slate-400 mt-3 flex items-center justify-center gap-1.5">
                            {isActive ? (
                                <>
                                    <Flame className="w-4 h-4 text-emerald-400 animate-pulse" />
                                    <span>{mode === 'focus' ? 'Deep work interval active' : 'Recharging mind...'}</span>
                                </>
                            ) : (
                                <span>Press Play to initiate session</span>
                            )}
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-center gap-5">
                        <button
                            onClick={toggleTimer}
                            className={`w-16 h-16 rounded-2xl flex items-center justify-center text-slate-950 font-bold shadow-xl transition-all hover:scale-105 active:scale-95 ${
                                isActive
                                    ? 'bg-amber-400 shadow-amber-400/20'
                                    : 'bg-gradient-to-r from-emerald-400 to-teal-400 shadow-emerald-400/30'
                            }`}
                        >
                            {isActive ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current ml-1" />}
                        </button>
                        <button
                            onClick={resetTimer}
                            className="w-12 h-12 rounded-2xl glass-panel flex items-center justify-center text-slate-400 hover:text-white hover:border-emerald-500/40 transition-colors"
                            title="Reset Timer"
                        >
                            <RotateCcw className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {trackingStatus && (
                    <div className="mt-3 text-center text-xs font-mono text-emerald-400">
                        {trackingStatus}
                    </div>
                )}
                <div className="mt-6 text-center text-slate-500 text-xs font-mono">
                    Completed 25-minute focus intervals are automatically saved and reflected in your study analytics.
                </div>
            </div>
        </div>
    );
};

export default StudyTimer;
