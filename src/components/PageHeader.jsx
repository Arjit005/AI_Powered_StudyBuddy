import React from 'react';

const PageHeader = ({ eyebrow, title, subtitle, actions, variant = 'default' }) => {
    return (
        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-6 border-b border-white/10 ${
            variant === 'compact' ? 'mb-4' : 'mb-8'
        }`}>
            <div>
                {eyebrow && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs mb-2">
                        {eyebrow}
                    </div>
                )}
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
