
import os
import io
import base64
import textwrap

# Ensure headless matplotlib directory
os.environ.setdefault('MPLCONFIGDIR', '/tmp/matplotlib')

def hierarchy_pos(G, root=None, width=1., vert_gap = 0.2, vert_loc = 0, xcenter = 0.5):
    '''
    If the graph is a tree this will return the positions to plot this in a 
    hierarchical layout. If it contains cycles, it uses a BFS tree to force hierarchy.
    '''
    import networkx as nx

    if len(G.nodes) == 0:
        return {}
    if root is None:
        # Find a node that is a likely root (zero in-degree) or just first node
        sources = [n for n in G.nodes if G.in_degree(n) == 0]
        root = sources[0] if sources else list(G.nodes)[0]

    # FORCE HIERARCHY: Create a BFS tree for layout purposes to ignore back-edges/cycles
    layout_G = nx.bfs_tree(G, root)

    from collections import deque
    pos = {root: (xcenter, vert_loc)}
    queue = deque([(root, width, vert_loc, xcenter)])
    while queue:
        node, node_width, node_y, node_x = queue.popleft()
        children = list(layout_G.neighbors(node))
        if children:
            dx = node_width / len(children)
            next_x = node_x - node_width / 2 - dx / 2
            for child in children:
                next_x += dx
                pos[child] = (next_x, node_y - vert_gap)
                queue.append((child, dx, node_y - vert_gap, next_x))

    return pos

def get_node_depths(G, root):
    """Calculate depth of each node from root using BFS."""
    import networkx as nx
    depths = {root: 0}
    try:
        if root in G:
            for edge in nx.bfs_edges(G, root):
                depths[edge[1]] = depths[edge[0]] + 1
    except (nx.NetworkXError, KeyError, IndexError) as e:
        print(f"BFS depth warning: {e}")
    return depths

