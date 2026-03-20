"use client";

import { useEffect, useRef, useState } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

export interface CaseEntry {
    label: string;
    stepIndex: number;
}

const CASE_COLORS: Record<string, string> = {
    "Insert Case 1": "#0072B2",
    "Insert Case 2": "#E69F00",
    "Insert Case 3": "#009E73",
    "Delete Case 1": "#CC79A7",
    "Delete Case 2": "#56B4E9",
    "Delete Case 3": "#D55E00",
    "Delete Case 4": "#F0E442",
};

const DEFAULT_COLOR = "#94a3b8";

function colorFor(label: string): string {
    return CASE_COLORS[label] ?? DEFAULT_COLOR;
}

function needsDarkText(hex: string): boolean {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6;
}

interface CaseTrackerProps {
    cases: CaseEntry[];
    onJumpToStep?: (stepIndex: number) => void;
}

export default function CaseTracker({ cases, onJumpToStep }: CaseTrackerProps) {
    const [expanded, setExpanded] = useState(false);
    const [glowing, setGlowing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const prevCountRef = useRef(0);

    useEffect(() => {
        if (cases.length > prevCountRef.current) {
            setGlowing(true);
            const timer = setTimeout(() => setGlowing(false), 1500);
            prevCountRef.current = cases.length;
            return () => clearTimeout(timer);
        }
        prevCountRef.current = cases.length;
    }, [cases.length]);

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

    if (cases.length === 0) return null;

    const latest = cases[cases.length - 1];
    const bg = colorFor(latest.label);
    const dark = needsDarkText(bg);

    return (
        <div ref={containerRef} className="select-none">
            <button
                onClick={() => setExpanded(e => !e)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold shadow-md cursor-pointer transition-opacity hover:opacity-90"
                style={{
                    backgroundColor: bg,
                    color: dark ? "#1e293b" : "#fff",
                    boxShadow: glowing ? `0 0 16px 6px ${bg}80` : undefined,
                    transition: "box-shadow 0.4s ease-in-out",
                }}
            >
                <span>{latest.label}</span>
                {cases.length > 1 && (
                    expanded
                        ? <ExpandLessIcon sx={{ fontSize: 18 }} />
                        : <ExpandMoreIcon sx={{ fontSize: 18 }} />
                )}
            </button>

            {expanded && cases.length > 1 && (
                <div className="mt-1 rounded-lg overflow-hidden shadow-lg border border-secondary-800 bg-primary-950/90 backdrop-blur-sm max-h-48 overflow-y-auto">
                    {[...cases].reverse().map((c, i) => {
                        const cBg = colorFor(c.label);
                        const cDark = needsDarkText(cBg);
                        return (
                            <button
                                key={`${c.stepIndex}-${i}`}
                                onClick={() => {
                                    onJumpToStep?.(c.stepIndex);
                                    setExpanded(false);
                                }}
                                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:opacity-80 transition-opacity cursor-pointer"
                            >
                                <span
                                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: cBg }}
                                />
                                <span style={{ color: cDark ? cBg : cBg }} className="font-medium">
                                    {c.label}
                                </span>
                                <span className="ml-auto text-white/40">step {c.stepIndex}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
