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
        <div className="select-none rounded-lg overflow-hidden shadow-lg border border-secondary-800 bg-primary-950/90 backdrop-blur-sm w-full flex flex-col">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-secondary-800 shrink-0">
                <span className="text-secondary-400 text-xs font-semibold uppercase tracking-wide">
                    Priority Queue
                </span>
                <span className="text-secondary-500 text-xs font-mono">
                    {entries.length}
                </span>
            </div>
            {/* Column headers stay visible above the scroll area — they
                render the same whether the queue is empty or long. */}
            <div className="flex items-center border-b border-secondary-900 text-secondary-500 text-xs shrink-0">
                <span className="px-3 py-1 flex-grow">Node</span>
                <span className="px-3 py-1">dist</span>
            </div>
            {/* Body height reserves ~5 rows; scrollbar is always visible so
                it doesn't pop in/out as the queue grows past the limit. */}
            <div className="h-[130px] overflow-y-scroll">
            {entries.length === 0 ? (
                <div className="px-3 py-2 text-xs text-secondary-500 italic text-center">
                    empty
                </div>
            ) : (
                <table className="w-full text-xs">
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
        </div>
    );
}
