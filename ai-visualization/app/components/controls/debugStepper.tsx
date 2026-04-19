import { useCallback, useEffect, useRef, useState } from "react";
import { IconButton } from "@mui/material";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";

import "./debugStepper.css";

export const MAX_INTERVAL_MS = 2000;
export const DEFAULT_INTERVAL_MS = 800;
export const SPEED_STEP_MS = 50;

export interface DebugStepperProps {
    step: number;
    maxSteps: number;
    explanation?: string;
    question?: string;
    answer?: string;
    playing?: boolean;
    onPlayingChange?: (playing: boolean) => void;
    onStepChange: (step: number) => void;
    caseSteps?: Set<number>;
    /**
     * When provided, the stepper becomes externally speed-controlled and
     * its inline speed UI is hidden — callers render the control in their
     * own Options panel instead.
     */
    intervalMs?: number;
    onIntervalMsChange?: (ms: number) => void;
}

export function clampSpeed(v: number) {
    // Lower bound removed — 0 ms allows effectively instant playback. Still
    // cap at the upper end so a stray large value can't stall the timer.
    return Math.max(0, Math.min(MAX_INTERVAL_MS, v));
}

export default function DebugStepper({ step, maxSteps, explanation, question, answer, playing: playingProp, onPlayingChange: onPlayingChangeProp, onStepChange, caseSteps, intervalMs: intervalMsProp, onIntervalMsChange }: DebugStepperProps) {
    const [internalPlaying, setInternalPlaying] = useState(false);
    const playing = playingProp ?? internalPlaying;
    const onPlayingChange = onPlayingChangeProp ?? setInternalPlaying;
    const isControlled = intervalMsProp !== undefined;
    const [internalIntervalMs, setInternalIntervalMs] = useState(DEFAULT_INTERVAL_MS);
    const intervalMs = intervalMsProp ?? internalIntervalMs;
    const setIntervalMs = (ms: number) => {
        if (isControlled) onIntervalMsChange?.(ms);
        else setInternalIntervalMs(ms);
    };
    const [speedInput, setSpeedInput] = useState(String(DEFAULT_INTERVAL_MS));
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const stepRef = useRef(step);
    stepRef.current = step;
    const maxRef = useRef(maxSteps);
    maxRef.current = maxSteps;

    const goTo = useCallback((s: number) => {
        onStepChange(Math.max(0, Math.min(s, maxSteps)));
    }, [maxSteps, onStepChange]);

    const updateSpeed = (ms: number) => {
        const clamped = clampSpeed(ms);
        setIntervalMs(clamped);
        setSpeedInput(String(clamped));
    };

    const caseStepsRef = useRef(caseSteps);
    caseStepsRef.current = caseSteps;

    useEffect(() => {
        if (!playing) {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = null;
            return;
        }
        function scheduleFrom(cur: number) {
            const max = maxRef.current;
            if (cur >= max) {
                onPlayingChange(false);
                return;
            }
            const delay = caseStepsRef.current?.has(cur) ? intervalMs * 4 : intervalMs;
            timerRef.current = setTimeout(() => {
                const nextStep = Math.min(cur + 1, maxRef.current);
                onStepChange(nextStep);
                scheduleFrom(nextStep);
            }, delay);
        }
        scheduleFrom(stepRef.current);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [playing, intervalMs, onStepChange, onPlayingChange]);

    useEffect(() => {
        if (step >= maxSteps) onPlayingChange(false);
    }, [step, maxSteps, onPlayingChange]);

    const commitSpeedInput = () => {
        const parsed = parseInt(speedInput, 10);
        if (isNaN(parsed)) {
            setSpeedInput(String(intervalMs));
        } else {
            updateSpeed(parsed);
        }
    };

    const navDisabled = maxSteps === 0;

    return (
        <div className="debug-stepper flex flex-col">
            <div className="flex items-center justify-between gap-2 px-1">
                {/* Step back / forward */}
                <div className={`flex items-center gap-0.5${navDisabled ? " opacity-40" : ""}`}>
                    <IconButton size="small" sx={{ color: "white" }} onClick={() => { onPlayingChange(false); goTo(step - 1); }} disabled={navDisabled} aria-label="Step back">
                        <NavigateBeforeIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" sx={{ color: "white" }} onClick={() => { onPlayingChange(false); goTo(step + 1); }} disabled={navDisabled} aria-label="Step forward">
                        <NavigateNextIcon fontSize="small" />
                    </IconButton>
                </div>

                <span className={`text-xs whitespace-nowrap text-white${navDisabled ? " opacity-40" : ""}`}>
                    Step {step} / {maxSteps}
                </span>

                {/* Speed: [-] [input] [+] — hidden when the speed is
                    controlled externally (e.g., via the Options tab). */}
                {!isControlled && (
                    <div className="flex items-center gap-0">
                        <IconButton size="small" sx={{ color: "white" }} onClick={() => updateSpeed(intervalMs - SPEED_STEP_MS)} aria-label="Decrease speed">
                            <RemoveIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                        <input
                            type="text"
                            inputMode="numeric"
                            className="debug-stepper-speed-input"
                            value={speedInput}
                            onChange={(e) => setSpeedInput(e.target.value)}
                            onBlur={commitSpeedInput}
                            onKeyDown={(e) => { if (e.key === "Enter") commitSpeedInput(); }}
                        />
                        <IconButton size="small" sx={{ color: "white" }} onClick={() => updateSpeed(intervalMs + SPEED_STEP_MS)} aria-label="Increase speed">
                            <AddIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                        <span className="text-[10px] text-white opacity-70 ml-0.5">ms</span>
                    </div>
                )}

            </div>

            {/* Branch Q&A panel */}
            {question ? (
                <div className="rounded border p-1.5 mt-1 text-sm max-h-24 overflow-auto border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-950">
                    <div className="text-white/60 italic">Q: {question}</div>
                    {answer ? <div className="text-white font-semibold mt-0.5">A: {answer}</div> : null}
                </div>
            ) : explanation != null && explanation !== "" ? (
                <div className="rounded border p-1.5 mt-1 text-sm max-h-16 overflow-auto border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-950">
                    {explanation}
                </div>
            ) : null}
        </div>
    );
}
