export interface WatchEntry {
    key: string;
    value: string;
    color?: string;
}

export interface WatchPanelProps {
    entries: WatchEntry[];
}

export default function WatchPanel({ entries }: WatchPanelProps) {
    if (entries.length === 0) return null;

    return (
        <div className="rounded border border-secondary-200 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-950 text-sm overflow-auto max-h-40">
            <div className="px-2 py-0.5 font-semibold border-b border-secondary-200 dark:border-secondary-800 text-xs opacity-70">
                Watch
            </div>
            <table className="w-full text-xs">
                <tbody>
                    {entries.map((entry, i) => (
                        <tr key={i} className="border-b last:border-b-0 border-secondary-100 dark:border-secondary-900">
                            <td className="px-2 py-0.5 font-mono opacity-70 whitespace-nowrap">{entry.key}</td>
                            <td className="px-2 py-0.5 font-mono whitespace-nowrap" style={entry.color ? { color: entry.color } : undefined}>
                                {entry.value}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
