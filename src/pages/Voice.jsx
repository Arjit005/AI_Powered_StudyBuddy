
import React from 'react';
import { Mic } from 'lucide-react';

const Voice = () => {
    return (
        <div className="pt-24 pb-12 min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center max-w-lg px-4">
                <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
                    <Mic className="w-10 h-10 text-red-600" />
                </div>
                <h1 className="text-3xl font-bold text-slate-900 mb-4">Voice Notes & Transcription</h1>
                <p className="text-slate-600 mb-8 leading-relaxed">
                    Record your lectures or study sessions, and our AI will automatically transcribe and summarize them for you.
                </p>
                <button
                    onClick={() => alert("Microphone access requested... (Demo)")}
                    className="px-8 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                >
                    Start Recording
                </button>
            </div>
        </div>
    );
};

export default Voice;
