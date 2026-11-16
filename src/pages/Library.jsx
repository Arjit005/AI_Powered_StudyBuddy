import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Search, 
  Star, 
  Trash2, 
  ExternalLink, 
  FileText, 
  Layers, 
  HelpCircle, 
  Layout, 
  Calendar, 
  Sparkles,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Library() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const navigate = useNavigate();
  const requestGenRef = useRef(0);
  const detailRequestGenRef = useRef(0);
  const pendingFavoritesRef = useRef(new Set());
  const itemFavoriteEpochRef = useRef(new Map());

  useEffect(() => {
    fetchLibrary();
    return () => {
      requestGenRef.current++;
    };
  }, [activeTab, search]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const fetchLibrary = async () => {
    setLoading(true);
    setError(null);
    const thisGen = ++requestGenRef.current;
    try {
      let url = '/api/library';
      const params = new URLSearchParams();
      if (activeTab !== 'all') params.append('material_type', activeTab);
      if (search.trim()) params.append('search', search.trim());
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, { headers: getAuthHeaders() });
      if (thisGen !== requestGenRef.current) return;

      if (res.ok) {
        const data = await res.json();
        if (thisGen !== requestGenRef.current) return;
        const serverItems = Array.isArray(data) 
          ? data.filter(item => item && typeof item === 'object' && item.id !== null && item.id !== undefined) 
          : [];
        setItems(prev => {
          const currentFavMap = new Map(prev.map(p => [p.id, p.is_favorite]));
          return serverItems.map(item => {
            const override = itemFavoriteEpochRef.current.get(item.id);
            if (override && thisGen <= override.minGen) {
              return { ...item, is_favorite: override.is_favorite };
            }
            if (pendingFavoritesRef.current.has(item.id) && currentFavMap.has(item.id)) {
              return { ...item, is_favorite: currentFavMap.get(item.id) };
            }
            return item;
          });
        });
      } else {
        setError("Failed to load study materials. Please try again.");
      }
    } catch (err) {
      console.error("Library fetch error:", err);
      if (thisGen === requestGenRef.current) {
        setError("Network error while loading library.");
      }
    } finally {
      if (thisGen === requestGenRef.current) {
        setLoading(false);
      }
    }
  };

  const handleToggleFavorite = async (e, id) => {
    e.stopPropagation();
    if (pendingFavoritesRef.current.has(id)) return;
    pendingFavoritesRef.current.add(id);

    const targetItem = items.find(i => i.id === id);
    const newFav = targetItem ? !targetItem.is_favorite : true;
    const mutationGen = requestGenRef.current;
    itemFavoriteEpochRef.current.set(id, { is_favorite: newFav, minGen: mutationGen });
    setItems(prev => prev.map(item => item.id === id ? { ...item, is_favorite: newFav } : item));

    try {
      const res = await fetch(`/api/library/${id}/favorite`, { method: 'PUT', headers: getAuthHeaders() });
      if (!res.ok) {
        itemFavoriteEpochRef.current.delete(id);
        setItems(prev => prev.map(item => item.id === id ? { ...item, is_favorite: !newFav } : item));
        alert("Could not update favorite status.");
      }
    } catch (err) {
      console.error("Favorite toggle error:", err);
      itemFavoriteEpochRef.current.delete(id);
      setItems(prev => prev.map(item => item.id === id ? { ...item, is_favorite: !newFav } : item));
      alert("Network error updating favorite.");
    } finally {
      pendingFavoritesRef.current.delete(id);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this study material?")) return;
    try {
      const res = await fetch(`/api/library/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) {
        setItems(prev => prev.filter(item => item.id !== id));
        if (selectedItem?.id === id) {
          detailRequestGenRef.current += 1;
          setSelectedItem(null);
          setDetailLoading(false);
          setDetailError(null);
        }
      } else {
        alert("Failed to delete item from library.");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Network error deleting item.");
    }
  };

  const handleCloseModal = () => {
    detailRequestGenRef.current += 1;
    setSelectedItem(null);
    setDetailError(null);
    setDetailLoading(false);
  };

  const handleOpenItem = async (item) => {
    const thisGen = ++detailRequestGenRef.current;
    setSelectedItem(item);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await fetch(`/api/library/${item.id}`, { headers: getAuthHeaders() });
      if (thisGen !== detailRequestGenRef.current) return;
      if (res.ok) {
        const full = await res.json();
        if (thisGen !== detailRequestGenRef.current) return;
        setSelectedItem(full);
      } else {
        setDetailError("Failed to fetch full study material details.");
      }
    } catch (err) {
      console.error("Fetch full item error:", err);
      if (thisGen === detailRequestGenRef.current) {
        setDetailError("Network error while loading item details.");
      }
    } finally {
      if (thisGen === detailRequestGenRef.current) {
        setDetailLoading(false);
      }
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'summary': return <FileText className="w-4 h-4 text-emerald-400" />;
      case 'canvas_diagram': return <Layout className="w-4 h-4 text-cyan-400" />;
      case 'flashcards': return <Layers className="w-4 h-4 text-amber-400" />;
      case 'quiz': return <HelpCircle className="w-4 h-4 text-purple-400" />;
      default: return <BookOpen className="w-4 h-4 text-slate-400" />;
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'summary': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'canvas_diagram': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'flashcards': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'quiz': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      default: return 'bg-slate-700/20 text-slate-300 border-slate-500/30';
    }
  };

  const tabs = [
    { id: 'all', label: 'All Items' },
    { id: 'summary', label: 'Summaries' },
    { id: 'canvas_diagram', label: 'Canvas Diagrams' },
    { id: 'flashcards', label: 'Flashcards' },
    { id: 'quiz', label: 'Quizzes' }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white pt-24 pb-16 px-4 md:px-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-950/40">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Personal Study Library</h1>
              <p className="text-sm text-slate-400">All your saved AI summaries, canvas models, quizzes, and decks</p>
            </div>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search saved materials..."
            className="glass-input w-full text-sm py-2 px-4 pl-10 rounded-xl border border-white/10 text-white placeholder-slate-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 border-b border-white/10">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-950/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid of Saved Materials */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <div className="text-sm text-slate-400">Loading your knowledge base...</div>
        </div>
      ) : error ? (
        <div className="py-16 text-center glass-panel rounded-3xl border border-rose-500/30 p-8 max-w-lg mx-auto">
          <div className="text-rose-400 text-sm mb-4 font-mono">{error}</div>
          <button
            onClick={fetchLibrary}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
          >
            Retry Loading
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center glass-panel rounded-3xl border border-white/10 p-8 max-w-lg mx-auto">
          <Sparkles className="w-10 h-10 text-emerald-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-base font-semibold text-white mb-1">No items found</h3>
          <p className="text-xs text-slate-400 mb-5 leading-relaxed">
            Generate a summary, canvas diagram, or flashcards and click "Save to Library" to build your permanent reference hub.
          </p>
          <button
            onClick={() => navigate('/canvas')}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
          >
            Open Canvas Studio
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map(item => (
            <div
              key={item.id}
              onClick={() => handleOpenItem(item)}
              className="glass-panel p-5 rounded-2xl border border-white/10 hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-950/40 transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase border flex items-center gap-1.5 ${getTypeBadge(item.material_type)}`}>
                    {getTypeIcon(item.material_type)}
                    {(item.material_type || 'note').replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleToggleFavorite(e, item.id)}
                      className={`p-1.5 rounded-lg transition-colors ${item.is_favorite ? 'text-amber-400' : 'text-slate-500 hover:text-amber-300'}`}
                      title="Favorite"
                    >
                      <Star className={`w-4 h-4 ${item.is_favorite ? 'fill-amber-400' : ''}`} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, item.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-white text-sm group-hover:text-emerald-300 transition-colors line-clamp-1 mb-1">
                  {item.title}
                </h3>
                {item.topic && (
                  <p className="text-xs text-slate-400 line-clamp-1 mb-3">
                    Topic: {item.topic}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}
                </span>
                <span className="text-emerald-400 group-hover:translate-x-0.5 transition-transform font-medium">
                  View →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Item Viewer Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass-panel w-full max-w-2xl rounded-3xl border border-emerald-500/30 p-6 flex flex-col gap-4 shadow-2xl max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                {getTypeIcon(selectedItem.material_type)}
                <div>
                  <h3 className="font-bold text-white text-base">{selectedItem.title}</h3>
                  <div className="text-xs text-slate-400">Topic: {selectedItem.topic}</div>
                </div>
              </div>
              <button 
                onClick={handleCloseModal}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailError ? (
              <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800 text-sm text-rose-300 font-mono">
                ⚠️ {detailError}
              </div>
            ) : detailLoading ? (
              <div className="flex-1 flex items-center justify-center p-8 text-slate-400 font-mono text-xs">
                Loading study material details...
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 rounded-2xl bg-slate-900/60 border border-white/5 text-sm text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">
                {typeof selectedItem.content_json === 'object' 
                  ? JSON.stringify(selectedItem.content_json, null, 2) 
                  : (selectedItem.content_json || 'No content available.')}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                Saved on {selectedItem.created_at ? new Date(selectedItem.created_at).toLocaleString() : 'N/A'}
              </span>
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
