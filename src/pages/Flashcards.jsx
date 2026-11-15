import React, { useState, useEffect } from 'react';
import { 
  FlipHorizontal, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  BookOpen, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Save, 
  Check, 
  Award, 
  CheckCircle, 
  Flame 
} from 'lucide-react';

const Flashcards = () => {
    const [isFlipped, setIsFlipped] = useState(false);
    const [currentCard, setCurrentCard] = useState(0);
    const [topic, setTopic] = useState('');
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    
    // Spaced repetition mastery state: { [cardId]: 'hard' | 'good' | 'mastered' }
    const [mastery, setMastery] = useState({});

    const [cards, setCards] = useState([
        { id: 1, front: "What is an Index in Relational Databases?", back: "A data structure (usually B-Tree or Hash) that improves the speed of data retrieval operations on a database table at the cost of additional storage and slower writes." },
        { id: 2, front: "Explain CAP Theorem in Distributed Systems", back: "In any asynchronous network partition, a distributed system can guarantee at most two of: Consistency, Availability, and Partition Tolerance." },
        { id: 3, front: "What is the difference between Synchronous and Asynchronous execution?", back: "Synchronous blocking waits for tasks to finish sequentially; Asynchronous non-blocking continues executing subsequent operations while I/O tasks resolve via event loops." },
        { id: 4, front: "What is Idempotency in HTTP APIs?", back: "An HTTP method is idempotent if the side-effects of making N identical requests is the same as making a single request (e.g. GET, PUT, DELETE are idempotent; POST is not)." },
        { id: 5, front: "What is Connection Pooling?", back: "A caching technique where a pool of open database connections is kept alive and reused across requests to avoid the latency of TCP 3-way handshake and SSL negotiation on every query." }
    ]);

    // Audio Speech Synthesis cleanup
    useEffect(() => {
        return () => {
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        };
    }, []);

    const generateFlashcards = async () => {
        if (!topic.trim()) return;
        setLoading(true);
        setIsFlipped(false);
        try {
            const token = localStorage.getItem('auth_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch('/api/generate-flashcards', {
                method: 'POST',
                headers,
                body: JSON.stringify({ topic: topic.trim() })
            });
            const data = await res.json();
            if (data.flashcards && data.flashcards.length > 0) {
                setCards(data.flashcards);
                setCurrentCard(0);
                setMastery({});
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const nextCard = () => {
        setIsFlipped(false);
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        setIsSpeaking(false);
        setCurrentCard((prev) => (prev + 1) % cards.length);
    };

    const prevCard = () => {
        setIsFlipped(false);
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        setIsSpeaking(false);
        setCurrentCard((prev) => (prev - 1 + cards.length) % cards.length);
    };

    // Rate mastery for active recall
    const handleRateMastery = (rating) => {
        const activeCard = cards[currentCard];
        if (!activeCard) return;
        setMastery(prev => ({
            ...prev,
            [activeCard.id || currentCard]: rating
        }));
        // Auto-advance on rating
        setTimeout(() => {
            nextCard();
        }, 300);
    };

    // Text to Speech
    const handleReadCard = (e) => {
        e.stopPropagation();
        if (!('speechSynthesis' in window)) return;
        const activeCardData = cards[currentCard] || { front: '', back: '' };
        const textToRead = isFlipped ? activeCardData.back : activeCardData.front;
        if (!textToRead) return;

        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        } else {
            const utterance = new SpeechSynthesisUtterance(textToRead);
            utterance.rate = 1.0;
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = () => setIsSpeaking(false);
            window.speechSynthesis.speak(utterance);
            setIsSpeaking(true);
        }
    };

    // Save Deck to Library
    const handleSaveDeck = async () => {
        try {
            const res = await fetch('/api/library', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    material_type: 'flashcards',
                    title: `Flashcards: ${topic || 'Computer Science Core'} (${cards.length} cards)`,
                    topic: topic || 'Core CS',
                    content_json: JSON.stringify(cards),
                    tags: 'flashcards,active_recall,spaced_repetition'
                })
            });
            if (res.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            }
        } catch (err) {
            console.error("Save deck error:", err);
        }
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
            if (e.code === 'Space') {
                e.preventDefault();
                setIsFlipped(prev => !prev);
            } else if (e.code === 'ArrowRight') {
                nextCard();
            } else if (e.code === 'ArrowLeft') {
                prevCard();
            } else if (e.key === '1') {
                handleRateMastery('hard');
            } else if (e.key === '2') {
                handleRateMastery('good');
            } else if (e.key === '3') {
                handleRateMastery('mastered');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cards.length, currentCard]);

    const activeCardData = cards[currentCard] || { front: '', back: '' };
    const currentRating = mastery[activeCardData.id || currentCard];
    const masteredCount = Object.values(mastery).filter(r => r === 'mastered').length;

    return (
        <div className="py-12 min-h-screen">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 mb-3 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                        <BookOpen className="w-7 h-7" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
                        Spaced Repetition Flashcards
                    </h1>
                    <p className="text-slate-400 text-sm max-w-lg mx-auto">
                        Practice active recall with self-grading mastery intervals (Anki / Leitner style).
                    </p>
                </div>

                {/* Generator Bar */}
                <div className="max-w-xl mx-auto mb-6 flex gap-3">
                    <input
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && generateFlashcards()}
                        placeholder="Enter deck topic (e.g. Distributed Systems, Kubernetes, Organic Chem)..."
                        className="flex-1 px-4 py-3 rounded-xl glass-input text-sm font-mono placeholder:text-slate-500"
                    />
                    <button
                        onClick={generateFlashcards}
                        disabled={loading || !topic.trim()}
                        className="px-6 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-40 flex items-center gap-2"
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Sparkles className="w-4 h-4" />
                        )}
                        <span>Generate</span>
                    </button>
                    <button
                        onClick={handleSaveDeck}
                        className="px-3.5 py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 text-xs font-mono transition-colors flex items-center gap-1.5"
                        title="Save Deck to Personal Library"
                    >
                        {saved ? <Check className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4" />}
                        <span className="hidden sm:inline">{saved ? 'Saved' : 'Save'}</span>
                    </button>
                </div>

                {/* Spaced Repetition Stats Bar */}
                <div className="max-w-xl mx-auto mb-4 flex items-center justify-between px-3 text-xs font-mono text-slate-400">
                    <div className="flex items-center gap-2">
                        <Flame className="w-4 h-4 text-emerald-400" />
                        <span>Mastered: <b className="text-emerald-400">{masteredCount}</b> / {cards.length}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-rose-400">🔴 Hard (1)</span>
                        <span className="text-amber-400">🟡 Good (2)</span>
                        <span className="text-emerald-400">🟢 Mastered (3)</span>
                    </div>
                </div>

                {/* Main Flashcard Container */}
                <div className="max-w-xl mx-auto">
                    <div
                        onClick={() => setIsFlipped(!isFlipped)}
                        className={`relative h-80 rounded-3xl glass-panel-glow p-8 flex flex-col justify-between cursor-pointer transition-all duration-500 hover:scale-[1.01] shadow-2xl border select-none group ${
                            currentRating === 'mastered' 
                                ? 'border-emerald-500/60 shadow-emerald-950/60' 
                                : currentRating === 'hard' 
                                ? 'border-rose-500/50' 
                                : 'border-emerald-500/30'
                        }`}
                    >
                        {/* Top Indicator */}
                        <div className="flex justify-between items-center text-xs font-mono text-slate-400">
                            <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-emerald-400 flex items-center gap-1.5">
                                {isFlipped ? 'ANSWER / CONCEPT' : 'QUESTION / PROMPT'}
                                {currentRating && (
                                    <span className="text-[10px] uppercase font-bold text-white px-1.5 py-0.2 rounded bg-white/10">
                                        {currentRating}
                                    </span>
                                )}
                            </span>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleReadCard}
                                    className={`p-1.5 rounded-lg border text-slate-400 hover:text-white transition-colors ${
                                        isSpeaking ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300' : 'bg-slate-900 border-slate-800'
                                    }`}
                                    title="Listen to card (TTS)"
                                >
                                    {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                                </button>
                                <span className="flex items-center gap-1.5 text-slate-500 group-hover:text-slate-300 transition-colors">
                                    <FlipHorizontal className="w-3.5 h-3.5" />
                                    Flip (Space)
                                </span>
                            </div>
                        </div>

                        {/* Card Center Content */}
                        <div className="my-auto text-center px-4">
                            <p className="text-lg sm:text-xl font-semibold text-white leading-relaxed font-sans">
                                {isFlipped ? activeCardData.back : activeCardData.front}
                            </p>
                        </div>

                        {/* Card Footer */}
                        <div className="flex justify-between items-center text-xs font-mono text-slate-500 pt-4 border-t border-white/5">
                            <span>Card {currentCard + 1} of {cards.length}</span>
                            <span>{Math.round(((currentCard + 1) / cards.length) * 100)}% Progress</span>
                        </div>
                    </div>

                    {/* Active Recall Self-Rating Buttons */}
                    <div className="grid grid-cols-3 gap-2 mt-4">
                        <button
                            onClick={() => handleRateMastery('hard')}
                            className="py-2.5 px-3 rounded-xl bg-slate-900/90 border border-rose-500/30 hover:border-rose-400 hover:bg-rose-950/30 text-rose-300 font-mono text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
                        >
                            <span>🔴 Hard</span>
                            <kbd className="text-[10px] opacity-60">(1)</kbd>
                        </button>
                        <button
                            onClick={() => handleRateMastery('good')}
                            className="py-2.5 px-3 rounded-xl bg-slate-900/90 border border-amber-500/30 hover:border-amber-400 hover:bg-amber-950/30 text-amber-300 font-mono text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
                        >
                            <span>🟡 Good</span>
                            <kbd className="text-[10px] opacity-60">(2)</kbd>
                        </button>
                        <button
                            onClick={() => handleRateMastery('mastered')}
                            className="py-2.5 px-3 rounded-xl bg-slate-900/90 border border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-950/30 text-emerald-300 font-mono text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
                        >
                            <span>🟢 Mastered</span>
                            <kbd className="text-[10px] opacity-60">(3)</kbd>
                        </button>
                    </div>

                    {/* Navigation Controls */}
                    <div className="flex items-center justify-between mt-5 px-2">
                        <button
                            onClick={prevCard}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl glass-panel text-slate-300 hover:text-white hover:border-emerald-500/40 font-mono text-xs transition-all active:scale-95"
                        >
                            <ChevronLeft className="w-4 h-4" /> Prev (←)
                        </button>

                        {/* Card progress dots */}
                        <div className="flex gap-1.5 overflow-hidden max-w-[200px]">
                            {cards.map((c, idx) => {
                                const r = mastery[c.id || idx];
                                const dotColor = r === 'mastered' ? 'bg-emerald-400' : r === 'hard' ? 'bg-rose-400' : r === 'good' ? 'bg-amber-400' : 'bg-slate-800';
                                return (
                                    <div
                                        key={idx}
                                        className={`h-1.5 rounded-full transition-all ${
                                            idx === currentCard ? 'w-6 ' + dotColor : 'w-1.5 ' + dotColor
                                        }`}
                                    />
                                );
                            })}
                        </div>

                        <button
                            onClick={nextCard}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl glass-panel text-slate-300 hover:text-white hover:border-emerald-500/40 font-mono text-xs transition-all active:scale-95"
                        >
                            Next (→) <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Flashcards;
