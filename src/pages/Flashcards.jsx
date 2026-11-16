import React, { useState, useEffect, useRef } from 'react';
import FlipCard3D from '../components/ui/FlipCard3D';
import { 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  BookOpen, 
  Save, 
  Check, 
  Flame 
} from 'lucide-react';

const Flashcards = () => {
    const [isFlipped, setIsFlipped] = useState(false);
    const [currentCard, setCurrentCard] = useState(0);
    const [topic, setTopic] = useState('');
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    
    // Spaced repetition mastery state: { [cardId]: 'hard' | 'good' | 'mastered' }
    const [mastery, setMastery] = useState({});

    const [cards, setCards] = useState([
        { id: 1, front: "What is Photosynthesis?", back: "The biochemical process by which plants and other organisms convert sunlight, water, and carbon dioxide into oxygen and energy-rich glucose." },
        { id: 2, front: "State Newton's Third Law of Motion", back: "For every action, there is an equal and opposite reaction. When one body exerts a force on a second body, the second body exerts a force equal in magnitude and opposite in direction." },
        { id: 3, front: "What is Binary Search and its time complexity?", back: "An efficient search algorithm that finds an element in a sorted list by repeatedly dividing the search space in half. Its time complexity is O(log n)." },
        { id: 4, front: "What is the difference between an Acid and a Base?", back: "Acids have a pH less than 7 and donate protons (H+ ions); Bases have a pH greater than 7 and accept protons or release hydroxide ions (OH-)." },
        { id: 5, front: "What is Opportunity Cost in Economics?", back: "The value of the next best alternative that is forgone when making a choice between mutually exclusive options." }
    ]);

    // Audio Speech Synthesis & timeout cleanup
    const advanceTimeoutRef = useRef(null);
    const saveTimeoutRef = useRef(null);
    const currentUtteranceRef = useRef(null);
    useEffect(() => {
        return () => {
            currentUtteranceRef.current = null;
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
            if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, []);

    const generateFlashcards = async () => {
        if (!topic.trim() || loading) return;
        setLoading(true);
        setIsFlipped(false);
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        setIsSpeaking(false);
        try {
            const token = localStorage.getItem('auth_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch('/api/generate-flashcards', {
                method: 'POST',
                headers,
                body: JSON.stringify({ topic: topic.trim() })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.flashcards && Array.isArray(data.flashcards) && data.flashcards.length > 0) {
                    const validCards = data.flashcards
                        .filter(c => c && typeof c === 'object')
                        .map((c, i) => ({
                            id: c.id ? `${c.id}_${i}` : `gen_${Date.now()}_${i}`,
                            front: String(c.front || 'Question'),
                            back: String(c.back || 'Answer')
                        }));
                    if (validCards.length > 0) {
                        if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
                        setCards(validCards);
                        setCurrentCard(0);
                        setMastery({});
                    }
                }
            } else {
                alert("Failed to generate flashcards. Please try another topic.");
            }
        } catch (err) {
            console.error(err);
            alert("Network error generating flashcards.");
        } finally {
            setLoading(false);
        }
    };

    const nextCard = () => {
        if (cards.length === 0) return;
        if (advanceTimeoutRef.current) {
            clearTimeout(advanceTimeoutRef.current);
            advanceTimeoutRef.current = null;
        }
        setIsFlipped(false);
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        setIsSpeaking(false);
        setCurrentCard((prev) => (prev + 1) % cards.length);
    };

    const prevCard = () => {
        if (cards.length === 0) return;
        if (advanceTimeoutRef.current) {
            clearTimeout(advanceTimeoutRef.current);
            advanceTimeoutRef.current = null;
        }
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
        if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
        advanceTimeoutRef.current = setTimeout(() => {
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
            currentUtteranceRef.current = null;
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        } else {
            const utterance = new SpeechSynthesisUtterance(textToRead);
            utterance.rate = 1.0;
            currentUtteranceRef.current = utterance;
            utterance.onend = () => {
                if (currentUtteranceRef.current === utterance) {
                    setIsSpeaking(false);
                    currentUtteranceRef.current = null;
                }
            };
            utterance.onerror = () => {
                if (currentUtteranceRef.current === utterance) {
                    setIsSpeaking(false);
                    currentUtteranceRef.current = null;
                }
            };
            window.speechSynthesis.speak(utterance);
            setIsSpeaking(true);
        }
    };

    // Save Deck to Library
    const handleSaveDeck = async () => {
        if (!cards || cards.length === 0 || saving) {
            if (!cards || cards.length === 0) alert("Cannot save an empty flashcard deck.");
            return;
        }
        setSaving(true);
        try {
            const token = localStorage.getItem('auth_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch('/api/library', {
                method: 'POST',
                headers,
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
                if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = setTimeout(() => {
                    setSaved(false);
                    saveTimeoutRef.current = null;
                }, 3000);
            } else {
                alert("Failed to save flashcards to library.");
            }
        } catch (err) {
            console.error("Save deck error:", err);
            alert("Network error saving flashcards.");
        } finally {
            setSaving(false);
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
    }, [cards, currentCard]);

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
                        onKeyDown={(e) => e.key === 'Enter' && !loading && topic.trim() && generateFlashcards()}
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
                        disabled={saving || !cards || cards.length === 0}
                        className="px-3.5 py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 text-xs font-mono transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        title="Save Deck to Personal Library"
                    >
                        {saved ? <Check className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4" />}
                        <span className="hidden sm:inline">{saved ? 'Saved' : saving ? 'Saving...' : 'Save'}</span>
                    </button>
                </div>

                {/* Spaced Repetition Stats Bar */}
                <div className="max-w-xl mx-auto mb-4 flex items-center justify-between px-3 text-xs font-mono text-slate-400">
                    <div className="flex items-center gap-2">
                        <Flame className="w-4 h-4 text-emerald-400" />
                        <span>Mastered: <b className="text-emerald-400">{masteredCount}</b> / {cards.length} ({cards.length > 0 ? Math.round((masteredCount / cards.length) * 100) : 0}% Progress)</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-rose-400">🔴 Hard (1)</span>
                        <span className="text-amber-400">🟡 Good (2)</span>
                        <span className="text-emerald-400">🟢 Mastered (3)</span>
                    </div>
                </div>

                {/* Main Flashcard Container with ReactBits 3D Perspective */}
                <div className="max-w-xl mx-auto">
                    <FlipCard3D
                        frontContent={activeCardData.front}
                        backContent={activeCardData.back}
                        isFlipped={isFlipped}
                        onFlip={() => setIsFlipped(!isFlipped)}
                        cardCategory={topic || 'Core Concept'}
                        currentRating={currentRating}
                        onReadCard={handleReadCard}
                        isSpeaking={isSpeaking}
                    />

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
