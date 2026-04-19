"use client";

import { useEffect, useMemo, useRef } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import {
    VertexSnapshot,
    VertexSnapshotEntry,
    VertexState,
    VertexHistoryMap,
    VertexHistoryEntry,
} from "@/lib/dijkstra/dijkstraSolution";

interface VertexPanelProps {
    snapshot: VertexSnapshot;
    selectedNodeId?: string | null;
    onSelectedNodeChange?: (id: string | null) => void;
    hoveredNodeId?: string | null;
    onHoveredNodeChange?: (id: string | null) => void;
    history?: VertexHistoryMap;
    /** Total count of outer-loop iterations observed so far (drives table columns). */
    iterationCount?: number;
    onJumpToStep?: (step: number) => void;
    sourceId?: string | null;
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

function computePath(
    startId: string,
    snapshot: VertexSnapshot,
): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    let cur: string | undefined = startId;
    while (cur && !seen.has(cur)) {
        seen.add(cur);
        out.push(cur);
        const pathEntry: VertexSnapshotEntry | undefined = snapshot[cur];
        if (!pathEntry) break;
        if (pathEntry.prev === "NIL") break;
        cur = pathEntry.prev;
    }
    return out.reverse();
}

/**
 * Snap each iteration column to the label that was current at the *end* of
 * that iteration — i.e. the most recent history entry whose iteration is
 * ≤ the column index. If no entry has fired yet, returns null.
 */
function cellsForIterations(
    entries: VertexHistoryEntry[],
    iterationCount: number,
): (VertexHistoryEntry | null)[] {
    const out: (VertexHistoryEntry | null)[] = [];
    let idx = 0;
    let latest: VertexHistoryEntry | null = null;
    for (let k = 0; k <= iterationCount; k++) {
        while (idx < entries.length && entries[idx].iteration <= k) {
            latest = entries[idx];
            idx++;
        }
        out.push(latest);
    }
    return out;
}

