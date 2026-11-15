import React, { useRef, useState } from 'react';

/**
 * ReactBits-inspired SpotlightCard
 * Creates a sleek dynamic illumination effect tracking cursor coordinates
 * with glassmorphism backdrop and subtle border glow.
 */
const SpotlightCard = ({
    children,
    className = '',
    spotlightColor = 'rgba(16, 185, 129, 0.15)',
    borderColor = 'rgba(52, 211, 153, 0.25)',
    ...props
}) => {
    const cardRef = useRef(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);

    const handleMouseMove = (e) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        setMousePos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
    };

    return (
        <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`relative overflow-hidden rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl transition-all duration-300 ${className}`}
            {...props}
        >
            {/* Dynamic Spotlight Glow (Follows Cursor) */}
            <div
                className="pointer-events-none absolute -inset-px transition-opacity duration-300"
                style={{
                    opacity: isHovered ? 1 : 0,
                    background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, ${spotlightColor}, transparent 70%)`,
                }}
            />

            {/* Dynamic Border Highlight */}
            <div
                className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300 border"
                style={{
                    opacity: isHovered ? 1 : 0,
                    borderColor: borderColor,
                }}
            />

            {/* Card Content Container */}
            <div className="relative z-10 h-full">
                {children}
            </div>
        </div>
    );
};

export default SpotlightCard;
