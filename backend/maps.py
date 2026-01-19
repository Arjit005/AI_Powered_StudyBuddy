
import networkx as nx
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import io
import base64
import random
import textwrap

def hierarchy_pos(G, root=None, width=1., vert_gap = 0.2, vert_loc = 0, xcenter = 0.5):
    '''
    If the graph is a tree this will return the positions to plot this in a 
    hierarchical layout. If it contains cycles, it uses a BFS tree to force hierarchy.
    '''
    if root is None:
        # Find a node that is a likely root (zero in-degree) or just first node
        sources = [n for n in G.nodes if G.in_degree(n) == 0]
        root = sources[0] if sources else list(G.nodes)[0]

    # FORCE HIERARCHY: Create a BFS tree for layout purposes to ignore back-edges/cycles
    layout_G = nx.bfs_tree(G, root)

    def _hierarchy_pos(G, root, width=1., vert_gap = 0.2, vert_loc = 0, xcenter = 0.5, pos = None, parent = None):
        if pos is None:
            pos = {root:(xcenter,vert_loc)}
        else:
            pos[root] = (xcenter, vert_loc)
        
        children = list(G.neighbors(root))
        if len(children)!=0:
            dx = width/len(children) 
            nextx = xcenter - width/2 - dx/2
            for child in children:
                nextx += dx
                pos = _hierarchy_pos(G,child, width = dx, vert_gap = vert_gap, 
                                    vert_loc = vert_loc-vert_gap, xcenter=nextx,
                                    pos=pos, parent = root)
        return pos

    return _hierarchy_pos(layout_G, root, width, vert_gap, vert_loc, xcenter)

def get_node_depths(G, root):
    """Calculate depth of each node from root using BFS."""
    depths = {root: 0}
    try:
        for edge in nx.bfs_edges(G, root):
            depths[edge[1]] = depths[edge[0]] + 1
    except:
        pass
    return depths

