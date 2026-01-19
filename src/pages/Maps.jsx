import React, { useState } from 'react';
import { Share2, Loader2, Sparkles, X, ZoomIn } from 'lucide-react';

const Maps = () => {
    const [topic, setTopic] = useState('');
    const [loading, setLoading] = useState(false);
    const [mapImage, setMapImage] = useState(null);
    const [isZoomed, setIsZoomed] = useState(false);
    const [error, setError] = useState(null);

    const generateMap = async () => {
        if (!topic.trim()) return;
        setLoading(true);
        setMapImage(null);
        setError(null);
        setIsZoomed(false);

        try {
            const res = await fetch('/api/generate-map', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic })
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Error ${res.status}: ${errText || res.statusText}`);
            }

            const data = await res.json();
            if (data.map_image) {
                setMapImage(`data:image/png;base64,${data.map_image}`);
            } else {
                throw new Error("No image data received from AI");
            }
        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to generate map. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="pt-24 pb-12 min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">AI Concept Maps</h1>
                    <p className="text-xl text-slate-600">Visualize connections between complex topics.</p>
                </div>

                <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8 min-h-[600px] flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]"></div>

                    <div className="text-center relative z-10 w-full max-w-2xl mx-auto">
                        <Share2 className="w-16 h-16 text-indigo-300 mx-auto mb-6" />
                        <h3 className="text-2xl font-bold text-slate-900 mb-3">Interactive Canvas</h3>
                        <p className="text-slate-500 max-w-md mx-auto mb-8">
                            Enter a central topic to generate a mind map.
                        </p>

                        <div className="flex max-w-md mx-auto gap-2">
                            <input
                                type="text"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="Enter central topic..."
                                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                                onClick={generateMap}
                                disabled={loading || !topic.trim()}
                                className="px-6 py-3 bg-indigo-600 disabled:opacity-50 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                                Generate
                            </button>
                        </div>

                        {error && (
                            <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-200 animate-in fade-in slide-in-from-bottom-2">
                                <p className="font-semibold">Generation Failed</p>
                                <p className="text-sm opacity-80">{error}</p>
                            </div>
                        )}
                    </div>

                    {mapImage && (
                        <div className="relative z-10 w-full max-w-4xl mt-8">
                            <div
                                className="bg-white p-4 rounded-xl shadow-lg border border-slate-200 cursor-zoom-in group relative"
                                onClick={() => setIsZoomed(true)}
                            >
                                <img src={mapImage} alt="Generated Concept Map" className="w-full rounded-lg" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors rounded-lg flex items-center justify-center">
                                    <ZoomIn className="text-white opacity-0 group-hover:opacity-100 w-10 h-10 transition-opacity drop-shadow-lg" />
                                </div>
                            </div>
                            <div className="text-center mt-4">
                                <p className="text-sm text-slate-500 italic">Click the image to expand</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Lightbox Modal */}
            {isZoomed && (
                <div
                    className="fixed inset-0 z-[100] bg-slate-900/95 overflow-y-auto backdrop-blur-sm animate-in fade-in duration-300"
                    onClick={() => setIsZoomed(false)}
                >
                    <div className="min-h-screen w-full flex items-center justify-center p-4">
                        <button
                            className="fixed top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all hover:rotate-90 z-[110]"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsZoomed(false);
                            }}
                        >
                            <X className="w-8 h-8" />
                        </button>

                        <div
                            className="relative max-w-7xl w-full animate-in zoom-in duration-300"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={mapImage}
                                alt="Full Screen Concept Map"
                                className="w-full h-auto rounded-xl shadow-2xl border border-white/10"
                            />
                            <p className="text-center text-white/70 text-sm mt-4">
                                Click background or 'X' to close • Scroll to view details
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Maps;
