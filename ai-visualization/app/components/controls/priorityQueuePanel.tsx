"use client";

import { QueueEntry } from "@/lib/dijkstra/dijkstraSolution";

interface PriorityQueuePanelProps {
    entries: QueueEntry[];
}

function formatDist(d: number): string {
    return d === Infinity ? "∞" : String(d);
}

export default function PriorityQueuePanel({ entries }: PriorityQueuePanelProps) {
    return (
        <div className="select-none rounded-lg overflow-hidden shadow-lg border border-secondary-800 bg-primary-950/90 backdrop-blur-sm min-w-[180px]">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-secondary-800">
                <span className="text-secondary-400 text-xs font-semibold uppercase tracking-wide">
                    Priority Queue
                </span>
                <span className="text-secondary-500 text-xs font-mono">
                    {entries.length}
                </span>
            </div>
            {entries.length === 0 ? (
                <div className="px-3 py-2 text-xs text-secondary-500 italic text-center">
                    empty
                </div>
            ) : (
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
                                    : "text-white/80"}
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
            )}
        </div>
    );
}
