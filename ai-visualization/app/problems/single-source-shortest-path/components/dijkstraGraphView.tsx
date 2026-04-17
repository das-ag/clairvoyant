"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import VisGraph, { GraphData, Options as VisGraphOptions } from "react-vis-graph-wrapper";
import * as vis from "vis-network";
import { Font, NodeOptions } from "vis-network";
import { GenericGraph } from "@/lib/graphs/graph";
import { GraphNode } from "@/lib/graphs/components";
import { DijkstraStep } from "@/lib/dijkstra/dijkstraSolution";

// ── vis.js options ────────────────────────────────────────────────────────────

const NODE_FONT_COLOR = "#0b0b0b";
const NODE_MIN_WIDTH = 54;
const NODE_MIN_HEIGHT = 54;
const SOURCE_MIN_WIDTH = 66;
const SOURCE_MIN_HEIGHT = 66;

const BASE_FONT: Font = {
    size: 18,
    color: NODE_FONT_COLOR,
    strokeWidth: 0,
    face: "ui-sans-serif, system-ui, -apple-system, sans-serif",
};

const EDGE_LABEL_FONT: Font = {
    size: 18,
    color: "#ffffff",
    strokeWidth: 0,
    background: "#1f2937",
    face: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

const VIS_OPTIONS: VisGraphOptions = {
    edges: {
        font: EDGE_LABEL_FONT,
        color: { color: "#94a3b8", highlight: "#ffffff" },
        smooth: { enabled: true, type: "dynamic", roundness: 0.4 },
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
    physics: {
        barnesHut: {
            gravitationalConstant: -2000,
            springConstant: 0.006,
            springLength: 160,
            centralGravity: 0.4,
            avoidOverlap: 0.8,
        },
        stabilization: {
            enabled: true,
            iterations: 400,
            fit: true,
        },
    },
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

function getNodeOptions(
    node: GraphNode,
    isSource: boolean,
    isExtracting: boolean,
    isExploring: boolean,
): NodeOptions {
    const state: string = node.data["state"] ?? "";
    const bg = nodeColor(state, isExtracting);
    // Border precedence: exploring > source > default. Exploring wins while
    // the adjacency loop for this node is running so it's easy to spot.
    const border = isExploring ? EXPLORING_BORDER : isSource ? "#ffffff" : "#0b1220";
    const borderWidth = isExploring ? 5 : isSource ? 5 : 2;
    return {
        label: nodeLabel(node),
        color: {
            background: bg,
            border,
            highlight: { background: bg, border: isExploring ? EXPLORING_BORDER : "#ffffff" },
        },
        borderWidth,
        shape: "circle",
        widthConstraint: { minimum: isSource ? SOURCE_MIN_WIDTH : NODE_MIN_WIDTH },
        heightConstraint: {
            minimum: isSource ? SOURCE_MIN_HEIGHT : NODE_MIN_HEIGHT,
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
}

export default function DijkstraGraphView({
    graph,
    renderKey,
    currentStep,
    onFitRef,
}: DijkstraGraphViewProps) {
    const [visData, setVisData] = useState<GraphData>({ nodes: [], edges: [] });
    const networkRef = useRef<vis.Network | null>(null);

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
            return {
                id: node.id,
                ...getNodeOptions(node, isSource, isExtracting, isExploring),
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
    }, [graph, currentStep]);

    useEffect(() => {
        rebuildVisData();
    }, [rebuildVisData, renderKey]);

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
                    network.once("stabilizationIterationsDone", () => {
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
