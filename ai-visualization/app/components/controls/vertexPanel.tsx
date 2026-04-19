"use client";

import { useEffect, useRef } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { VertexSnapshot, VertexSnapshotEntry, VertexState } from "@/lib/dijkstra/dijkstraSolution";

interface VertexPanelProps {
    snapshot: VertexSnapshot;
    selectedNodeId?: string | null;
    onSelectedNodeChange?: (id: string | null) => void;
}

const STATE_COLOR: Record<VertexState, string> = {
    unvisited: "text-sky-300",
    relaxed: "text-yellow-300",
    settled: "text-emerald-300",
    extracting: "text-orange-400",
};

const STATE_DOT: Record<VertexState, string> = {
    unvisited: "bg-sky-400",
    relaxed: "bg-yellow-300",
    settled: "bg-emerald-400",
    extracting: "bg-orange-500",
};

function Row({ entry, expanded, onToggle }: {
    entry: VertexSnapshotEntry;
    expanded: boolean;
    onToggle: () => void;
}) {
    return (
        <div data-node-id={entry.id} className={`border-b last:border-b-0 border-secondary-900 ${expanded ? "bg-pink-500/15" : ""}`}>
            <button
                onClick={onToggle}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 cursor-pointer text-left"
            >
                <span className={`inline-block w-2 h-2 rounded-full ${STATE_DOT[entry.state]}`} />
                <span className="font-mono text-xs text-white/90 flex-grow">{entry.id}</span>
                <span className="font-mono text-xs text-white/60">{entry.dist}</span>
                {expanded
                    ? <ExpandLessIcon sx={{ fontSize: 14, color: "#64748b" }} />
                    : <ExpandMoreIcon sx={{ fontSize: 14, color: "#64748b" }} />
                }
            </button>
            {expanded && (
                <div className="px-3 pb-2 pt-0.5 text-xs space-y-0.5 bg-primary-900/40">
                    <PropRow label="state">
                        <span className={`font-mono ${STATE_COLOR[entry.state]}`}>{entry.state}</span>
                    </PropRow>
                    <PropRow label="dist">
                        <span className="font-mono text-white">{entry.dist}</span>
                    </PropRow>
                    <PropRow label="prev">
                        <span className="font-mono text-white">{entry.prev}</span>
                    </PropRow>
                    <PropRow label="in Q">
                        <span className="font-mono text-white">{entry.inQueue ? "yes" : "no"}</span>
                    </PropRow>
                </div>
            )}
        </div>
    );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-baseline gap-2">
            <span className="text-secondary-500 text-[10px] uppercase tracking-wide w-12 shrink-0">
                {label}
            </span>
            {children}
        </div>
    );
}

export default function VertexPanel({ snapshot, selectedNodeId = null, onSelectedNodeChange }: VertexPanelProps) {
    const entries = Object.values(snapshot).sort((a, b) => a.id.localeCompare(b.id));
    const scrollRef = useRef<HTMLDivElement | null>(null);

    // When selection changes (e.g. clicked in the graph or PQ), scroll the
    // matching row into view within this panel's fixed-height body.
    useEffect(() => {
        if (!selectedNodeId || !scrollRef.current) return;
        const el = scrollRef.current.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(selectedNodeId)}"]`);
        el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [selectedNodeId]);

    return (
        <div className="rounded-lg overflow-hidden border border-secondary-800 bg-primary-950/90 backdrop-blur-sm shadow-lg w-full flex flex-col">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-secondary-800 shrink-0">
                <span className="text-secondary-400 text-xs font-semibold uppercase tracking-wide">
                    Vertices
                </span>
                <span className="text-secondary-500 text-xs font-mono">{entries.length}</span>
            </div>
            {/* Fixed body height so row expansion scrolls inside the panel
                instead of pushing the priority queue around; scrollbar is
                always visible so it doesn't pop in/out as rows expand. */}
            <div ref={scrollRef} className="h-[180px] overflow-y-scroll">
                {entries.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-secondary-500 italic text-center">
                        no vertices
                    </div>
                ) : (
                    entries.map(entry => (
                        <Row
                            key={entry.id}
                            entry={entry}
                            expanded={selectedNodeId === entry.id}
                            onToggle={() => onSelectedNodeChange?.(selectedNodeId === entry.id ? null : entry.id)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
