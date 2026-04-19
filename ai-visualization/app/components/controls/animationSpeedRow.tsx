import { useEffect, useState } from "react";
import { IconButton } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { OptionRow } from "@/app/components/editors/optionsPanel";
import { MAX_INTERVAL_MS, SPEED_STEP_MS, clampSpeed } from "./debugStepper";

export interface AnimationSpeedRowProps {
    intervalMs: number;
    onIntervalMsChange: (ms: number) => void;
}

export default function AnimationSpeedRow({ intervalMs, onIntervalMsChange }: AnimationSpeedRowProps) {
    const [inputValue, setInputValue] = useState(String(intervalMs));
    useEffect(() => { setInputValue(String(intervalMs)); }, [intervalMs]);

    const update = (ms: number) => onIntervalMsChange(clampSpeed(ms));
    const commit = () => {
        const parsed = parseInt(inputValue, 10);
        if (isNaN(parsed)) setInputValue(String(intervalMs));
        else update(parsed);
    };

    return (
        <OptionRow
            label={`Speed (${intervalMs} ms)`}
            title={`Delay between steps during playback; 0 = instant, max ${MAX_INTERVAL_MS} ms`}
        >
            <div className="flex items-center gap-0">
                <IconButton size="small" sx={{ color: "inherit" }} onClick={() => update(intervalMs - SPEED_STEP_MS)} aria-label="Decrease speed">
                    <RemoveIcon sx={{ fontSize: 14 }} />
                </IconButton>
                <input
                    type="text"
                    inputMode="numeric"
                    className="w-14 text-center bg-transparent border border-secondary-300 dark:border-secondary-700 rounded text-sm px-1 py-0.5"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
                />
                <IconButton size="small" sx={{ color: "inherit" }} onClick={() => update(intervalMs + SPEED_STEP_MS)} aria-label="Increase speed">
                    <AddIcon sx={{ fontSize: 14 }} />
                </IconButton>
            </div>
        </OptionRow>
    );
}
