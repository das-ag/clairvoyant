"use client";

import { useEffect, useRef, useState } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { QueueEntry } from "@/lib/dijkstra/dijkstraSolution";

interface PriorityQueuePanelProps {
    entries: QueueEntry[];
}

function formatDist(d: number): string {
    return d === Infinity ? "∞" : String(d);
}

export default function PriorityQueuePanel({ entries }: PriorityQueuePanelProps) {
    const [expanded, setExpanded] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!expanded) return;
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setExpanded(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [expanded]);

    if (entries.length === 0) return null;

    // Entries are already sorted by dist ascending from the solution base
    const minimum = entries[0];

    return (
        <div ref={containerRef} className="select-none">
            {/* Collapsed pill — shows queue size and current minimum */}
            <button
                onClick={() => setExpanded(e => !e)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold shadow-md cursor-pointer transition-opacity hover:opacity-90 bg-primary-950/80 backdrop-blur-sm border border-secondary-800 text-white"
            >
                <span className="text-secondary-400 font-normal text-xs mr-0.5">Q</span>
                <span>
                    {minimum.isBeingExtracted
                        ? <span className="text-amber-400">↑ {minimum.nodeId} = {formatDist(minimum.dist)}</span>
                        : <span>{minimum.nodeId} = {formatDist(minimum.dist)}</span>
                    }
                </span>
                <span className="text-secondary-500 text-xs ml-0.5">{entries.length > 1 ? `+${entries.length - 1}` : ""}</span>
                {expanded
                    ? <ExpandLessIcon sx={{ fontSize: 16 }} />
                    : <ExpandMoreIcon sx={{ fontSize: 16 }} />
                }
            </button>

            {/* Expanded table */}
            {expanded && (
                <div className="mt-1 rounded-lg overflow-hidden shadow-lg border border-secondary-800 bg-primary-950/90 backdrop-blur-sm min-w-[140px]">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-secondary-800">
                        <span className="text-secondary-400 text-xs font-semibold uppercase tracking-wide">Priority Queue</span>
                    </div>
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-secondary-500">
                                <th className="text-left px-3 py-1 font-normal">Node</th>
                                <th className="text-right px-3 py-1 font-normal">dist</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((entry) => (
                                <tr
                                    key={entry.nodeId}
                                    className={entry.isBeingExtracted
                                        ? "bg-amber-500/20 text-amber-300"
                                        : "text-white/80 hover:bg-white/5"}
                                >
                                    <td className="px-3 py-1 font-mono">
                                        {entry.isBeingExtracted && (
                                            <span className="mr-1 text-amber-400">↑</span>
                                        )}
                                        {entry.nodeId}
                                    </td>
                                    <td className="px-3 py-1 text-right font-mono">
                                        {formatDist(entry.dist)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