function HistoryTable({
    distHist,
    prevHist,
    iterationCount,
    onJump,
}: {
    distHist: VertexHistoryEntry[];
    prevHist: VertexHistoryEntry[];
    iterationCount: number;
    onJump?: (step: number) => void;
}) {
    const distCells = cellsForIterations(distHist, iterationCount);
    const prevCells = cellsForIterations(prevHist, iterationCount);
    const iters = Array.from({ length: iterationCount + 1 }, (_, k) => k);

    const renderRow = (
        label: string,
        cells: (VertexHistoryEntry | null)[],
    ) => (
        <tr>
            <th
                scope="row"
                className="sticky left-0 z-10 bg-primary-900 text-secondary-500 text-[10px] uppercase tracking-wide px-2 py-0.5 text-left font-normal border-r border-secondary-800"
            >
                {label}
            </th>
            {cells.map((cell, k) => {
                const prev = k > 0 ? cells[k - 1] : null;
                const changed = !!cell && (!prev || prev.label !== cell.label);
                const label = cell?.label ?? "·";
                return (
                    <td
                        key={k}
                        className={`px-1.5 py-0.5 text-center font-mono text-[11px] border-r border-secondary-900 ${
                            cell
                                ? changed
                                    ? "bg-amber-400/30 text-white"
                                    : "text-white/70"
                                : "text-secondary-700"
                        } ${cell ? "cursor-pointer hover:bg-white/10" : ""}`}
                        onClick={cell ? () => onJump?.(cell.stepIndex) : undefined}
                        title={cell ? `iteration ${k} · step ${cell.stepIndex}` : undefined}
                    >
                        {label}
                    </td>
                );
            })}
        </tr>
    );

    return (
        <div>
            <div className="text-secondary-500 text-[10px] uppercase tracking-wide mb-1">
                Node history
            </div>
            <div className="vertex-hist-scroll overflow-x-auto overflow-y-hidden border border-secondary-800 rounded">
            <table className="border-collapse text-xs">
                <thead>
                    <tr>
                        <th
                            scope="col"
                            className="sticky left-0 z-20 bg-primary-900 text-secondary-500 text-[10px] uppercase tracking-wide px-2 py-0.5 text-left font-normal border-r border-b border-secondary-800"
                        >
                            iter
                        </th>
                        {iters.map(k => (
                            <th
                                key={k}
                                scope="col"
                                className="px-1.5 py-0.5 text-center font-mono text-[10px] text-amber-300/90 bg-primary-900/80 border-r border-b border-secondary-800 min-w-[28px]"
                            >
                                {k}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {renderRow("dist", distCells)}
                    {renderRow("prev", prevCells)}
                </tbody>
            </table>
            </div>
        </div>
    );
}

function Row({
    entry,
    expanded,
    hovered,
    onToggle,
    onHoverChange,
    snapshot,
    history,
    sourceId,
    onJumpToStep,
    iterationCount,
}: {
    entry: VertexSnapshotEntry;
    expanded: boolean;
    hovered: boolean;
    onToggle: () => void;
    onHoverChange?: (id: string | null) => void;
    snapshot: VertexSnapshot;
    history?: VertexHistoryMap;
    sourceId?: string | null;
    onJumpToStep?: (step: number) => void;
    iterationCount: number;
}) {
    const bg = expanded ? "bg-pink-500/15" : hovered ? "bg-pink-500/10" : "";
    const path = expanded ? computePath(entry.id, snapshot) : [];
    const unreachable = entry.distValue === Infinity && entry.id !== sourceId;
    const distHist = history?.[entry.id]?.dist ?? [];
    const prevHist = history?.[entry.id]?.prev ?? [];

    return (
        <div
            data-node-id={entry.id}
            onMouseEnter={() => onHoverChange?.(entry.id)}
            onMouseLeave={() => onHoverChange?.(null)}
            className={`border-b last:border-b-0 border-secondary-900 ${bg}`}
        >
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
                    <PropRow label="path">
                        {unreachable ? (
                            <span className="italic text-secondary-500">unreachable</span>
                        ) : (
                            <div className="flex-grow min-w-0 overflow-x-auto">
                                <div className="flex items-center gap-1 whitespace-nowrap font-mono text-white">
                                    {path.map((id, i) => (
                                        <span key={`${id}-${i}`} className="flex items-center gap-1">
                                            {i > 0 && <span className="text-secondary-500">→</span>}
                                            <span>{id}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </PropRow>
                    <div className="pt-1">
                        <HistoryTable
                            distHist={distHist}
                            prevHist={prevHist}
                            iterationCount={iterationCount}
                            onJump={onJumpToStep}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-baseline gap-2">
            <span className="text-secondary-500 text-[10px] uppercase tracking-wide w-16 shrink-0">
                {label}
            </span>
            {children}
        </div>
    );
}

export default function VertexPanel({
    snapshot,
    selectedNodeId = null,
    onSelectedNodeChange,
    hoveredNodeId = null,
    onHoveredNodeChange,
    history,
    iterationCount = 0,
    onJumpToStep,
    sourceId = null,
}: VertexPanelProps) {
    const entries = useMemo(
        () => Object.values(snapshot).sort((a, b) => a.id.localeCompare(b.id)),
        [snapshot],
    );
    const scrollRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!selectedNodeId || !scrollRef.current) return;
        const el = scrollRef.current.querySelector<HTMLElement>(
            `[data-node-id="${CSS.escape(selectedNodeId)}"]`,
        );
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
            {/* Fixed tall body: large enough that one fully-expanded row
                (path + dist hist + prev hist) fits without vertical scroll
                inside the row. Panel size stays constant — expanding a row
                never pushes the PQ around. */}
            <div ref={scrollRef} className="h-[380px] overflow-y-scroll">
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
                            hovered={hoveredNodeId === entry.id && selectedNodeId !== entry.id}
                            onToggle={() => onSelectedNodeChange?.(selectedNodeId === entry.id ? null : entry.id)}
                            onHoverChange={onHoveredNodeChange}
                            snapshot={snapshot}
                            history={history}
                            sourceId={sourceId}
                            onJumpToStep={onJumpToStep}
                            iterationCount={iterationCount}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
