import { useCallback, useEffect, useRef, useState } from "react";
import { IconButton } from "@mui/material";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";

import "./debugStepper.css";

const MIN_INTERVAL_MS = 150;
const MAX_INTERVAL_MS = 2000;
const DEFAULT_INTERVAL_MS = 800;
const SPEED_STEP_MS = 50;

export interface DebugStepperProps {
    step: number;
    maxSteps: number;
    explanation?: string;
    onStepChange: (step: number) => void;
}

function clampSpeed(v: number) {
    return Math.max(MIN_INTERVAL_MS, Math.min(MAX_INTERVAL_MS, v));
}

export default function DebugStepper({ step, maxSteps, explanation, onStepChange }: DebugStepperProps) {
    const [playing, setPlaying] = useState(false);
    const [intervalMs, setIntervalMs] = useState(DEFAULT_INTERVAL_MS);
    const [speedInput, setSpeedInput] = useState(String(DEFAULT_INTERVAL_MS));
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const stepRef = useRef(step);
    stepRef.current = step;
    const maxRef = useRef(maxSteps);
    maxRef.current = maxSteps;

    const goTo = useCallback((s: number) => {
        onStepChange(Math.max(0, Math.min(s, maxSteps)));
    }, [maxSteps, onStepChange]);

    const updateSpeed = useCallback((ms: number) => {
        const clamped = clampSpeed(ms);
        setIntervalMs(clamped);
        setSpeedInput(String(clamped));
    }, []);

    useEffect(() => {
        if (!playing) {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            return;
        }
        timerRef.current = setInterval(() => {
            const cur = stepRef.current;
            const max = maxRef.current;
            if (cur >= max) {
                setPlaying(false);
                return;
            }
            onStepChange(cur + 1);
        }, intervalMs);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [playing, intervalMs, onStepChange]);

    useEffect(() => {
        if (step >= maxSteps) setPlaying(false);
    }, [step, maxSteps]);

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
                    <IconButton size="small" sx={{ color: "white" }} onClick={() => goTo(step - 1)} disabled={navDisabled} aria-label="Step back">
                        <NavigateBeforeIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" sx={{ color: "white" }} onClick={() => goTo(step + 1)} disabled={navDisabled} aria-label="Step forward">
                        <NavigateNextIcon fontSize="small" />
                    </IconButton>
                </div>

                <span className={`text-xs whitespace-nowrap text-white${navDisabled ? " opacity-40" : ""}`}>
                    Step {step} / {maxSteps}
                </span>

                {/* Speed: [-] [input] [+] */}
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

                {/* Auto-play toggle */}
                <IconButton
                    size="small"
                    sx={{ color: "white" }}
                    onClick={() => setPlaying((p) => !p)}
                    aria-label={playing ? "Pause auto-play" : "Start auto-play"}
                    className={playing ? "debug-stepper-auto-active" : ""}
                >
                    {playing ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                </IconButton>
            </div>

            {/* Explanation panel */}
            {explanation != null && explanation !== "" ? (
                <div className="debug-stepper-explanation rounded border p-1.5 mt-1 text-sm max-h-16 overflow-auto border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-950">
                    {explanation}
                </div>
            ) : null}
        </div>
    );
}
