#!/usr/bin/env python3
"""
AI Study Buddy - Model Context Protocol (MCP) STDIO Server
Enables external Canvas tools (Excalidraw, Claude Desktop, Cursor, Antigravity)
to execute Study Buddy tools over standard input/output JSON-RPC.
"""
import sys
import json
import logging

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stdin.reconfigure(encoding='utf-8')

# Ensure backend package can be imported
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.mcp_service import MCPService

logging.basicConfig(level=logging.INFO, stream=sys.stderr, format='[MCP] %(message)s')

def main():
    logging.info("AI Study Buddy MCP Server started (listening on stdio)...")
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            line = line.strip()
            if not line:
                continue

            try:
                request = json.loads(line)
            except json.JSONDecodeError as jde:
                error_response = {
                    "jsonrpc": "2.0",
                    "id": None,
                    "error": {"code": -32700, "message": f"Parse error: {str(jde)}"}
                }
                sys.stdout.write(json.dumps(error_response) + "\n")
                sys.stdout.flush()
                continue

            response = MCPService.handle_jsonrpc(request)
            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()

        except KeyboardInterrupt:
            break
        except Exception as e:
            logging.error(f"Unexpected MCP Server error: {e}")

if __name__ == "__main__":
    main()
