import { ReactNode } from "react";

export function OptionsSection({ title, children }: { title: string, children: ReactNode }) {
    return (
        <div className="flex flex-col gap-2 p-2 rounded border border-secondary-200 dark:border-secondary-800 bg-primary-50 dark:bg-primary-950">
            <h3 className="text-xs uppercase tracking-wider text-secondary-600 dark:text-secondary-400 font-semibold">{title}</h3>
            <div className="flex flex-col gap-2">{children}</div>
        </div>
    );
}

export function OptionRow({ label, children, title }: { label: string, children: ReactNode, title?: string }) {
    return (
        <label className="flex flex-row items-center justify-between gap-3 text-sm" title={title}>
            <span className="text-secondary-800 dark:text-secondary-200">{label}</span>
            <div className="flex flex-row items-center gap-2">{children}</div>
        </label>
    );
}

export default function OptionsPanel({ children }: { children: ReactNode }) {
    return (
        <div className="flex flex-col gap-3 overflow-y-auto p-1 flex-grow min-h-0">
            {children}
        </div>
    );
}
