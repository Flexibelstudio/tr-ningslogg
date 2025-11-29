import React, { useMemo } from 'react';

const CONFETTI_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
const CONFETTI_COUNT = 150;

interface ConfettiPiece {
  id: number;
  style: React.CSSProperties;
}

export const Confetti: React.FC = () => {
    const pieces = useMemo(() => {
        return Array.from({ length: CONFETTI_COUNT }).map((_, i) => {
            const duration = 4 + Math.random() * 3; // 4 to 7 seconds
            const style: React.CSSProperties = {
                left: `${Math.random() * 100}vw`,
                backgroundColor: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
                animationDuration: `${duration}s`,
                animationDelay: `${Math.random() * 2}s`,
                width: `${Math.floor(Math.random() * 8 + 6)}px`,
                height: `${Math.floor(Math.random() * 15 + 8)}px`,
                transform: `rotate(${Math.random() * 360}deg)`,
                opacity: Math.random() * 0.5 + 0.5,
            };
            return { id: i, style };
        });
    }, []);

    return (
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none" aria-hidden="true" style={{ zIndex: 9999 }}>
            {pieces.map(p => (
                <div key={p.id} className="confetti" style={p.style} />
            ))}
        </div>
    );
};