def generate_network_graph(edge_data):
    """
    Renders a hierarchical network graph for concepts and systems.
    Returns:
        dict: {"success": True, "map_image": "<base64>"} on success,
              {"success": False, "map_image": "", "error": "<details>"} on failure.
    Never returns a fake error image disguised as a successful output.
    """
    fig = None
    plt = None
    try:
        # Validate input structure
        if not isinstance(edge_data, dict):
            return {"success": False, "map_image": "", "error": "Invalid edge_data: must be a dictionary."}

        # Lazy-import networkx and matplotlib only when visual map generation is requested
        import networkx as nx
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt

        # 1. Create a Directed Graph
        G = nx.DiGraph()

        # 2. Add edges from data (WITH TRASH FILTER)
        root = edge_data.get("root")
        edges = edge_data.get("edges", [])
        if not isinstance(edges, list):
            edges = []
        
        # Fail-safe: Skip conceptual "trash" nodes
        TRASH_KEYWORDS = ["power", "jurisdiction", "role", "composition", "history", "summary", "function", "overview"]
        
        if root and isinstance(root, str) and root.strip():
            G.add_node(root.strip())
            
        for edge in edges:
            if not isinstance(edge, dict):
                continue
            source = str(edge.get("source", "")).strip()
            target = str(edge.get("target", "")).strip()
            relation = str(edge.get("relationship", "")).strip()
            
            if not source or not target:
                continue

            # Skip generic single-word stopword nodes
            if source.lower() in TRASH_KEYWORDS or target.lower() in TRASH_KEYWORDS:
                continue
                
            G.add_edge(source, target, label=relation)

        if not G.nodes:
            # If all nodes were filtered or input was empty
            if root and isinstance(root, str) and root.strip():
                G.add_node(root.strip())
            else:
                return {"success": False, "map_image": "", "error": "No valid concept nodes found in graph data."}
            
        # 3. Dynamic Canvas Sizing
        if root and root in G:
            depths = get_node_depths(G, root)
        else:
            sources = [n for n in G.nodes if G.in_degree(n) == 0]
            root = sources[0] if sources else list(G.nodes)[0]
            depths = get_node_depths(G, root)

        fig = plt.figure(figsize=(13, 9), facecolor='#0b0f17')
        
        # 4. Determine Layout
        layout_type = edge_data.get("layout", "tree")
        
        try:
            if layout_type == "tree" and root and root in G:
                tree_width = 10.0 
                pos = hierarchy_pos(G, root, width=tree_width, vert_gap=0.5)
            elif layout_type == "cycle":
                pos = nx.circular_layout(G)
            elif layout_type == "star":
                pos = nx.shell_layout(G, nlist=[[root], list(set(G.nodes) - {root})])
            else:
                try:
                    pos = nx.nx_agraph.graphviz_layout(G, prog='dot') if hasattr(nx, 'nx_agraph') else nx.kamada_kawai_layout(G)
                except Exception:
                    pos = nx.spring_layout(G, k=1.4, iterations=50)
        except Exception as e:
            print(f"Layout Error: {e}")
            pos = nx.spring_layout(G)

        missing_nodes = [node for node in G.nodes if node not in pos]
        if missing_nodes:
            subgraph = G.subgraph(missing_nodes)
            fallback_pos = nx.spring_layout(subgraph, center=(0.0, -1.0)) 
            pos.update(fallback_pos)

        # 5. Styling & Drawing
        max_label_width = 18
        base_font_size = 10
        nodelist = list(G.nodes)
        wrapped_labels = {node: "\n".join(textwrap.wrap(str(node), width=max_label_width)) for node in nodelist}
        
        depth_colors = [
            '#ef4444', '#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#06b6d4',
        ]

        try:
            nx.draw_networkx_edges(G, pos, 
                                 edge_color='#94a3b8', 
                                 arrows=False, 
                                 width=1.5, 
                                 alpha=0.8, 
                                 node_size=0, 
                                 connectionstyle="angle,angleA=-90,angleB=0,rad=5")
        except Exception as e:
            print(f"Edge drawing failed: {e}. Falling back.")
            nx.draw_networkx_edges(G, pos, edge_color='#94a3b8', arrows=False)

        nx.draw_networkx_nodes(G, pos, 
                              nodelist=nodelist,
                              node_size=0, 
                              alpha=0.0)
        
        for i, node in enumerate(G.nodes):
            x, y = pos[node]
            d = depths.get(node, 1 if node != root else 0)
            color = depth_colors[d % len(depth_colors)]
            fontsize = base_font_size + 2 if d == 0 else base_font_size
            fontweight = 'bold' if d == 0 else 'semibold'
            
            plt.text(x, y, wrapped_labels[node],
                     fontsize=fontsize,
                     fontweight=fontweight,
                     color='#f8fafc',
                     ha='center', va='center',
                     bbox=dict(
                         facecolor='#131c2e', 
                         edgecolor=color, 
                         boxstyle='round,pad=0.5', 
                         alpha=1.0, 
                         linewidth=2.0 
                     ))

        title_color = '#10b981'
        suffix = "Organizational Chart" if layout_type == "tree" else "Concept Map"
        plt.title(f"{root if root else 'System'} {suffix}", fontsize=20, fontweight='bold', pad=30, color=title_color)
        plt.axis('off')
        plt.tight_layout()

        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', bbox_inches='tight', transparent=False, facecolor='#0b0f17', dpi=130)
        buffer.seek(0)
        img_bytes = buffer.getvalue()
        if fig:
            plt.close(fig)
        else:
            plt.close('all')

        b64_str = base64.b64encode(img_bytes).decode('utf-8')
        return {"success": True, "map_image": b64_str, "error": None}

    except Exception as e:
        print(f"CRITICAL MAP GENERATION ERROR: {e}")
        if fig and plt:
            try:
                plt.close(fig)
            except Exception:
                pass
        return {"success": False, "map_image": "", "error": str(e)}
