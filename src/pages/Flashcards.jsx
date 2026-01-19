
import React, { useState } from 'react';
import { FlipHorizontal, ChevronLeft, ChevronRight, Plus, Loader2, BookOpen } from 'lucide-react';

const Flashcards = () => {
    const [isFlipped, setIsFlipped] = useState(false);
    const [currentCard, setCurrentCard] = useState(0);
    const [topic, setTopic] = useState('');
    const [loading, setLoading] = useState(false);
    const [cards, setCards] = useState([
        { id: 1, front: "Welcome to AI Flashcards", back: "Enter a topic to generate a deck!" },
    ]);

    const generateFlashcards = async () => {
        if (!topic.trim()) return;
        setLoading(true);
        setIsFlipped(false);
        try {
            const res = await fetch('/api/generate-flashcards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic })
            });
            const data = await res.json();
            if (data.flashcards && data.flashcards.length > 0) {
                setCards(data.flashcards);
                setCurrentCard(0);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const nextCard = () => {
        setIsFlipped(false);
        setCurrentCard((prev) => (prev + 1) % cards.length);
    };

    const prevCard = () => {
        setIsFlipped(false);
        setCurrentCard((prev) => (prev - 1 + cards.length) % cards.length);
    };

    return (
        <div className="pt-24 pb-12 min-h-screen bg-slate-50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">AI Flashcards</h1>
                    <p className="text-xl text-slate-600">Enter a topic and let AI create a study deck for you.</p>
                </div>

                <div className="max-w-xl mx-auto mb-12 flex gap-4">
                    <input
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="Enter topic (e.g., 'European History')..."
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                    />
                    <button
                        onClick={generateFlashcards}
                        disabled={loading || !topic.trim()}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <BookOpen className="w-5 h-5" />}
                        Generate
                    </button>
                </div>

                <div className="flex flex-col items-center">
                    <div
                        className="relative w-full max-w-2xl h-96 perspective-1000 cursor-pointer group"
                        onClick={() => setIsFlipped(!isFlipped)}
                    >
                        <div className={`relative w-full h-full duration-500 preserve-3d transition-transform ${isFlipped ? 'rotate-y-180' : ''}`} style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                            {/* Front */}
                            <div className="absolute w-full h-full backface-hidden bg-white rounded-3xl shadow-xl border border-slate-200 flex items-center justify-center p-8 text-center" style={{ backfaceVisibility: 'hidden' }}>
                                <div>
                                    <p className="text-sm font-bold text-blue-600 mb-4 tracking-wider uppercase">Question</p>
                                    <h2 className="text-3xl font-bold text-slate-900">{cards[currentCard].front}</h2>
                                    <p className="absolute bottom-6 right-6 text-slate-400 text-sm flex items-center gap-1">
                                        <FlipHorizontal className="w-4 h-4" /> Click to flip
                                    </p>
                                </div>
                            </div>

                            {/* Back */}
                            <div className="absolute w-full h-full backface-hidden bg-blue-600 rounded-3xl shadow-xl flex items-center justify-center p-8 text-center rotate-y-180" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                                <div>
                                    <p className="text-sm font-bold text-blue-100 mb-4 tracking-wider uppercase">Answer</p>
                                    <h2 className="text-3xl font-bold text-white">{cards[currentCard].back}</h2>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 mt-8">
                        <button onClick={prevCard} className="p-4 rounded-full bg-white border border-slate-200 hover:bg-slate-50 shadow-sm transition-all">
                            <ChevronLeft className="w-6 h-6 text-slate-600" />
                        </button>
                        <span className="font-bold text-slate-600">{currentCard + 1} / {cards.length}</span>
                        <button onClick={nextCard} className="p-4 rounded-full bg-white border border-slate-200 hover:bg-slate-50 shadow-sm transition-all">
                            <ChevronRight className="w-6 h-6 text-slate-600" />
                        </button>
                    </div>

                    <button disabled className="mt-12 flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-400 rounded-xl font-bold cursor-not-allowed">
                        <Plus className="w-5 h-5" /> Save Deck (Coming Soon)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Flashcards;
