"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import VisGraph, { GraphData, Options as VisGraphOptions } from "react-vis-graph-wrapper";
import * as vis from "vis-network";
import { Font, NodeOptions } from "vis-network";
import { GenericGraph } from "@/lib/graphs/graph";
import { GraphNode } from "@/lib/graphs/components";
import { computeBestLayout } from "@/lib/graphs/webcolaLayout";
import { DijkstraStep } from "@/lib/dijkstra/dijkstraSolution";

// ── vis.js options ────────────────────────────────────────────────────────────

const NODE_FONT_COLOR = "#0b0b0b";
const NODE_MIN_WIDTH = 54;
const NODE_MIN_HEIGHT = 54;
const SOURCE_DIAMOND_WIDTH = 120;
const SOURCE_DIAMOND_HEIGHT = 120;

const BASE_FONT: Font = {
    size: 18,
    color: NODE_FONT_COLOR,
    strokeWidth: 0,
    face: "ui-sans-serif, system-ui, -apple-system, sans-serif",
};

const EDGE_LABEL_FONT: Font = {
    size: 22,
    color: "#ffffff",
    strokeWidth: 0,
    background: "#1f2937",
    face: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

const VIS_OPTIONS: VisGraphOptions = {
    edges: {
        font: EDGE_LABEL_FONT,
        color: { color: "#94a3b8", highlight: "#ffffff" },
        // Curved edges pull the path off the straight line between nodes,
        // so the weight chip doesn't sit directly on top of intervening
        // nodes or other edges at the midpoint.
        smooth: { enabled: true, type: "curvedCW", roundness: 0.2 },
        arrows: { to: { enabled: true, scaleFactor: 0.6 } },
    },
    nodes: {
        font: BASE_FONT,
        shape: "circle",
        widthConstraint: { minimum: NODE_MIN_WIDTH },
        // heightConstraint is supported by vis-network but missing from its typings.
        heightConstraint: { minimum: NODE_MIN_HEIGHT, valign: "middle" },
        margin: { top: 8, right: 12, bottom: 8, left: 12 },
    } as any,
    // Physics disabled — layout is computed by webcola upstream and fed as
    // {x, y} on each node. vis-network just renders the result. Nodes stay
    // draggable because interaction.dragNodes is unaffected.
    physics: { enabled: false },
    height: "100%",
    interaction: {
        hover: true,
        dragNodes: true,
        zoomView: true,
        dragView: true,
    },
};

// ── Node / edge colour helpers ────────────────────────────────────────────────

// Palette picked from Wong's 8-class colorblind-safe set so that the four
// node states remain pairwise distinguishable under deuteranopia/protanopia
// and so none of them collide with the source's thick white border ring.
function nodeColor(state: string | undefined, isExtracting: boolean): string {
    if (isExtracting) return "#D55E00"; // vermilion — being extracted
    switch (state) {
        case "settled": return "#009E73"; // teal-green
        case "relaxed": return "#F0E442"; // pure yellow
        default:        return "#56B4E9"; // sky blue — unvisited
    }
}

function nodeLabel(node: GraphNode): string {
    const distLabel: string | undefined = node.data["dist_label"];
    return distLabel !== undefined ? `${node.id}\n${distLabel}` : node.id;
}

const EXPLORING_BORDER = "#22d3ee"; // cyan-400 — distinct from source white and every fill

/**
 * Render the source vertex as a true diamond (rotated square) with the id,
 * the fixed distance 0, and "(Start)" stacked inside. vis-network's built-in
 * "diamond" shape positions the label outside the node, so we drop down to
 * a custom ctxRenderer and own the canvas drawing.
 */
function makeSourceNode(
    id: string,
    fill: string,
    strokeColor: string,
): any {
    const lines = [id, "0", "(Start)"];
    const width = SOURCE_DIAMOND_WIDTH;
    const height = SOURCE_DIAMOND_HEIGHT;
    const face = (BASE_FONT as any).face ?? "sans-serif";
    return {
        id,
        shape: "custom",
        label: undefined,
        ctxRenderer: ({ ctx, x, y }: { ctx: CanvasRenderingContext2D; x: number; y: number }) => ({
            drawNode() {
                const hw = width / 2;
                const hh = height / 2;
                ctx.save();
                // Rhombus path
                ctx.beginPath();
                ctx.moveTo(x, y - hh);
                ctx.lineTo(x + hw, y);
                ctx.lineTo(x, y + hh);
                ctx.lineTo(x - hw, y);
                ctx.closePath();
                ctx.fillStyle = fill;
                ctx.fill();
                ctx.lineWidth = 5;
                ctx.strokeStyle = strokeColor;
                ctx.stroke();

                // Three stacked label lines. Keep the id and 0 at the same
                // size as non-source nodes; shrink "(Start)" so it fits the
                // narrowing bottom half of the diamond.
                ctx.fillStyle = NODE_FONT_COLOR;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                const lineH = 22;
                const startY = y - lineH;
                for (let i = 0; i < lines.length; i++) {
                    ctx.font = i === 2
                        ? `500 13px ${face}`
                        : `600 18px ${face}`;
                    ctx.fillText(lines[i], x, startY + i * lineH);
                }
                ctx.restore();
            },
            nodeDimensions: { width, height },
        }),
    };
}

function getNodeOptions(
    node: GraphNode,
    isExtracting: boolean,
    isExploring: boolean,
): NodeOptions {
    const state: string = node.data["state"] ?? "";
    const bg = nodeColor(state, isExtracting);
    const border = isExploring ? EXPLORING_BORDER : "#0b1220";
    const borderWidth = isExploring ? 5 : 2;
    return {
        label: nodeLabel(node),
        color: {
            background: bg,
            border,
            highlight: { background: bg, border: isExploring ? EXPLORING_BORDER : "#ffffff" },
        },
        borderWidth,
        shape: "circle",
        widthConstraint: { minimum: NODE_MIN_WIDTH },
        heightConstraint: {
            minimum: NODE_MIN_HEIGHT,
            valign: "middle",
        },
    } as NodeOptions;
}

function getEdgeOptions(
    edge: { id: number; source: GraphNode; target: GraphNode; weight: number; isBidirectional: boolean },
    isRelaxing: boolean,
): Record<string, any> {
    const minW = 1.5, maxW = 10;
    const width = Math.min(maxW, minW + Math.max(0, Math.log2(Math.abs(edge.weight) + 1)));
    return {
        color: isRelaxing
            ? { color: "#D55E00", highlight: "#D55E00" }
            : undefined,
        width: isRelaxing ? Math.max(width + 3, 5) : width,
        label: String(edge.weight),
        font: isRelaxing
            ? { ...EDGE_LABEL_FONT, background: "#D55E00" }
            : EDGE_LABEL_FONT,
        arrows: edge.isBidirectional ? "" : "to",
    };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DijkstraGraphViewProps {
    graph: GenericGraph | null;
    renderKey: number;
    currentStep?: DijkstraStep;
    onFitRef?: React.MutableRefObject<(() => void) | null>;
    /**
     * Bumping this seed re-runs webcola with a different initial jitter,
     * producing a different (usually also clean) layout — the user-facing
     * "Re-layout" button wires into this.
     */
    layoutSeed?: number;
}

export default function DijkstraGraphView({
    graph,
    renderKey,
    currentStep,
    onFitRef,
    layoutSeed,
}: DijkstraGraphViewProps) {
    const [visData, setVisData] = useState<GraphData>({ nodes: [], edges: [] });
    const networkRef = useRef<vis.Network | null>(null);

    const positions = useMemo(() => {
        if (!graph) return new Map<string, { x: number; y: number }>();
        // Try a pool of seeds on every layout change and pick the one with
        // fewest edge crossings so the *default* layout is already decent —
        // users don't have to click Re-layout to escape a bad seed. Each
        // Re-layout click advances `layoutSeed`, which shifts the pool of
        // seeds we search so the next attempt is a genuinely different
        // best-of-N rather than the same winner.
        return computeBestLayout(graph, { seedBatch: Math.max(0, (layoutSeed ?? 1) - 1) });
    }, [graph, layoutSeed]);

    const rebuildVisData = useCallback(() => {
        if (!graph) { setVisData({ nodes: [], edges: [] }); return; }

        const sourceId = graph.startNode?.id;
        const extractingId = currentStep?.extractingNodeId;
        const exploringId = currentStep?.exploringNodeId;
        const relaxingEdge = currentStep?.relaxingEdge;

        const nodes = graph.getAllNodes().map((node) => {
            const isSource = node.id === sourceId;
            const isExtracting = node.id === extractingId;
            const isExploring = node.id === exploringId;
            const pos = positions.get(node.id);
            if (isSource) {
                const state: string = node.data["state"] ?? "";
                const fill = nodeColor(state, isExtracting);
                const stroke = isExploring ? EXPLORING_BORDER : "#ffffff";
                return { ...makeSourceNode(node.id, fill, stroke), x: pos?.x, y: pos?.y };
            }
            return {
                id: node.id,
                x: pos?.x,
                y: pos?.y,
                ...getNodeOptions(node, isExtracting, isExploring),
            };
        });

        const edges = graph.getAllEdges().map((edge) => {
            const isRelaxing =
                relaxingEdge?.fromId === edge.source.id &&
                relaxingEdge?.toId === edge.target.id;
            return {
                id: edge.id,
                from: edge.source.id,
                to: edge.target.id,
                ...getEdgeOptions(edge, isRelaxing),
            };
        });

        setVisData({ nodes, edges });
    }, [graph, currentStep, positions]);

    useEffect(() => {
        rebuildVisData();
    }, [rebuildVisData, renderKey]);

    // Fit the viewport whenever the layout itself changes (new graph or a
    // fresh webcola seed) — deferred via rAF so vis-network has committed
    // the updated node x/y before we ask it to scale them into view. A
    // synchronous fit here races the data commit and leaves the graph
    // off-screen.
    useEffect(() => {
        if (!networkRef.current) return;
        const frame = requestAnimationFrame(() => {
            networkRef.current?.fit({ animation: false });
        });
        return () => cancelAnimationFrame(frame);
    }, [positions]);

    // Expose fit function through the ref
    useEffect(() => {
        if (onFitRef) {
            onFitRef.current = () => {
                networkRef.current?.fit({ animation: { duration: 300, easingFunction: "easeInOutQuad" } });
            };
        }
    }, [onFitRef]);

    return (
        <div className="w-full h-full">
            <VisGraph
                style={{ height: "100%", width: "100%" }}
                graph={visData}
                options={VIS_OPTIONS}
                getNetwork={(network: vis.Network) => {
                    networkRef.current = network;
                    // Fit once the very first paint lands — the effect
                    // below handles subsequent layout changes.
                    network.once("afterDrawing", () => {
                        network.fit({ animation: false });
                    });
                    if (onFitRef) {
                        onFitRef.current = () => {
                            network.fit({ animation: { duration: 300, easingFunction: "easeInOutQuad" } });
                        };
                    }
                }}
            />
        </div>
    );
}
