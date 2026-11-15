import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  MessageSquare, 
  Layout, 
  BookOpen, 
  Map, 
  HelpCircle, 
  Layers, 
  FileText, 
  Clock, 
  BarChart2, 
  Sparkles, 
  Plus, 
  X,
  Cpu
} from 'lucide-react';

export default function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  const commands = [
    {
      id: 'chat',
      title: 'AI Chat & Hybrid Memory',
      description: 'Open conversational workspace with multi-session memory',
      icon: MessageSquare,
      category: 'Navigation',
      action: () => navigate('/chat')
    },
    {
      id: 'canvas',
      title: 'Visual Canvas Studio (MCP)',
      description: 'Model systems on interactive canvas with Excalidraw export',
      icon: Layout,
      category: 'Navigation',
      action: () => navigate('/canvas')
    },
    {
      id: 'library',
      title: 'Study Library & Saved Notes',
      description: 'Review saved diagrams, summaries, quizzes, and decks',
      icon: BookOpen,
      category: 'Navigation',
      action: () => navigate('/library')
    },
    {
      id: 'maps',
      title: 'Concept & Architecture Maps',
      description: 'Generate high-fidelity Mermaid vector diagrams',
      icon: Map,
      category: 'Navigation',
      action: () => navigate('/maps')
    },
    {
      id: 'quiz',
      title: 'Interactive Knowledge Quiz',
      description: 'Test active recall with AI-generated questions',
      icon: HelpCircle,
      category: 'Study Tools',
      action: () => navigate('/quiz')
    },
    {
      id: 'flashcards',
      title: 'Spaced Repetition Flashcards',
      description: 'Flip cards and track mastery with Anki-style intervals',
      icon: Layers,
      category: 'Study Tools',
      action: () => navigate('/flashcards')
    },
    {
      id: 'summarize',
      title: 'AI Chapter Summarizer',
      description: 'Synthesize complex texts with TTS audio speech playback',
      icon: FileText,
      category: 'Study Tools',
      action: () => navigate('/summarize')
    },
    {
      id: 'timer',
      title: 'Pomodoro Focus Timer',
      description: '25m deep-work focus sessions with ambient sounds',
      icon: Clock,
      category: 'Focus',
      action: () => navigate('/timer')
    },
    {
      id: 'progress',
      title: 'Learning Analytics Dashboard',
      description: 'Inspect study streaks, session logs, and focus stats',
      icon: BarChart2,
      category: 'Analytics',
      action: () => navigate('/progress')
    },
    {
      id: 'new_chat',
      title: '+ New Chat Session',
      description: 'Start a fresh conversation thread with fresh short-term memory',
      icon: Plus,
      category: 'Quick Action',
      action: () => {
        navigate('/chat', { state: { triggerNewChat: true } });
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('study-buddy:new-chat'));
        }, 150);
      }
    },
    {
      id: 'mcp_status',
      title: 'Inspect MCP Server Telemetry',
      description: 'Check active Model Context Protocol tools and schemas',
      icon: Cpu,
      category: 'Developer',
      action: () => navigate('/canvas')
    }
  ];

  const filtered = commands.filter(cmd => 
    cmd.title.toLowerCase().includes(query.toLowerCase()) ||
    cmd.description.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open handled by parent, or toggle
          window.dispatchEvent(new CustomEvent('study-buddy:open-palette'));
        }
      }

      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (filtered.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/80 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      <div 
        className="glass-panel w-full max-w-2xl rounded-2xl border border-emerald-500/30 shadow-2xl shadow-emerald-950/60 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10 bg-slate-900/60">
          <Search className="w-5 h-5 text-emerald-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, tool name, or search (e.g. Canvas, Quiz, MCP)..."
            className="w-full bg-transparent text-white placeholder-slate-400 text-base focus:outline-none"
            aria-label="Command search query"
            autoFocus
          />
          <button 
            onClick={onClose}
            aria-label="Close command palette"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1" role="listbox" aria-label="Commands">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">
              No matching commands or tools found for "{query}".
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation();
                      cmd.action();
                      onClose();
                    }
                  }}
                  onClick={() => {
                    cmd.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-white shadow-lg shadow-emerald-950/40' 
                      : 'text-slate-300 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium text-sm text-white flex items-center gap-2">
                        {cmd.title}
                        {isSelected && <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />}
                      </div>
                      <div className="text-xs text-slate-400">{cmd.description}</div>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/5">
                    {cmd.category}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/80 border-t border-white/5 text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-white/10 text-slate-300">↑↓</kbd> to navigate</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-white/10 text-slate-300">↵</kbd> to select</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-white/10 text-slate-300">esc</kbd> to close</span>
          </div>
          <span className="text-emerald-400/80 font-mono">AI Study Buddy v1.3</span>
        </div>
      </div>
    </div>
  );
}
