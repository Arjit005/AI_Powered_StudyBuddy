
import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Coffee } from 'lucide-react';

const StudyTimer = () => {
    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [isActive, setIsActive] = useState(false);
    const [mode, setMode] = useState('focus'); // 'focus' or 'break'

    useEffect(() => {
        let interval = null;
        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(timeLeft - 1);
            }, 1000);
        } else if (timeLeft === 0 && isActive) {
            setIsActive(false);
            // Timer finished naturally - log full duration
            const duration = mode === 'focus' ? 25 * 60 : 5 * 60;
            if (mode === 'focus') {
                fetch('/api/track-activity', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ activity_type: 'timer_focus', duration_seconds: duration })
                }).catch(err => console.error("Failed to track time", err));
            }
            // Play sound or notify
        }
        return () => clearInterval(interval);
    }, [isActive, timeLeft, mode]);

    const toggleTimer = () => setIsActive(!isActive);

    const resetTimer = () => {
        setIsActive(false);
        setTimeLeft(mode === 'focus' ? 25 * 60 : 5 * 60);
    };

    const switchMode = (newMode) => {
        setMode(newMode);
        setIsActive(false);
        setTimeLeft(newMode === 'focus' ? 25 * 60 : 5 * 60);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="pt-24 pb-12 min-h-screen bg-slate-50 flex flex-col items-center justify-center">
            <div className="max-w-md w-full px-4">
                <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-center relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-full h-2 ${mode === 'focus' ? 'bg-blue-500' : 'bg-green-500'}`}></div>

                    <div className="flex justify-center gap-2 mb-8 p-1 bg-slate-100 rounded-xl inline-flex">
                        <button
                            onClick={() => switchMode('focus')}
                            className={`px-6 py-2 rounded-lg font-bold transition-all ${mode === 'focus' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                        >
                            Focus
                        </button>
                        <button
                            onClick={() => switchMode('break')}
                            className={`px-6 py-2 rounded-lg font-bold transition-all ${mode === 'break' ? 'bg-white shadow-sm text-green-600' : 'text-slate-500'}`}
                        >
                            Break
                        </button>
                    </div>

                    <div className="mb-12 relative">
                        {/* Circular Progress Placeholder */}
                        <div className="text-8xl font-black text-slate-800 font-mono tracking-tighter">
                            {formatTime(timeLeft)}
                        </div>
                        <p className="text-slate-500 font-medium mt-2">
                            {isActive ? (mode === 'focus' ? 'Stay focused!' : 'Enjoy your break') : 'Ready to start?'}
                        </p>
                    </div>

                    <div className="flex items-center justify-center gap-4">
                        <button
                            onClick={toggleTimer}
                            className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105 active:scale-95 ${isActive ? 'bg-amber-500' : 'bg-blue-600'}`}
                        >
                            {isActive ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                        </button>
                        <button
                            onClick={resetTimer}
                            className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
                        >
                            <RotateCcw className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="mt-8 text-center text-slate-500 text-sm">
                    <p>Tip: Work for 25 minutes, then take a 5 minute break.</p>
                </div>
            </div>
        </div>
    );
};

export default StudyTimer;
