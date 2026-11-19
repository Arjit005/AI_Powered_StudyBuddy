import React from 'react';
import { Cloud, Check, Loader2, AlertCircle } from 'lucide-react';

const PageHeader = ({ eyebrow, title, subtitle, actions, variant = 'default', syncStatus = null, lastSavedAt = null }) => {
    return (
        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-6 border-b border-white/10 ${
            variant === 'compact' ? 'mb-4' : 'mb-8'
        }`}>
            <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                    {eyebrow && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs">
                            {eyebrow}
                        </div>
                    )}
                    {syncStatus && (
                        <div 
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono text-[11px] border transition-all ${
                                syncStatus === 'saving' 
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' 
                                    : syncStatus === 'saved' 
                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
                                    : syncStatus === 'error'
                                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                                    : 'bg-slate-800/60 border-white/10 text-slate-400'
                            }`}
                            title={lastSavedAt ? `Saved to cloud memory at ${lastSavedAt.toLocaleTimeString()}` : 'Cloud session memory active'}
                        >
                            {syncStatus === 'saving' ? (
                                <>
                                    <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                                    <span>Syncing memory...</span>
                                </>
                            ) : syncStatus === 'saved' ? (
                                <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span>Memory saved</span>
                                </>
                            ) : (
                                <>
                                    <Cloud className="w-3 h-3 text-emerald-400/70" />
                                    <span>Session memory</span>
                                </>
                            )}
                        </div>
                    )}
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {title}
                </h1>
                {subtitle && (
                    <p className="text-slate-300 text-xs sm:text-sm mt-1">
                        {subtitle}
                    </p>
                )}
            </div>

            {actions && (
                <div className="flex items-center gap-3 shrink-0">
                    {actions}
                </div>
            )}
        </div>
    );
};

export default PageHeader;
