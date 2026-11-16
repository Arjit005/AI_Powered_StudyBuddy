import React, { useState, useEffect, useRef } from 'react';
import { 
  Layout, 
  Sparkles, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Download, 
  Copy, 
  Check, 
  Save, 
  Code, 
  Info,
  Activity,
  Terminal,
  X
} from 'lucide-react';
import MermaidViewer from '../components/MermaidViewer';

export default function CanvasStudio() {
  const [topic, setTopic] = useState('Distributed Microservices with Event Sourcing');
  const [detailLevel, setDetailLevel] = useState('standard');
  const [diagramType, setDiagramType] = useState('architecture');
  const [loading, setLoading] = useState(false);
  const [canvasData, setCanvasData] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [copiedExcalidraw, setCopiedExcalidraw] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showMcpModal, setShowMcpModal] = useState(false);
  const [showMermaidModal, setShowMermaidModal] = useState(false);
  const [mcpConfig, setMcpConfig] = useState(null);
  const [mcpConfigLoading, setMcpConfigLoading] = useState(false);
  const [mcpConfigError, setMcpConfigError] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [error, setError] = useState(null);

  const canvasRef = useRef(null);
  const copyTimeoutRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const requestGenRef = useRef(0);
  const mcpRequestGenRef = useRef(0);

  // Initial load
  useEffect(() => {
    fetchInitialCanvas();
    fetchMcpConfig();
    return () => {
      requestGenRef.current += 1;
      mcpRequestGenRef.current += 1;
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const fetchInitialCanvas = async () => {
    setLoading(true);
    const thisGen = ++requestGenRef.current;
    try {
      const res = await fetch('/api/canvas/generate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          topic: 'Distributed Microservices with Event Sourcing',
          detail_level: 'standard',
          diagram_type: 'architecture'
        })
      });
      if (thisGen !== requestGenRef.current) return;
      if (res.ok) {
        const data = await res.json();
        if (thisGen !== requestGenRef.current) return;
        setSelectedNode(null);
        setCanvasData(data.canvas);
        setTelemetry({
          execution_time_ms: data.execution_time_ms,
          node_count: data.canvas?.nodes?.length || 0,
          edge_count: data.canvas?.edges?.length || 0
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        if (thisGen !== requestGenRef.current) return;
        setError(errData.detail || 'Could not initialize template architecture.');
      }
    } catch (err) {
      if (thisGen === requestGenRef.current) {
        console.error("Canvas fetch error:", err);
        setError('Network error initializing canvas diagram.');
      }
    } finally {
      if (thisGen === requestGenRef.current) {
        setLoading(false);
      }
    }
  };

  const fetchMcpConfig = async () => {
    setMcpConfigLoading(true);
    setMcpConfigError(null);
    const thisGen = ++mcpRequestGenRef.current;
    try {
      const res = await fetch('/api/mcp/config', { headers: getAuthHeaders() });
      if (thisGen !== mcpRequestGenRef.current) return;
      if (res.ok) {
        const data = await res.json();
        setMcpConfig(data);
      } else {
        setMcpConfigError("Unable to retrieve MCP configuration.");
      }
    } catch (err) {
      console.error("MCP config fetch error:", err);
      if (thisGen === mcpRequestGenRef.current) {
        setMcpConfigError("Network error fetching MCP configuration.");
      }
    } finally {
      if (thisGen === mcpRequestGenRef.current) {
        setMcpConfigLoading(false);
      }
    }
  };

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    setSelectedNode(null);
    const thisGen = ++requestGenRef.current;
    try {
      const res = await fetch('/api/canvas/generate', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          topic,
          detail_level: detailLevel,
          diagram_type: diagramType
        })
      });
      if (thisGen !== requestGenRef.current) return;
      if (res.ok) {
        const data = await res.json();
        if (thisGen !== requestGenRef.current) return;
        setCanvasData(data.canvas);
        setTelemetry({
          execution_time_ms: data.execution_time_ms,
          node_count: data.canvas?.nodes?.length || 0,
          edge_count: data.canvas?.edges?.length || 0
        });
        setPan({ x: 0, y: 0 });
        setZoom(1);
      } else {
        const errData = await res.json().catch(() => ({}));
        if (thisGen !== requestGenRef.current) return;
        setError(errData.detail || 'Diagram generation failed. Please try another prompt.');
      }
    } catch (err) {
      if (thisGen === requestGenRef.current) {
        console.error("Generate canvas error:", err);
        setError("Network error communicating with canvas generation engine.");
      }
    } finally {
      if (thisGen === requestGenRef.current) {
        setLoading(false);
      }
    }
  };

  // Node Dragging Handler
  const handleNodeMouseDown = (e, node) => {
    e.stopPropagation();
    setDraggingNodeId(node.id);
    setSelectedNode(node);
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - pan.x) / zoom;
    const mouseY = (e.clientY - rect.top - pan.y) / zoom;
    setDragOffset({
      x: mouseX - node.x,
      y: mouseY - node.y
    });
  };

  const handleCanvasMouseDown = (e) => {
    if (e.button === 0 && !draggingNodeId) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e) => {
    if (draggingNodeId && canvasData) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - pan.x) / zoom;
      const mouseY = (e.clientY - rect.top - pan.y) / zoom;

      const newX = Math.round(mouseX - dragOffset.x);
      const newY = Math.round(mouseY - dragOffset.y);

      setCanvasData(prev => {
        if (!prev || !Array.isArray(prev.nodes)) return prev;
        return {
          ...prev,
          nodes: prev.nodes.map(n => n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n)
        };
      });
      setSelectedNode(prev => (prev && prev.id === draggingNodeId ? { ...prev, x: newX, y: newY } : prev));
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setDraggingNodeId(null);
    setIsPanning(false);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setDraggingNodeId(null);
      setIsPanning(false);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Zoom controls
  const handleZoom = (delta) => {
    setZoom(prev => Math.min(Math.max(0.4, prev + delta), 2.2));
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Copy Excalidraw JSON
  const handleCopyExcalidraw = async () => {
    if (!canvasData?.excalidraw_elements) return;
    const updatedElements = canvasData.excalidraw_elements.map(el => {
      const matchingNode = canvasData.nodes?.find(n => n.id === el.id);
      if (matchingNode) {
        return { ...el, x: matchingNode.x, y: matchingNode.y };
      }
      return el;
    });

    const payload = JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "https://ai-study-buddy.local",
      elements: updatedElements,
      appState: { viewBackgroundColor: "#0b1329", currentItemFontFamily: 1 }
    }, null, 2);

    try {
      await navigator.clipboard.writeText(payload);
      setCopiedExcalidraw(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedExcalidraw(false);
        copyTimeoutRef.current = null;
      }, 2500);
    } catch (err) {
      console.error("Failed to copy Excalidraw payload:", err);
      alert("Clipboard copy failed. Please grant permission or copy manually.");
    }
  };

  // Save to Study Library
  const handleSaveToLibrary = async () => {
    if (!canvasData) return;
    try {
      const res = await fetch('/api/library', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          material_type: 'canvas_diagram',
          title: canvasData.title || `Canvas: ${topic}`,
          topic: topic,
          content_json: JSON.stringify(canvasData),
          tags: `${diagramType},mcp,architecture`
        })
      });
      if (res.ok) {
        setSavedSuccess(true);
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          setSavedSuccess(false);
          saveTimeoutRef.current = null;
        }, 3000);
      } else {
        alert("Failed to save canvas diagram to library.");
      }
    } catch (err) {
      console.error("Save to library error:", err);
      alert("Network error saving canvas diagram.");
    }
  };

  const escapeXml = (str) => String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  // Adaptive geometry calculation for edges based on relative node positioning
  const getEdgeGeometry = (srcNode, tgtNode) => {
    const rawSrcW = Number(srcNode?.width);
    const rawSrcH = Number(srcNode?.height);
    const rawTgtW = Number(tgtNode?.width);
    const rawTgtH = Number(tgtNode?.height);
    const rawSrcX = Number(srcNode?.x);
    const rawSrcY = Number(srcNode?.y);
    const rawTgtX = Number(tgtNode?.x);
    const rawTgtY = Number(tgtNode?.y);

    const srcW = Number.isFinite(rawSrcW) && rawSrcW > 0 ? rawSrcW : 190;
    const srcH = Number.isFinite(rawSrcH) && rawSrcH > 0 ? rawSrcH : 70;
    const tgtW = Number.isFinite(rawTgtW) && rawTgtW > 0 ? rawTgtW : 190;
    const tgtH = Number.isFinite(rawTgtH) && rawTgtH > 0 ? rawTgtH : 70;

    const srcX = Number.isFinite(rawSrcX) ? rawSrcX : 0;
    const srcY = Number.isFinite(rawSrcY) ? rawSrcY : 0;
    const tgtX = Number.isFinite(rawTgtX) ? rawTgtX : 0;
    const tgtY = Number.isFinite(rawTgtY) ? rawTgtY : 0;

    const srcCenterX = srcX + srcW / 2;
    const srcCenterY = srcY + srcH / 2;
    const tgtCenterX = tgtX + tgtW / 2;
    const tgtCenterY = tgtY + tgtH / 2;

    const diffX = tgtCenterX - srcCenterX;
    const diffY = tgtCenterY - srcCenterY;

    let x1, y1, x2, y2, pathD;

    if (Math.abs(diffX) >= Math.abs(diffY)) {
      if (diffX >= 0) {
        x1 = srcX + srcW;
        y1 = srcCenterY;
        x2 = tgtX;
        y2 = tgtCenterY;
      } else {
        x1 = srcX;
        y1 = srcCenterY;
        x2 = tgtX + tgtW;
        y2 = tgtCenterY;
      }
      const dx = Math.max(Math.abs(x2 - x1) * 0.5, 30);
      pathD = `M ${x1} ${y1} C ${x1 + (diffX >= 0 ? dx : -dx)} ${y1}, ${x2 + (diffX >= 0 ? -dx : dx)} ${y2}, ${x2} ${y2}`;
    } else {
      if (diffY >= 0) {
        x1 = srcCenterX;
        y1 = srcY + srcH;
        x2 = tgtCenterX;
        y2 = tgtY;
      } else {
        x1 = srcCenterX;
        y1 = srcY;
        x2 = tgtCenterX;
        y2 = tgtY + tgtH;
      }
      const dy = Math.max(Math.abs(y2 - y1) * 0.5, 30);
      pathD = `M ${x1} ${y1} C ${x1} ${y1 + (diffY >= 0 ? dy : -dy)}, ${x2} ${y2 + (diffY >= 0 ? -dy : dy)}, ${x2} ${y2}`;
    }

    return { x1, y1, x2, y2, pathD, midX: (x1 + x2) / 2, midY: (y1 + y2) / 2 };
  };

  // Download complete standalone SVG containing both edges and node rectangles with labels
  const handleDownloadSvg = () => {
    if (!canvasData?.nodes?.length) return;
    
    // Construct complete standalone SVG with safely escaped nodes and connectors
    const nodesSvg = canvasData.nodes.map(n => {
      const rawX = Number(n.x);
      const rawY = Number(n.y);
      const rawW = Number(n.width);
      const rawH = Number(n.height);
      const x = Number.isFinite(rawX) ? rawX : 100;
      const y = Number.isFinite(rawY) ? rawY : 100;
      const w = Number.isFinite(rawW) && rawW > 0 ? rawW : 190;
      const h = Number.isFinite(rawH) && rawH > 0 ? rawH : 75;
      const label = escapeXml(n.label || 'Node');
      const sub = escapeXml(n.subtitle || '');
      return `
        <g transform="translate(${x}, ${y})">
          <rect width="${w}" height="${h}" rx="12" fill="#0f172a" stroke="#10b981" stroke-width="2" />
          <text x="${w/2}" y="32" fill="#f8fafc" font-family="monospace" font-size="12" font-weight="bold" text-anchor="middle">${label}</text>
          <text x="${w/2}" y="52" fill="#94a3b8" font-family="sans-serif" font-size="10" text-anchor="middle">${sub}</text>
        </g>
      `;
    }).join('\n');

    const edgesSvg = (canvasData.edges || []).map(edge => {
      const srcNode = canvasData.nodes.find(n => n.id === edge.source);
      const tgtNode = canvasData.nodes.find(n => n.id === edge.target);
      if (!srcNode || !tgtNode) return '';
      const { pathD, midX, midY } = getEdgeGeometry(srcNode, tgtNode);
      const strokeColor = edge.style === 'dashed' ? '#94a3b8' : '#10b981';
      const dash = edge.style === 'dashed' ? ' stroke-dasharray="5,5"' : '';
      const label = edge.label ? `
        <g transform="translate(${midX}, ${midY})">
          <rect x="-45" y="-12" width="90" height="20" rx="4" fill="#0f172a" stroke="#334155" stroke-width="1" />
          <text text-anchor="middle" y="3" fill="#cbd5e1" font-family="monospace" font-size="9">${escapeXml(edge.label)}</text>
        </g>` : '';
      return `
        <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="2.5"${dash} marker-end="url(#arrowhead)" />
        ${label}
      `;
    }).join('\n');

    const fullSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1400" viewBox="0 0 2400 1400" style="background-color: #020617;">
        <defs>
          <marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="3.5" markerWidth="10" markerHeight="7" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#10b981" />
          </marker>
          <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
          </marker>
        </defs>
        ${edgesSvg}
        ${nodesSvg}
      </svg>
    `.trim();

    const blob = new Blob([fullSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(topic || 'canvas').toLowerCase().replace(/\s+/g, '_')}_architecture.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Helper for node category styles
  const getCategoryTheme = (category) => {
    switch (category) {
      case 'ingress':
        return { bg: 'bg-emerald-950/80', border: 'border-emerald-400', badge: 'text-emerald-300 bg-emerald-500/20' };
      case 'core':
        return { bg: 'bg-teal-950/80', border: 'border-teal-400', badge: 'text-teal-300 bg-teal-500/20' };
      case 'database':
        return { bg: 'bg-cyan-950/80', border: 'border-cyan-400', badge: 'text-cyan-300 bg-cyan-500/20' };
      case 'security':
        return { bg: 'bg-purple-950/80', border: 'border-purple-400', badge: 'text-purple-300 bg-purple-500/20' };
      case 'telemetry':
        return { bg: 'bg-amber-950/80', border: 'border-amber-400', badge: 'text-amber-300 bg-amber-500/20' };
      case 'service':
        return { bg: 'bg-blue-950/80', border: 'border-blue-400', badge: 'text-blue-300 bg-blue-500/20' };
      default:
        return { bg: 'bg-slate-900/80', border: 'border-slate-500', badge: 'text-slate-300 bg-slate-700/30' };
    }
  };

  // Calculate adaptive curve for SVG edge lines
  const renderEdge = (edge) => {
    if (!canvasData?.nodes) return null;
    const srcNode = canvasData.nodes.find(n => n.id === edge.source);
    const tgtNode = canvasData.nodes.find(n => n.id === edge.target);
    if (!srcNode || !tgtNode) return null;

    const { pathD, midX, midY } = getEdgeGeometry(srcNode, tgtNode);

    return (
      <g key={edge.id} className="group">
        <path
          d={pathD}
          fill="none"
          stroke={edge.style === 'dashed' ? '#94a3b8' : '#10b981'}
          strokeWidth="2.5"
          strokeDasharray={edge.style === 'dashed' ? '5,5' : 'none'}
          markerEnd="url(#arrowhead)"
          className="transition-all duration-200 group-hover:stroke-emerald-300 group-hover:stroke-[3.5px]"
        />
        {edge.label && (
          <g transform={`translate(${midX}, ${midY})`}>
            <rect
              x="-45"
              y="-12"
              width="90"
              height="20"
              rx="4"
              fill="#0f172a"
              stroke="#334155"
              strokeWidth="1"
              className="shadow-sm"
            />
            <text
              textAnchor="middle"
              y="2"
              fill="#94a3b8"
              fontSize="10"
              fontFamily="monospace"
              className="select-none"
            >
              {edge.label.length > 14 ? edge.label.substring(0, 14) + '..' : edge.label}
            </text>
          </g>
        )}
      </g>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col pt-16">
      {/* Top Banner / Controls */}
      <div className="glass-panel border-b border-white/10 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-16 z-30">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
            <Layout className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white">Visual Canvas Studio</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" /> AI Visuals
              </span>
            </div>
            <p className="text-xs text-slate-400">Interactive visual canvas for flowcharts, mind maps, and concept diagrams</p>
          </div>
        </div>

        {/* AI Prompt Input Bar */}
        <form onSubmit={handleGenerate} className="flex-1 max-w-2xl flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Photosynthesis, How the Internet Works, Water Cycle, Cell Division..."
              className="glass-input w-full text-sm py-2 px-3 pl-9 rounded-xl border border-white/10 focus:border-emerald-500/50 text-white placeholder-slate-500"
            />
            <Sparkles className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5" />
          </div>

          <select
            value={detailLevel}
            onChange={(e) => setDetailLevel(e.target.value)}
            className="glass-input text-xs py-2 px-2.5 rounded-xl border border-white/10 text-slate-300"
          >
            <option value="overview">Overview</option>
            <option value="standard">Standard</option>
            <option value="deep_dive">Deep Dive</option>
          </select>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50"
          >
            {loading ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Generate Diagram
          </button>
        </form>

        {/* Right Action Icons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMcpModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 text-xs font-medium transition-all"
            title="App Integrations (Claude Desktop & Whiteboards)"
          >
            <Terminal className="w-3.5 h-3.5" />
            Integrations
          </button>

          <button
            onClick={handleSaveToLibrary}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-white/10 transition-all"
            title="Save to Study Library"
          >
            {savedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
            {savedSuccess ? 'Saved!' : 'Save'}
          </button>

          <button
            onClick={handleCopyExcalidraw}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-white/10 transition-all"
            title="Copy board to clipboard for whiteboard apps"
          >
            {copiedExcalidraw ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedExcalidraw ? 'Board Copied!' : 'Copy Board'}
          </button>

          <button
            onClick={() => setShowMermaidModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-white/10 transition-all"
            title="View Structured Flowchart"
          >
            <Code className="w-3.5 h-3.5" />
            Flowchart View
          </button>

          <button
            onClick={handleDownloadSvg}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-white/10 transition-all"
            title="Download Vector Graphic (SVG)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 my-2 p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs font-mono flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-slate-400 hover:text-white px-2 py-0.5">✕</button>
        </div>
      )}

      {/* Main Studio Viewport */}
      <div className="flex-1 relative overflow-hidden flex bg-[#030712]">
        {/* Floating Canvas Controls */}
        <div className="absolute bottom-6 left-6 z-20 flex items-center gap-2 glass-panel p-1.5 rounded-2xl border border-white/10 shadow-2xl">
          <button 
            onClick={() => handleZoom(0.15)} 
            className="p-2 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-slate-400 px-1">{Math.round(zoom * 100)}%</span>
          <button 
            onClick={() => handleZoom(-0.15)} 
            className="p-2 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-4 bg-white/10 my-auto" />
          <button 
            onClick={handleResetView} 
            className="p-2 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
            title="Reset View"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Telemetry pill */}
        {telemetry && (
          <div className="absolute top-4 left-6 z-20 flex items-center gap-3 px-3 py-1.5 rounded-xl glass-panel text-[11px] text-slate-400 border border-white/10 font-mono">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {telemetry.execution_time_ms}ms
            </span>
            <span>•</span>
            <span>{telemetry.node_count} Concepts</span>
            <span>•</span>
            <span>{telemetry.edge_count} Connections</span>
          </div>
        )}

        {/* Interactive Infinite Canvas Board */}
        <div 
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="flex-1 h-full w-full relative cursor-grab active:cursor-grabbing select-none overflow-hidden"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(16, 185, 129, 0.12) 1px, transparent 1px)`,
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`
          }}
        >
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-30">
              <div className="p-4 rounded-2xl glass-panel-glow flex flex-col items-center gap-3 border border-emerald-500/30">
                <Sparkles className="w-8 h-8 text-emerald-400 animate-pulse" />
                <div className="text-sm font-semibold text-white">Generating Study Diagram...</div>
                <div className="text-xs text-slate-400">Organizing concepts, relationships & visual layout</div>
              </div>
            </div>
          ) : null}

          {/* Canvas SVG Container for Edges and Bounds */}
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              position: 'absolute',
              width: '2000px',
              height: '1400px'
            }}
          >
            {/* SVG Connecting Curves */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#10b981" />
                </marker>
              </defs>

              {canvasData?.edges?.map(renderEdge)}
            </svg>

            {/* Render Draggable Nodes */}
            {canvasData?.nodes?.map((node) => {
              const theme = getCategoryTheme(node.category);
              const isSelected = selectedNode?.id === node.id;
              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                  style={{
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: `${node.width || 190}px`,
                    height: `${node.height || 75}px`
                  }}
                  className={`absolute z-10 p-3 rounded-2xl border transition-shadow cursor-move flex flex-col justify-between ${theme.bg} ${theme.border} ${
                    isSelected ? 'ring-2 ring-emerald-400 shadow-xl shadow-emerald-950/70 scale-[1.02]' : 'hover:border-emerald-300 shadow-lg'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-semibold text-xs text-white leading-tight truncate">
                      {node.label}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase ${theme.badge}`}>
                      {node.category || 'node'}
                    </span>
                  </div>

                  {node.subtitle && (
                    <div className="text-[11px] text-slate-300 truncate">
                      {node.subtitle}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-white/5">
                    <span className="text-emerald-400 font-medium">● Active Node</span>
                    <Info className="w-3 h-3 text-slate-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Inspector Drawer (Node Details) */}
        {selectedNode && (
          <div className="w-80 glass-panel border-l border-white/10 p-5 flex flex-col gap-4 z-20 animate-fade-in bg-slate-950/90 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-sm text-white">Node Inspector</h3>
              </div>
              <button 
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-mono text-slate-400">Concept Name</label>
                <div className="text-sm font-bold text-white mt-0.5">{selectedNode.label}</div>
                {selectedNode.subtitle && (
                  <div className="text-xs text-emerald-400">{selectedNode.subtitle}</div>
                )}
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono text-slate-400">Category</label>
                <div className="mt-1">
                  <span className="px-2 py-0.5 rounded text-xs font-mono uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {selectedNode.category || 'Standard'}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono text-slate-400">Concept Summary</label>
                <div className="text-xs text-slate-300 mt-1 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-white/5">
                  {selectedNode.details || "Key concept in this study diagram."}
                </div>
              </div>

              <div className="pt-2">
                <label className="text-[10px] uppercase font-mono text-slate-400">Concept Status</label>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Active & Explorable Concept</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MCP Connection Hub Modal */}
      {showMcpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass-panel w-full max-w-2xl rounded-2xl border border-emerald-500/30 p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Study Tools & App Integrations</h3>
                  <p className="text-xs text-slate-400">Connect note-taking apps and visual tools to Study Buddy</p>
                </div>
              </div>
              <button onClick={() => setShowMcpModal(false)} className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {mcpConfigError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 font-mono text-[11px] flex items-center justify-between">
                  <span>⚠️ {mcpConfigError}</span>
                  <button 
                    onClick={fetchMcpConfig} 
                    className="px-2 py-0.5 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-200 text-[10px]"
                  >
                    Retry
                  </button>
                </div>
              )}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10">
                <div className="flex items-center justify-between text-slate-300 font-medium mb-1">
                  <span>Connection Status</span>
                  <span className={`${mcpConfigError ? 'text-rose-400' : mcpConfig?.server_status === 'offline' ? 'text-amber-400' : 'text-emerald-400'} font-mono`}>
                    ● {mcpConfigError ? 'Connection Error' : mcpConfig?.server_status === 'offline' ? 'Offline' : (mcpConfig ? 'Connected & Ready' : (mcpConfigLoading ? 'Connecting...' : 'Ready'))}
                  </span>
                </div>
                <div className="text-slate-400 text-[11px]">
                  Connection Address: <code className="text-emerald-300">{mcpConfig?.endpoint || (typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : 'http://127.0.0.1:8000/api/mcp')}</code>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1.5">
                  Desktop App Integration (<code className="text-slate-400">study_buddy_config.json</code>)
                </label>
                <pre className="p-3 rounded-xl bg-slate-950 font-mono text-[11px] text-emerald-300 border border-white/10 overflow-x-auto">
                  {JSON.stringify(mcpConfig?.claude_desktop_config || {
                    "mcpServers": {
                      "ai-study-buddy": {
                        "command": "python",
                        "args": ["backend/mcp_server.py"]
                      }
                    }
                  }, null, 2)}
                </pre>
              </div>

              <div className="text-slate-400 text-[11px] leading-relaxed">
                💡 <b>How it works:</b> Connect your external note-taking tools, desktop editors, or whiteboard canvas to Study Buddy to automatically sync diagrams and query your study materials.
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowMcpModal(false)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mermaid Spec Modal */}
      {showMermaidModal && canvasData?.mermaid_code && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass-panel w-full max-w-3xl rounded-2xl border border-white/10 p-6 flex flex-col gap-4 shadow-2xl max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Synchronized Mermaid.js Code</h3>
              </div>
              <button onClick={() => setShowMermaidModal(false)} className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <MermaidViewer code={canvasData.mermaid_code} title={canvasData.title} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