def generate_network_graph(edge_data):
    try:
        # 1. Create a Directed Graph
        G = nx.DiGraph()

        # 2. Add edges from data (WITH TRASH FILTER)
        root = edge_data.get("root")
        edges = edge_data.get("edges", [])
        
        # Fail-safe: Skip conceptual "trash" nodes
        TRASH_KEYWORDS = ["power", "jurisdiction", "role", "composition", "history", "summary", "function", "overview"]
        
        if root:
            G.add_node(root)
            
        for edge in edges:
            source = edge.get("source", "")
            target = edge.get("target", "")
            relation = edge.get("relationship", "")
            
            # ACTIVE TRASH FILTER: Skip edges leading to conceptual nodes
            if any(kw in source.lower() for kw in TRASH_KEYWORDS) or \
               any(kw in target.lower() for kw in TRASH_KEYWORDS):
                continue
                
            # Add nodes if they don't exist
            G.add_edge(source, target, label=relation)

        if not G.nodes:
            # Emergency recovery if everything was filtered out
            G.add_node(root if root else "System")
            
        # 3. Dynamic Canvas Sizing (FORCE PORTRAIT FOR TREES)
        num_nodes = len(G.nodes)
        if root and root in G:
            depths = get_node_depths(G, root)
        else:
            # Find a root if not provided
            sources = [n for n in G.nodes if G.in_degree(n) == 0]
            root = sources[0] if sources else list(G.nodes)[0]
            depths = get_node_depths(G, root)

        # Dynamic Canvas Sizing - Balanced for hierarchy
        max_depth = max(depths.values()) if depths else 0
        
        # COMPACT FORMAT (User Requested - "No Scrolling")
        plt.figure(figsize=(13, 9), facecolor='#f8fafc')
        
        # 4. Determine Layout
        layout_type = edge_data.get("layout", "tree")
        
        try:
            if layout_type == "tree" and root and root in G:
                # Tight Tree Layout
                tree_width = 10.0 
                pos = hierarchy_pos(G, root, width=tree_width, vert_gap=0.5) # Reduced vertical gap
            elif layout_type == "cycle":
                pos = nx.circular_layout(G)
            elif layout_type == "star":
                pos = nx.shell_layout(G, nlist=[[root], list(set(G.nodes) - {root})])
            else:
                try:
                    pos = nx.nx_agraph.graphviz_layout(G, prog='dot') if hasattr(nx, 'nx_agraph') else nx.kamada_kawai_layout(G)
                except:
                    pos = nx.spring_layout(G, k=1.4, iterations=50)
        except Exception as e:
            print(f"Layout Error: {e}")
            pos = nx.spring_layout(G)

        # SAFETY CHECK: Ensure ALL nodes have a position (Handles disconnected components)
        missing_nodes = [node for node in G.nodes if node not in pos]
        if missing_nodes:
            print(f"Warning: Layout missed {len(missing_nodes)} nodes (disconnected components). Patching positions.")
            # Place missing nodes in a separate cluster using spring layout
            # We offset them slightly to avoid overlap with the main tree
            subgraph = G.subgraph(missing_nodes)
            fallback_pos = nx.spring_layout(subgraph, center=(width/2, -1)) 
            pos.update(fallback_pos)

        # 5. Styling & Drawing (Professional Org-Chart Theme)
        max_label_width = 18 # Compact labels
        base_font_size = 10 # Smaller font for compact view
 
        
        nodelist = list(G.nodes)
        wrapped_labels = {node: "\n".join(textwrap.wrap(str(node), width=max_label_width)) for node in nodelist}
        
        # Define Palette (Red, Blue, Green, Orange, Purple) - matching the reference style
        depth_colors = [
        '#ef4444', # Red (Root)
        '#3b82f6', # Blue (Level 1)
        '#22c55e', # Green (Level 2)
        '#f97316', # Orange (Level 3)
        '#8b5cf6', # Purple (Level 4)
        '#06b6d4', # Cyan
    ]

        # Draw Edges (Orthogonal / Angular Lines)
        try:
            # connectionstyle='angle,angleA=0,angleB=-90' creates vertical-then-horizontal lines suitable for top-down trees
            nx.draw_networkx_edges(G, pos, 
                                 edge_color='#94a3b8', # Slate 400 (Gray)
                                 arrows=False, 
                                 width=1.5, 
                                 alpha=0.8, 
                                 node_size=0, # Important so lines reach the text center roughly
                                 connectionstyle="angle,angleA=-90,angleB=0,rad=5")
        except Exception as e:
            print(f"Edge drawing failed: {e}. Falling back.")
            nx.draw_networkx_edges(G, pos, edge_color='#94a3b8', arrows=False)

        # Draw Nodes (Invisible - we use Label BBox as the visual node)
        nx.draw_networkx_nodes(G, pos, 
                              nodelist=nodelist,
                              node_size=0, # INVISIBLE NODES
                              alpha=0.0)
        
        # Draw Node Labels (The actual "Boxes")
        for i, node in enumerate(G.nodes):
            x, y = pos[node]
            d = depths.get(node, 0)
            
            # Cycle through colors based on depth
            color = depth_colors[d % len(depth_colors)]
            
            # Root is slightly larger/bolder
            fontsize = base_font_size + 2 if d == 0 else base_font_size
            fontweight = 'bold' if d == 0 else 'semibold'
            
            plt.text(x, y, wrapped_labels[node],
                     fontsize=fontsize,
                     fontweight=fontweight,
                     color='#1e293b', # Slate 800 (Dark Text)
                     ha='center', va='center',
                     bbox=dict(
                         facecolor='white', 
                         edgecolor=color, # Depth-based border color
                         boxstyle='round,pad=0.5', 
                         alpha=1.0, 
                         linewidth=2.0 
                     ))

        title_color = '#064e3b'
        # Use 'Organizational Chart' for tree-based hierarchies
        suffix = "Organizational Chart" if layout_type == "tree" else "Concept Map"
        plt.title(f"{root if root else 'System'} {suffix}", fontsize=20, fontweight='bold', pad=30, color=title_color)
        plt.axis('off')
        plt.tight_layout()

        # 6. Save and Convert
        buffer = io.BytesIO()
        # Save with light gray background to make emerald pop
        plt.savefig(buffer, format='png', bbox_inches='tight', transparent=False, facecolor='#f8fafc', dpi=130)
        buffer.seek(0)
        plt.close()

        return base64.b64encode(buffer.getvalue()).decode('utf-8')

    except Exception as e:
        print(f"CRITICAL MAP GENERATION ERROR: {e}")
        # Fallback Image Generation
        plt.figure(figsize=(16, 12)) # Reduced size based on feedback
        plt.text(0.5, 0.5, f"Map Generation Failed:\n{str(e)[:100]}", 
                 ha='center', va='center', fontsize=14, color='red')
        plt.axis('off')
        buffer = io.BytesIO()
        plt.savefig(buffer, format='png')
        buffer.seek(0)
        plt.close()
        return base64.b64encode(buffer.getvalue()).decode('utf-8')
