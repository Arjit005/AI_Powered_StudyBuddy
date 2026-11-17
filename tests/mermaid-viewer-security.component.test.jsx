import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import MermaidViewer from '../src/components/MermaidViewer';
import mermaid from 'mermaid';

describe('MermaidViewer Real Component Security & Sanitization Suite', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    // Helper to spy on mermaid.render returning an attacker-crafted or legitimate SVG string
    const mockMermaidSvg = (svgString) => {
        const mockFn = async (id) => ({
            svg: svgString.replace(/ID_PLACEHOLDER/g, id)
        });
        if (mermaid.render) {
            vi.spyOn(mermaid, 'render').mockImplementation(mockFn);
        }
        if (mermaid.default && mermaid.default.render) {
            vi.spyOn(mermaid.default, 'render').mockImplementation(mockFn);
        }
    };

    // Test 1: Ordinary Mermaid SVG renders correctly
    it('Test 1: Ordinary Mermaid SVG renders correctly and preserves legitimate styling', async () => {
        const legitimateSvg = `
            <svg id="ID_PLACEHOLDER" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <style>
                    #ID_PLACEHOLDER .node rect { fill: #ececff; stroke: #ccccff; }
                    #ID_PLACEHOLDER .edgePath .path { stroke: #333333; }
                </style>
                <g class="nodes">
                    <g class="node" id="flowchart-A-0"><rect width="60" height="40" rx="5"></rect><text>Node A</text></g>
                </g>
            </svg>
        `;
        mockMermaidSvg(legitimateSvg);

        render(<MermaidViewer chart="graph TD; A-->B;" title="Architecture Flow" />);

        await waitFor(() => {
            expect(screen.getByText('Node A')).toBeDefined();
        });

        const svgEl = screen.getByText('Node A').closest('svg');
        expect(svgEl).not.toBeNull();
        expect(svgEl.querySelector('style')).not.toBeNull();
        expect(svgEl.querySelector('style').textContent).toContain('fill: #ececff');
    });

    // Test 2: CSS comment-obfuscated external url() is rejected
    it('Test 2: CSS comment-obfuscated external url() is stripped or rejected', async () => {
        const payloadSvg = `
            <svg id="ID_PLACEHOLDER" xmlns="http://www.w3.org/2000/svg">
                <style>
                    .malicious { background: url/**/("https://attacker.example/leak.png"); }
                </style>
                <rect class="malicious" style="fill: url/*comment*/('http://evil.com/bg.png')" width="100" height="100"></rect>
                <text>Comment Test</text>
            </svg>
        `;
        mockMermaidSvg(payloadSvg);

        const { container } = render(<MermaidViewer chart="graph TD; A;" />);

        await waitFor(() => {
            expect(screen.getByText('Comment Test')).toBeDefined();
        });

        const svgEl = screen.getByText('Comment Test').closest('svg');
        // Unsafe style tag must be stripped entirely
        expect(svgEl.querySelector('style')).toBeNull();
        // Unsafe attribute style on rect must be stripped
        const rect = svgEl.querySelector('rect');
        expect(rect.getAttribute('style')).toBeNull();
        expect(container.innerHTML).not.toContain('attacker.example');
        expect(container.innerHTML).not.toContain('evil.com');
    });

    // Test 3: CSS comment-obfuscated @import is rejected
    it('Test 3: CSS comment-obfuscated @import is stripped', async () => {
        const payloadSvg = `
            <svg id="ID_PLACEHOLDER" xmlns="http://www.w3.org/2000/svg">
                <style>
                    @/*comment*/import "https://attacker.example/exfil.css";
                    .node { color: blue; }
                </style>
                <text>Import Test</text>
            </svg>
        `;
        mockMermaidSvg(payloadSvg);

        const { container } = render(<MermaidViewer chart="graph TD; A;" />);

        await waitFor(() => {
            expect(screen.getByText('Import Test')).toBeDefined();
        });

        const svgEl = container.querySelector('svg');
        expect(svgEl.querySelector('style')).toBeNull();
        expect(container.innerHTML).not.toContain('attacker.example');
    });

    // Test 4: Hex-escaped CSS identifiers cannot bypass checks
    it('Test 4: Hex-escaped CSS identifiers (@\\69\\6d\\70\\6f\\72\\74 and \\75\\72\\6c) cannot bypass checks', async () => {
        const payloadSvg = `
            <svg id="ID_PLACEHOLDER" xmlns="http://www.w3.org/2000/svg">
                <style>
                    @\\69\\6d\\70\\6f\\72\\74 "https://attacker.example/sheet.css";
                    .exploit { fill: \\75\\72\\6c("https://attacker.example/leak"); }
                </style>
                <circle cx="50" cy="50" r="40" style="stroke: \\75\\72\\6c('https://attacker.example/border')"></circle>
                <text>Hex Test</text>
            </svg>
        `;
        mockMermaidSvg(payloadSvg);

        const { container } = render(<MermaidViewer chart="graph TD; A;" />);

        await waitFor(() => {
            expect(screen.getByText('Hex Test')).toBeDefined();
        });

        const svgEl = screen.getByText('Hex Test').closest('svg');
        expect(svgEl.querySelector('style')).toBeNull();
        const circle = svgEl.querySelector('circle');
        expect(circle.getAttribute('style')).toBeNull();
        expect(container.innerHTML).not.toContain('attacker.example');
    });

    // Test 5: Backslash-escaped identifiers cannot bypass checks
    it('Test 5: Backslash-escaped identifiers (@\\i\\m\\p\\o\\r\\t and \\u\\r\\l) cannot bypass checks', async () => {
        const payloadSvg = `
            <svg id="ID_PLACEHOLDER" xmlns="http://www.w3.org/2000/svg">
                <style>
                    @\\i\\m\\p\\o\\r\\t 'https://attacker.example/escape.css';
                </style>
                <rect width="20" height="20" style="fill: \\u\\r\\l('https://attacker.example/escape.png')"></rect>
                <text>Escape Test</text>
            </svg>
        `;
        mockMermaidSvg(payloadSvg);

        const { container } = render(<MermaidViewer chart="graph TD; A;" />);

        await waitFor(() => {
            expect(screen.getByText('Escape Test')).toBeDefined();
        });

        const svgEl = screen.getByText('Escape Test').closest('svg');
        expect(svgEl.querySelector('style')).toBeNull();
        expect(svgEl.querySelector('rect').getAttribute('style')).toBeNull();
        expect(container.innerHTML).not.toContain('attacker.example');
    });

    // Test 6: External HTTP, HTTPS, protocol-relative and relative resource URLs are rejected
    it('Test 6: External HTTP, HTTPS, protocol-relative and relative URLs are rejected across href and xlink:href', async () => {
        const payloadSvg = `
            <svg id="ID_PLACEHOLDER" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                <a href="https://evil.example.com">
                    <text>Evil Link</text>
                </a>
                <a href="//proto-relative.example.com">
                    <text>Proto Relative</text>
                </a>
                <a href="/relative/path/target">
                    <text>Relative Path</text>
                </a>
                <a xlink:href="http://xlink-evil.example.com">
                    <text>XLink Evil</text>
                </a>
                <a href="#safe-local-node">
                    <text>Safe Local Node</text>
                </a>
            </svg>
        `;
        mockMermaidSvg(payloadSvg);

        const { container } = render(<MermaidViewer chart="graph TD; A;" />);

        await waitFor(() => {
            expect(screen.getByText('Safe Local Node')).toBeDefined();
        });

        const links = container.querySelectorAll('a');
        expect(links[0].getAttribute('href')).toBeNull();
        expect(links[1].getAttribute('href')).toBeNull();
        expect(links[2].getAttribute('href')).toBeNull();
        expect(links[3].getAttribute('xlink:href')).toBeNull();
        expect(links[4].getAttribute('href')).toBe('#safe-local-node');
    });

    // Test 7: Safe local fragment references continue to work
    it('Test 7: Safe local fragment references (url(#gradient1) and href="#node") continue to work', async () => {
        const legitimateFragmentSvg = `
            <svg id="ID_PLACEHOLDER" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="gradient1">
                        <stop offset="0%" stop-color="#10b981" />
                        <stop offset="100%" stop-color="#064e3b" />
                    </linearGradient>
                    <marker id="arrowhead" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#333333"></path>
                    </marker>
                </defs>
                <style>
                    .edgePath .path { stroke: #333333; marker-end: url(#arrowhead); }
                </style>
                <rect width="100" height="50" fill="url(#gradient1)"></rect>
                <rect width="100" height="50" style="fill: url(#gradient1)"></rect>
                <a href="#safe-anchor"><text>Local Link</text></a>
            </svg>
        `;
        mockMermaidSvg(legitimateFragmentSvg);

        render(<MermaidViewer chart="graph TD; A-->B;" />);

        await waitFor(() => {
            expect(screen.getByText('Local Link')).toBeDefined();
        });

        const svgEl = screen.getByText('Local Link').closest('svg');
        // Style element with safe url(#arrowhead) is preserved
        const style = svgEl.querySelector('style');
        expect(style).not.toBeNull();
        expect(style.textContent).toContain('url(#arrowhead)');

        // Attribute fill="url(#gradient1)" and style="fill: url(#gradient1)" are preserved
        const rects = svgEl.querySelectorAll('rect');
        expect(rects[0].getAttribute('fill')).toBe('url(#gradient1)');
        expect(rects[1].getAttribute('style')).toContain('url(#gradient1)');

        // Local href is preserved
        const a = svgEl.querySelector('a');
        expect(a.getAttribute('href')).toBe('#safe-anchor');
    });

    // Test 8: Script elements and event-handler attributes cannot execute
    it('Test 8: Script, foreignObject, iframe and onload event-handlers are stripped', async () => {
        const xssSvg = `
            <svg id="ID_PLACEHOLDER" xmlns="http://www.w3.org/2000/svg">
                <script>window.__xss_executed = true;</script>
                <foreignObject width="100" height="50">
                    <iframe src="javascript:alert(1)"></iframe>
                </foreignObject>
                <rect width="40" height="40" onload="alert(1)" onclick="alert(2)"></rect>
                <text>XSS Test Element</text>
            </svg>
        `;
        mockMermaidSvg(xssSvg);

        render(<MermaidViewer chart="graph TD; A;" />);

        await waitFor(() => {
            expect(screen.getByText('XSS Test Element')).toBeDefined();
        });

        const svgEl = screen.getByText('XSS Test Element').closest('svg');
        expect(svgEl.querySelector('script')).toBeNull();
        expect(svgEl.querySelector('foreignobject')).toBeNull();
        expect(svgEl.querySelector('iframe')).toBeNull();
        const rect = svgEl.querySelector('rect');
        expect(rect.getAttribute('onload')).toBeNull();
        expect(rect.getAttribute('onclick')).toBeNull();
    });

    // Test 9: Malformed SVG is handled safely without crashing the component
    it('Test 9: Malformed SVG is handled safely with a friendly error display and no crash', async () => {
        const malformedSvg = `
            <svg id="ID_PLACEHOLDER" xmlns="http://www.w3.org/2000/svg">
                <unclosed_tag>
                <parsererror>XML Parsing Error</parsererror>
            </svg>
        `;
        mockMermaidSvg(malformedSvg);

        render(<MermaidViewer chart="graph TD; Broken;" />);

        await waitFor(() => {
            expect(screen.getByText(/Diagram sanitization failed or produced invalid SVG/i)).toBeDefined();
        });
    });

    it('fails closed when the sanitized SVG cannot be parsed for mounting', async () => {
        const NativeDOMParser = window.DOMParser;
        let parseCount = 0;
        class MountFailingDOMParser {
            parseFromString(...args) {
                parseCount += 1;
                if (parseCount > 1) throw new Error('Mount parser failed');
                return new NativeDOMParser().parseFromString(...args);
            }
        }
        vi.stubGlobal('DOMParser', MountFailingDOMParser);
        mockMermaidSvg(`
            <svg id="ID_PLACEHOLDER" xmlns="http://www.w3.org/2000/svg">
                <text>Mount boundary content</text>
            </svg>
        `);

        const { container } = render(<MermaidViewer chart="graph TD; A;" />);

        expect(await screen.findByText('Diagram could not be displayed safely.')).toBeDefined();
        expect(screen.queryByText('Mount boundary content')).toBeNull();
        expect(container.querySelector('svg text')).toBeNull();
    });
});
