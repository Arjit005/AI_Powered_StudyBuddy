import json
import logging
import math
import re
from typing import Dict, Any, List, Optional
from backend.ai_service import AIService, AIServiceError
from backend.database import SessionLocal
from backend.models import Conversation, ChatHistory

logger = logging.getLogger("mcp_service")

class MCPService:
    """
    Model Context Protocol (MCP) Service for AI Study Buddy.
    Exposes standards-compliant MCP tools, resources, and prompt templates,
    enabling seamless integration with Canvas tools (Excalidraw, Obsidian Canvas,
    Claude Desktop, Cursor, Antigravity, and custom Visual Canvas Studio).
    """

    @classmethod
    def get_registered_tools(cls) -> List[Dict[str, Any]]:
        return [
            {
                "name": "generate_canvas_diagram",
                "description": "Generates a structured, multi-layer visual diagram (nodes, edges, geometry, categories, and Excalidraw-compatible elements) for canvas tools and whiteboards.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "topic": {
                            "type": "string",
                            "description": "The technical topic, system architecture, or process flow to model visually."
                        },
                        "detail_level": {
                            "type": "string",
                            "enum": ["overview", "standard", "deep_dive"],
                            "default": "standard",
                            "description": "Granularity of diagram components."
                        },
                        "diagram_type": {
                            "type": "string",
                            "enum": ["architecture", "flowchart", "sequence", "mindmap"],
                            "default": "architecture",
                            "description": "Visual layout style."
                        }
                    },
                    "required": ["topic"]
                }
            },
            {
                "name": "generate_mermaid_spec",
                "description": "Generates validated Mermaid.js vector diagram code and component breakdowns for technical topics.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "topic": {
                            "type": "string",
                            "description": "The subject or workflow to generate Mermaid code for."
                        },
                        "diagram_type": {
                            "type": "string",
                            "enum": ["flowchart", "sequence", "class", "state", "er", "gantt"],
                            "default": "flowchart"
                        }
                    },
                    "required": ["topic"]
                }
            },
            {
                "name": "export_to_canvas_json",
                "description": "Transforms arbitrary markdown notes or concept hierarchies into Canvas/Excalidraw-compatible geometric node elements.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "content": {
                            "type": "string",
                            "description": "Raw markdown text or bulleted list of components to convert to visual nodes."
                        },
                        "layout": {
                            "type": "string",
                            "enum": ["horizontal_flow", "vertical_tree", "grid"],
                            "default": "horizontal_flow"
                        }
                    },
                    "required": ["content"]
                }
            },
            {
                "name": "query_study_memory",
                "description": "Queries the AI Study Buddy hybrid memory store (Tier-1 working buffer and Tier-2 episodic summaries) for context retrieval.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "conversation_id": {
                            "type": "integer",
                            "description": "Optional specific conversation ID. If omitted, returns latest active sessions."
                        },
                        "limit": {
                            "type": "integer",
                            "default": 5,
                            "description": "Max number of messages or sessions to return."
                        }
                    }
                }
            },
            {
                "name": "create_study_flashcards",
                "description": "Generates structured active-recall flashcard pairs (question/answer) for study concepts.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "topic": {
                            "type": "string",
                            "description": "The concept or chapter to generate flashcards for."
                        },
                        "count": {
                            "type": "integer",
                            "default": 5,
                            "description": "Number of cards to generate (3-10)."
                        }
                    },
                    "required": ["topic"]
                }
            }
        ]

    @classmethod
    def execute_tool(cls, name: str, arguments: Dict[str, Any], user_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Executes a registered tool by name with arguments.
        """
        if name == "generate_canvas_diagram":
            raw_topic = arguments.get("topic")
            topic = str(raw_topic).strip() if raw_topic is not None else "System Architecture"
            if not topic:
                topic = "System Architecture"
            detail = arguments.get("detail_level", "standard")
            if detail not in ("overview", "standard", "deep_dive"):
                detail = "standard"
            dtype = arguments.get("diagram_type", "architecture")
            if dtype not in ("architecture", "flowchart", "sequence", "mindmap"):
                dtype = "architecture"
            return cls._generate_canvas_diagram(topic, detail, dtype)

        elif name == "generate_mermaid_spec":
            raw_topic = arguments.get("topic")
            topic = str(raw_topic).strip() if raw_topic is not None else "System Architecture"
            if not topic:
                topic = "System Architecture"
            diagram_type = arguments.get("diagram_type", "flowchart")
            if diagram_type not in ("flowchart", "sequence", "class", "state", "er", "gantt"):
                diagram_type = "flowchart"
            return AIService.generate_detailed_mermaid_diagram(topic, diagram_type=diagram_type)

        elif name == "export_to_canvas_json":
            raw_content = arguments.get("content", "")
            content = str(raw_content) if raw_content is not None else ""
            layout = arguments.get("layout", "horizontal_flow")
            if layout not in ("horizontal_flow", "vertical_tree", "grid"):
                layout = "horizontal_flow"
            return cls._export_notes_to_canvas(content, layout)

        elif name == "query_study_memory":
            if user_id is None:
                raise PermissionError("Authentication is required to query private study memory.")
            cid = arguments.get("conversation_id")
            if cid is not None and (not isinstance(cid, int) or isinstance(cid, bool) or cid < 1):
                cid = None
            limit = arguments.get("limit", 5)
            if not isinstance(limit, int) or isinstance(limit, bool) or limit < 1:
                limit = 5
            limit = min(limit, 100)
            return cls._query_study_memory(cid, limit, user_id=user_id)

        elif name == "create_study_flashcards":
            raw_topic = arguments.get("topic")
            if raw_topic is None or not str(raw_topic).strip():
                raise ValueError("Argument 'topic' is required and cannot be empty.")
            topic = str(raw_topic).strip()
            count = arguments.get("count", 5)
            if not isinstance(count, int) or isinstance(count, bool):
                count = 5
            count = min(max(count, 3), 10)
            return AIService.generate_flashcards(topic, count=count)

        else:
            raise ValueError(f"Unknown MCP Tool: '{name}'")

    @classmethod
    def _generate_canvas_diagram(cls, topic: str, detail_level: str = "standard", diagram_type: str = "architecture") -> Dict[str, Any]:
        """
        Generates production-ready canvas graph data:
        - Structured Node Elements with position (x, y), shape, dimensions, category, and color styling.
        - Connected Directional Edges with labels.
        - Excalidraw-compatible element array for direct import.
        - Synchronized Mermaid.js code for dual-rendering.
        """
        prompt = f"""
        You are a Model Context Protocol (MCP) Canvas & Systems Architect.
        Generate a comprehensive, beautifully laid-out node-and-edge visual canvas graph for: "{topic}".
        Diagram Type: {diagram_type}
        Detail Level: {detail_level}

        Generate between 8 and 14 distinct nodes distributed across 3 to 4 logical tiers/phases.
        Calculate reasonable (x, y) coordinates on a 1200x800 canvas grid so nodes don't overlap.
        Categories to use: "ingress", "core", "service", "database", "security", "telemetry", "external".

        Return ONLY a raw valid JSON object with the following exact structure:
        {{
            "title": "{topic} Canvas Architecture",
            "description": "Visual multi-tier diagram for {topic}",
            "diagram_type": "{diagram_type}",
            "canvas_bounds": {{ "width": 1300, "height": 850 }},
            "nodes": [
                {{
                    "id": "node_1",
                    "label": "Client Interface",
                    "subtitle": "Web / Mobile Client",
                    "category": "ingress",
                    "shape": "rectangle",
                    "x": 80,
                    "y": 150,
                    "width": 190,
                    "height": 75,
                    "color": "#10b981",
                    "border": "#34d399",
                    "details": "User interaction point with HTTPS & WebSocket support"
                }}
            ],
            "edges": [
                {{
                    "id": "edge_1",
                    "source": "node_1",
                    "target": "node_2",
                    "label": "REST / API",
                    "style": "solid",
                    "directional": true
                }}
            ],
            "subsystems": [
                {{ "name": "Ingress Layer", "nodes": ["node_1"] }}
            ]
        }}
        """
        try:
            response = AIService._generate_content_safe(prompt, generation_config={"response_mime_type": "application/json"})
            cleaned = AIService._clean_json_response(response.text)
            parsed = json.loads(cleaned)
            if isinstance(parsed, dict) and "nodes" in parsed and isinstance(parsed["nodes"], list):
                def _is_valid_coord(val):
                    # Coordinate bounds check: finite, between -50,000 and +50,000
                    return isinstance(val, (int, float)) and not isinstance(val, bool) and math.isfinite(val) and -50000 <= val <= 50000

                def _is_valid_dim(val):
                    # Dimension bounds check: finite positive, between 1 and 10,000
                    return isinstance(val, (int, float)) and not isinstance(val, bool) and math.isfinite(val) and 1 <= val <= 10000

                valid_nodes = []
                valid_node_ids = set()
                for n in parsed["nodes"]:
                    if isinstance(n, dict) and isinstance(n.get("id"), str) and isinstance(n.get("label"), str):
                        # Ensure numeric geometry if coordinates are provided
                        if "x" not in n or not _is_valid_coord(n["x"]):
                            n["x"] = 0
                        if "y" not in n or not _is_valid_coord(n["y"]):
                            n["y"] = 0
                        if "width" not in n or not _is_valid_dim(n["width"]):
                            n["width"] = 160
                        if "height" not in n or not _is_valid_dim(n["height"]):
                            n["height"] = 60
                        valid_nodes.append(n)
                        valid_node_ids.add(n["id"])

                # Filter edges to only those connecting existing valid nodes
                valid_edges = [
                    e for e in parsed.get("edges", [])
                    if isinstance(e, dict)
                    and isinstance(e.get("source"), str)
                    and isinstance(e.get("target"), str)
                    and e["source"] in valid_node_ids
                    and e["target"] in valid_node_ids
                ]
                if len(valid_nodes) >= 3:
                    parsed["nodes"] = valid_nodes
                    parsed["edges"] = valid_edges
                    # Enrich with Excalidraw compatible elements and Mermaid code
                    parsed["excalidraw_elements"] = cls._convert_to_excalidraw_elements(valid_nodes, valid_edges)
                    parsed["mermaid_code"] = cls._nodes_to_mermaid(valid_nodes, valid_edges)
                    return parsed
            raise ValueError("Generated canvas diagram did not meet validation criteria.")
        except AIServiceError:
            raise
        except Exception as err:
            logger.exception("Canvas generation returned an invalid response.")
            raise AIServiceError() from err

    @classmethod
    def _generate_fallback_canvas_graph(cls, topic: str) -> Dict[str, Any]:
        """
        Generates an aesthetically balanced multi-tier canvas diagram layout.
        """
        safe_topic = topic.strip().title()
        nodes = [
            {
                "id": "node_client",
                "label": "User / Client",
                "subtitle": "Web, Mobile & CLI",
                "category": "ingress",
                "shape": "rectangle",
                "x": 60,
                "y": 240,
                "width": 180,
                "height": 70,
                "color": "#064e3b",
                "border": "#10b981",
                "details": "End-user interface initiating requests over HTTPS/WSS."
            },
            {
                "id": "node_gateway",
                "label": "API Gateway",
                "subtitle": "Rate Limiter & Ingress",
                "category": "security",
                "shape": "hexagon",
                "x": 300,
                "y": 240,
                "width": 190,
                "height": 70,
                "color": "#1e293b",
                "border": "#38bdf8",
                "details": "Handles token verification, sliding-window rate limiting, and CORS."
            },
            {
                "id": "node_auth",
                "label": "Auth & PromptGuard",
                "subtitle": "Security Boundary",
                "category": "security",
                "shape": "rectangle",
                "x": 300,
                "y": 80,
                "width": 190,
                "height": 70,
                "color": "#311042",
                "border": "#c084fc",
                "details": "JWT verification and anti-jailbreak prompt sanitization."
            },
            {
                "id": "node_engine",
                "label": f"{safe_topic} Engine",
                "subtitle": "Core Orchestration",
                "category": "core",
                "shape": "rectangle",
                "x": 560,
                "y": 240,
                "width": 210,
                "height": 75,
                "color": "#064e3b",
                "border": "#34d399",
                "details": f"Main business logic and decision pipeline for {safe_topic}."
            },
            {
                "id": "node_hybrid_mem",
                "label": "Hybrid Memory Store",
                "subtitle": "Working Buffer + Summary",
                "category": "service",
                "shape": "cylinder",
                "x": 560,
                "y": 420,
                "width": 210,
                "height": 70,
                "color": "#172554",
                "border": "#60a5fa",
                "details": "Tier-1 short-term sliding turns + Tier-2 episodic condensed summaries."
            },
            {
                "id": "node_ai_router",
                "label": "AI Inference Router",
                "subtitle": "Gemini / Local Fallback",
                "category": "service",
                "shape": "rectangle",
                "x": 840,
                "y": 160,
                "width": 200,
                "height": 70,
                "color": "#451a03",
                "border": "#fb923c",
                "details": "Multi-provider LLM failover for structured and vector diagrams."
            },
            {
                "id": "node_database",
                "label": "Persistence Layer",
                "subtitle": "SQLite / PostgreSQL",
                "category": "database",
                "shape": "cylinder",
                "x": 840,
                "y": 320,
                "width": 200,
                "height": 70,
                "color": "#042f2e",
                "border": "#2dd4bf",
                "details": "ACID compliance for user accounts, sessions, and chat history."
            },
            {
                "id": "node_telemetry",
                "label": "Observability & MCP",
                "subtitle": "Audit & Tool Bus",
                "category": "telemetry",
                "shape": "rectangle",
                "x": 840,
                "y": 480,
                "width": 200,
                "height": 70,
                "color": "#1c1917",
                "border": "#a8a29e",
                "details": "Model Context Protocol JSON-RPC stream and telemetry monitors."
            }
        ]

        edges = [
            {"id": "e1", "source": "node_client", "target": "node_gateway", "label": "HTTPS Request", "style": "solid", "directional": True},
            {"id": "e2", "source": "node_gateway", "target": "node_auth", "label": "Validate Auth", "style": "dashed", "directional": True},
            {"id": "e3", "source": "node_gateway", "target": "node_engine", "label": "Forward Request", "style": "solid", "directional": True},
            {"id": "e4", "source": "node_engine", "target": "node_hybrid_mem", "label": "Context Retrieval", "style": "solid", "directional": True},
            {"id": "e5", "source": "node_engine", "target": "node_ai_router", "label": "Prompt & Schema", "style": "solid", "directional": True},
            {"id": "e6", "source": "node_engine", "target": "node_database", "label": "Save State", "style": "solid", "directional": True},
            {"id": "e7", "source": "node_engine", "target": "node_telemetry", "label": "Metrics & MCP", "style": "dotted", "directional": True}
        ]

        subsystems = [
            {"name": "Client Ingress", "nodes": ["node_client", "node_gateway"]},
            {"name": "Security & Gatekeeper", "nodes": ["node_auth"]},
            {"name": "Core Intelligence", "nodes": ["node_engine", "node_hybrid_mem"]},
            {"name": "Downstream Services", "nodes": ["node_ai_router", "node_database", "node_telemetry"]}
        ]

        return {
            "title": f"System Architecture: {safe_topic}",
            "description": f"Engineered multi-tier visual canvas representation of {safe_topic}.",
            "diagram_type": "architecture",
            "canvas_bounds": {"width": 1200, "height": 650},
            "nodes": nodes,
            "edges": edges,
            "subsystems": subsystems
        }

    @classmethod
    def _convert_to_excalidraw_elements(cls, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Converts nodes and edges into Excalidraw standard JSON elements
        so the output can be directly pasted or imported into Excalidraw.
        """
        elements = []
        node_map = {}

        # 1. Create Rectangle and Text elements for each node
        for idx, node in enumerate(nodes):
            nid = node.get("id", f"node_{idx}")
            x = float(node.get("x", 100))
            y = float(node.get("y", 100))
            w = float(node.get("width", 180))
            h = float(node.get("height", 70))
            label = node.get("label", "Node")
            subtitle = node.get("subtitle", "")
            full_text = f"{label}\n{subtitle}" if subtitle else label

            rect_id = f"rect_{nid}"
            text_id = f"text_{nid}"
            node_map[nid] = {"x": x, "y": y, "w": w, "h": h, "rect_id": rect_id}

            # Rect element
            elements.append({
                "id": rect_id,
                "type": "rectangle",
                "x": x,
                "y": y,
                "width": w,
                "height": h,
                "angle": 0,
                "strokeColor": node.get("border", "#10b981"),
                "backgroundColor": node.get("color", "#064e3b"),
                "fillStyle": "solid",
                "strokeWidth": 2,
                "strokeStyle": "solid",
                "roughness": 1,
                "opacity": 100,
                "roundness": {"type": 3},
                "groupIds": [f"grp_{nid}"],
                "boundElements": [{"id": text_id, "type": "text"}]
            })

            # Text element
            elements.append({
                "id": text_id,
                "type": "text",
                "x": x + 10,
                "y": y + (h / 4),
                "width": w - 20,
                "height": h / 2,
                "angle": 0,
                "strokeColor": "#f8fafc",
                "backgroundColor": "transparent",
                "fillStyle": "solid",
                "strokeWidth": 1,
                "strokeStyle": "solid",
                "roughness": 0,
                "opacity": 100,
                "text": full_text,
                "fontSize": 14,
                "fontFamily": 1,
                "textAlign": "center",
                "verticalAlign": "middle",
                "containerId": rect_id,
                "groupIds": [f"grp_{nid}"]
            })

        # 2. Create Arrows for edges
        for idx, edge in enumerate(edges):
            src_id = edge.get("source")
            tgt_id = edge.get("target")
            if src_id in node_map and tgt_id in node_map:
                src = node_map[src_id]
                tgt = node_map[tgt_id]
                start_x = src["x"] + src["w"]
                start_y = src["y"] + (src["h"] / 2)
                end_x = tgt["x"]
                end_y = tgt["y"] + (tgt["h"] / 2)
                dx = end_x - start_x
                dy = end_y - start_y
                min_x = min(start_x, end_x)
                min_y = min(start_y, end_y)
                p1 = [start_x - min_x, start_y - min_y]
                p2 = [end_x - min_x, end_y - min_y]

                elements.append({
                    "id": f"arrow_{idx}",
                    "type": "arrow",
                    "x": min_x,
                    "y": min_y,
                    "width": max(1, abs(dx)),
                    "height": max(1, abs(dy)),
                    "angle": 0,
                    "strokeColor": "#34d399",
                    "backgroundColor": "transparent",
                    "fillStyle": "solid",
                    "strokeWidth": 2,
                    "strokeStyle": "solid" if edge.get("style") != "dashed" else "dashed",
                    "roughness": 1,
                    "opacity": 90,
                    "points": [p1, p2],
                    "endArrowhead": "arrow"
                })

        return elements

    @staticmethod
    def _escape_mermaid_label(text: str) -> str:
        """
        Escapes Mermaid special characters, HTML markup, and delimiters to avoid syntax breakage.
        """
        if not text:
            return ""
        clean = str(text).replace('\\', '/').replace('"', "'").replace('[', '(').replace(']', ')')
        clean = clean.replace('{', '(').replace('}', ')').replace('|', '/').replace(';', ',')
        clean = clean.replace('<', '&lt;').replace('>', '&gt;').replace('\n', ' ')
        return clean[:120].strip()

    @classmethod
    def _nodes_to_mermaid(cls, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> str:
        """
        Translates raw canvas nodes and edges to valid Mermaid flowchart code.
        """
        lines = ["flowchart LR"]
        for node in nodes:
            nid = re.sub(r'[^a-zA-Z0-9_]', '_', str(node.get("id", "node")))
            label = cls._escape_mermaid_label(node.get("label", "Node"))
            sub = cls._escape_mermaid_label(node.get("subtitle", ""))
            display = f"{label}<br/><i>{sub}</i>" if sub else label
            lines.append(f'    {nid}["{display}"]')

        for edge in edges:
            src = re.sub(r'[^a-zA-Z0-9_]', '_', str(edge.get("source", "node1")))
            tgt = re.sub(r'[^a-zA-Z0-9_]', '_', str(edge.get("target", "node2")))
            lbl = cls._escape_mermaid_label(edge.get("label", ""))
            style = edge.get("style", "solid")
            if style == "dashed":
                arrow = f"-.->|{lbl}|" if lbl else "-.->"
            else:
                arrow = f"-->|{lbl}|" if lbl else "-->"
            lines.append(f"    {src} {arrow} {tgt}")

        return "\n".join(lines)

    @classmethod
    def _export_notes_to_canvas(cls, content: str, layout: str = "horizontal_flow") -> Dict[str, Any]:
        """
        Takes notes or text content and builds a node/edge representation.
        """
        lines = [re.sub(r'^(?:[-*#>]|\d+\.)\s*', '', line.strip()).strip() for line in content.strip().split("\n") if line.strip()]
        lines = [l for l in lines if l]
        if not lines:
            lines = ["Core Concept", "Key Principle", "Implementation Step", "Final Outcome"]

        nodes = []
        edges = []
        x_start = 80
        y_start = 180

        for idx, line in enumerate(lines[:10]):
            nid = f"step_{idx + 1}"
            if layout == "vertical_tree":
                x = x_start
                y = y_start + (idx * 110)
            elif layout == "grid":
                col = idx % 3
                row = idx // 3
                x = x_start + (col * 260)
                y = y_start + (row * 120)
            else:  # horizontal_flow
                x = x_start + (idx * 240)
                y = y_start + ((idx % 2) * 60)

            nodes.append({
                "id": nid,
                "label": line[:28],
                "subtitle": f"Step {idx + 1}",
                "category": "core",
                "shape": "rectangle",
                "x": x,
                "y": y,
                "width": 190,
                "height": 70,
                "color": "#064e3b",
                "border": "#10b981",
                "details": line
            })

            if idx > 0:
                edges.append({
                    "id": f"flow_edge_{idx}",
                    "source": f"step_{idx}",
                    "target": nid,
                    "label": "Next",
                    "style": "solid",
                    "directional": True
                })

        return {
            "title": "Converted Canvas Document",
            "description": f"Canvas visual representation ({len(nodes)} nodes) using {layout}.",
            "nodes": nodes,
            "edges": edges,
            "excalidraw_elements": cls._convert_to_excalidraw_elements(nodes, edges),
            "mermaid_code": cls._nodes_to_mermaid(nodes, edges)
        }

    @classmethod
    def _query_study_memory(cls, conversation_id: Optional[int] = None, limit: int = 5, user_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Exposes hybrid memory via MCP protocol scoped to the authenticated user.
        """
        if user_id is None:
            raise PermissionError("Authentication is required to query private study memory.")

        db = SessionLocal()
        try:
            if conversation_id:
                conv_q = db.query(Conversation).filter(Conversation.id == conversation_id)
                conv_q = conv_q.filter(Conversation.user_id == user_id)
                conv = conv_q.first()
                if not conv:
                    return {"status": "not_found", "message": f"Conversation {conversation_id} not found or unauthorized"}
                chats = db.query(ChatHistory).filter(ChatHistory.conversation_id == conversation_id).order_by(ChatHistory.id.desc()).limit(limit).all()
                return {
                    "conversation_id": conv.id,
                    "title": conv.title,
                    "long_term_summary": conv.long_term_summary,
                    "recent_messages": [
                        {"role": c.role, "content": c.content, "timestamp": str(c.timestamp)}
                        for c in reversed(chats)
                    ]
                }
            else:
                convs_q = db.query(Conversation)
                convs_q = convs_q.filter(Conversation.user_id == user_id)
                convs = convs_q.order_by(Conversation.updated_at.desc()).limit(limit).all()
                return {
                    "active_conversations": [
                        {
                            "id": c.id,
                            "title": c.title,
                            "has_summary": bool(c.long_term_summary),
                            "updated_at": str(c.updated_at)
                        }
                        for c in convs
                    ]
                }
        finally:
            db.close()

    @classmethod
    def get_canvas_templates(cls) -> List[Dict[str, Any]]:
        """
        Returns pre-configured canvas architectural diagram templates.
        """
        return [
            {
                "id": "system_architecture",
                "name": "System Architecture",
                "description": "Multi-tier microservices layout with frontend, API gateway, cache, and database",
                "nodes_count": 4
            },
            {
                "id": "concept_map",
                "name": "Concept Mind Map",
                "description": "Central subject node branching into key principles and sub-concepts",
                "nodes_count": 5
            },
            {
                "id": "study_flow",
                "name": "Sequential Study Flow",
                "description": "Linear step-by-step revision progression with checkpoints",
                "nodes_count": 4
            }
        ]

    @classmethod
    def handle_jsonrpc(cls, payload: Dict[str, Any], user_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """
        Standard Model Context Protocol JSON-RPC 2.0 processor.
        Supports initialize, tools/list, tools/call, resources/list, prompts/list.
        Properly handles notifications (requests without an 'id' member) by returning None.
        """
        if not isinstance(payload, dict):
            return {"jsonrpc": "2.0", "id": None, "error": {"code": -32600, "message": "Invalid Request: payload must be a JSON object."}}

        rpc_ver = payload.get("jsonrpc")
        if rpc_ver != "2.0":
            return {"jsonrpc": "2.0", "id": payload.get("id"), "error": {"code": -32600, "message": "Invalid Request: jsonrpc version must be '2.0'."}}

        method = payload.get("method")
        if not method or not isinstance(method, str):
            return {"jsonrpc": "2.0", "id": payload.get("id"), "error": {"code": -32600, "message": "Invalid Request: method must be a non-empty string."}}

        is_notification = "id" not in payload
        rpc_id = payload.get("id")

        params = payload.get("params", {})
        if not isinstance(params, dict):
            if is_notification:
                return None
            return {"jsonrpc": "2.0", "id": rpc_id, "error": {"code": -32602, "message": "Invalid params: params must be a JSON object."}}

        response_body = None

        if method == "initialize":
            response_body = {
                "protocolVersion": "2024-11-05",
                "serverInfo": {
                    "name": "ai-study-buddy-mcp",
                    "version": "1.0.0"
                },
                "capabilities": {
                    "tools": {"listChanged": False},
                    "resources": {"subscribe": False, "listChanged": False},
                    "prompts": {"listChanged": False}
                }
            }

        elif method == "tools/list":
            response_body = {
                "tools": cls.get_registered_tools()
            }

        elif method == "tools/call":
            tool_name = params.get("name")
            tool_args = params.get("arguments", {})
            if not tool_name or not isinstance(tool_name, str) or not isinstance(tool_args, dict):
                if is_notification:
                    return None
                return {
                    "jsonrpc": "2.0",
                    "id": rpc_id,
                    "error": {
                        "code": -32602,
                        "message": "Invalid params: 'name' must be a non-empty string and 'arguments' must be an object."
                    }
                }
            try:
                result_data = cls.execute_tool(tool_name, tool_args, user_id=user_id)
                response_body = {
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(result_data, indent=2)
                        }
                    ],
                    "isError": False
                }
            except PermissionError as err:
                logger.info(f"MCP tool {tool_name} requires authentication.")
                if is_notification:
                    return None
                return {
                    "jsonrpc": "2.0",
                    "id": rpc_id,
                    "error": {
                        "code": -32001,
                        "message": str(err)
                    }
                }
            except AIServiceError as err:
                logger.warning("MCP tool %s could not complete because AI service is unavailable.", tool_name)
                if is_notification:
                    return None
                return {
                    "jsonrpc": "2.0",
                    "id": rpc_id,
                    "error": {
                        "code": -32002,
                        "message": err.user_message,
                    }
                }
            except Exception:
                logger.exception("MCP tool %s execution failed.", tool_name)
                if is_notification:
                    return None
                return {
                    "jsonrpc": "2.0",
                    "id": rpc_id,
                    "error": {
                        "code": -32603,
                        "message": "Tool execution encountered an internal error. Please try again."
                    }
                }

        elif method == "resources/list":
            response_body = {
                "resources": [
                    {
                        "uri": "study://hybrid-memory",
                        "name": "AI Study Buddy Hybrid Memory",
                        "mimeType": "application/json",
                        "description": "Active conversational context and long-term summaries"
                    },
                    {
                        "uri": "study://canvas-templates",
                        "name": "Canvas Architecture Templates",
                        "mimeType": "application/json",
                        "description": "Pre-built visual layouts for cloud, distributed systems, and algorithms"
                    }
                ]
            }

        elif method == "resources/read":
            uri = params.get("uri")
            if uri == "study://hybrid-memory":
                response_body = {
                    "contents": [
                        {
                            "uri": uri,
                            "mimeType": "application/json",
                            "text": json.dumps({"status": "active", "architecture": "Tier-1 Buffer + Tier-2 Episodic Summary"})
                        }
                    ]
                }
            elif uri == "study://canvas-templates":
                response_body = {
                    "contents": [
                        {
                            "uri": uri,
                            "mimeType": "application/json",
                            "text": json.dumps(cls.get_canvas_templates())
                        }
                    ]
                }
            else:
                if is_notification:
                    return None
                return {
                    "jsonrpc": "2.0",
                    "id": rpc_id,
                    "error": {
                        "code": -32602,
                        "message": f"Resource not found: {uri}"
                    }
                }

        elif method == "prompts/list":
            response_body = {
                "prompts": [
                    {
                        "name": "generate_canvas_architecture",
                        "description": "Guides the AI to build a multi-tier visual canvas diagram with node placements",
                        "arguments": [
                            {"name": "topic", "description": "Subject to visualize", "required": True}
                        ]
                    }
                ]
            }

        else:
            if is_notification:
                return None
            return {
                "jsonrpc": "2.0",
                "id": rpc_id,
                "error": {
                    "code": -32601,
                    "message": f"Method '{method}' not found."
                }
            }

        if is_notification:
            return None

        return {
            "jsonrpc": "2.0",
            "id": rpc_id,
            "result": response_body
        }
