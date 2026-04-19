"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "@/app/components/header";
import EditorTabs from "@/app/components/editors/editorTabs";
import OptionsPanel, { OptionsSection, OptionRow } from "@/app/components/editors/optionsPanel";
import { buttonStyleClassNames, dangerButtonStyleClassNames } from "@/lib/statics/styleConstants";
import DebugStepper, { DEFAULT_INTERVAL_MS } from "@/app/components/controls/debugStepper";
import AnimationSpeedRow from "@/app/components/controls/animationSpeedRow";
import VertexPanel from "@/app/components/controls/vertexPanel";
import PriorityQueuePanel from "@/app/components/controls/priorityQueuePanel";
import DijkstraGraphView from "./components/dijkstraGraphView";
import { LayoutKind, LAYOUT_OPTIONS } from "@/lib/graphs/layouts";
import { VDivider } from "@/app/components/divider";
import { toast } from "react-toastify";
import { ensureError } from "@/lib/errors/error";
import { GenericGraph } from "@/lib/graphs/graph";
import {
    DijkstraStep,
    DijkstraSolutionBase,
    buildDijkstraSolution,
    QueueEntry,
    VertexSnapshot,
} from "@/lib/dijkstra/dijkstraSolution";
import {
    AnnotationEntry,
    LineAnnotation,
    ResolvedAnnotationMap,
    BranchScopeMap,
    resolveAnnotations,
    unresolveAnnotation,
    buildBranchScopeMap,
} from "@/lib/rbt/rbtAnnotations";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";

export default function SingleSourceShortestPathPage() {
    // ── Layout ───────────────────────────────────────────────────────────────
    const [leftWidth, setLeftWidth] = useState(550);

    // ── Algorithm state ───────────────────────────────────────────────────────
    const [graph, setGraph] = useState<GenericGraph | null>(null);
    const [solution, setSolution] = useState<DijkstraSolutionBase | null>(null);
    const [steps, setSteps] = useState<DijkstraStep[]>([]);
    const [stepIndex, setStepIndex] = useState(0);
    const [renderKey, setRenderKey] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [allowNegativeWeights, setAllowNegativeWeights] = useState(false);
    const [layoutSeed, setLayoutSeed] = useState(1);
    const [layoutKind, setLayoutKind] = useState<LayoutKind>("cola");
    const [physicsEnabled, setPhysicsEnabled] = useState(false);
    const [layoutSpacing, setLayoutSpacing] = useState(260);
    const [intervalMs, setIntervalMs] = useState(DEFAULT_INTERVAL_MS);
    // Start-vertex override: pending = selected in dropdown, applied = last
    // committed via Apply (fed into runAlgo). Empty string = use case file.
    const [pendingStartOverride, setPendingStartOverride] = useState<string>("");
    const [appliedStartOverride, setAppliedStartOverride] = useState<string>("");

    // Reflect the currently-running start in the dropdown whenever the graph
    // is (re)loaded, so the user always sees what's active — the case file's
    // START or their applied override.
    useEffect(() => {
        if (graph?.startNode) {
            setPendingStartOverride(graph.startNode.id);
        }
    }, [graph]);

    const nodeIds = useMemo(
        () => (graph ? graph.getAllNodes().map(n => n.id).sort() : []),
        [graph],
    );

    const handleApplyAlgorithmOptions = () => {
        setAppliedStartOverride(pendingStartOverride);
        runAlgo(pendingStartOverride);
    };

    // Gutters reserved so fit() positions the graph clear of the floating
    // UI: a fixed-width column on the right (PQ + Vertex stack) and a small
    // strip at the bottom for the stepper bubble.
    const RIGHT_PANEL_WIDTH = 240;
    const RIGHT_GUTTER = RIGHT_PANEL_WIDTH + 24; // panel + left/right padding
    const BOTTOM_GUTTER = 72;

    const stepsRef = useRef(steps);
    stepsRef.current = steps;
    const stepIndexRef = useRef(stepIndex);
    stepIndexRef.current = stepIndex;

    // ── Data strings ─────────────────────────────────────────────────────────
    const [caseData, setCaseData] = useState("");
    const [algoData, setAlgoData] = useState("");
    const [caseErrorMessage, setCaseErrorMessage] = useState("");
    const [algoErrorMessage, setAlgoErrorMessage] = useState("");

    // ── Fit ref ───────────────────────────────────────────────────────────────
    const fitRef = useRef<(() => void) | null>(null);
    const hasAutoRun = useRef(false);
    const runRef = useRef<() => void>(() => {});

    // ── Annotation state ─────────────────────────────────────────────────────

    const [defaultAnnotationEntries, setDefaultAnnotationEntries] = useState<AnnotationEntry[]>([]);
    const [annotationEntries, setAnnotationEntries] = useState<AnnotationEntry[]>([]);

    const resolvedAnnotations: ResolvedAnnotationMap = useMemo(
        () => resolveAnnotations(annotationEntries, algoData),
        [annotationEntries, algoData],
    );
    const defaultResolvedAnnotations: ResolvedAnnotationMap = useMemo(
        () => resolveAnnotations(defaultAnnotationEntries, algoData),
        [defaultAnnotationEntries, algoData],
    );
    const branchScopeMap: BranchScopeMap = useMemo(
        () => buildBranchScopeMap(algoData),
        [algoData],
    );

    useEffect(() => {
        if (solution) {
            solution.setAnnotations(resolvedAnnotations);
            solution.setBranchScopeMap(branchScopeMap);
        }
    }, [solution, resolvedAnnotations, branchScopeMap]);

    const onAnnotationsLoaded = useCallback((entries: AnnotationEntry[]) => {
        setDefaultAnnotationEntries(entries);
        setAnnotationEntries(entries);
    }, []);

    const onAnnotationEdit = useCallback((line: number, annotation: LineAnnotation | null) => {
        setAnnotationEntries(prev => {
            const key = unresolveAnnotation(line, algoData);
            if (!key) return prev;
            const next = prev.filter(
                e => !(e.fn === key.fn && e.anchor === key.anchor && (e.occurrence ?? 0) === key.occurrence),
            );
            if (annotation) {
                next.push({ fn: key.fn, anchor: key.anchor, occurrence: key.occurrence, annotation });
            }
            return next;
        });
    }, [algoData]);

    // ── Derived step state ────────────────────────────────────────────────────

    const activeLine = useMemo(() => {
        if (stepIndex <= 0 || steps.length === 0) return null;
        return steps[stepIndex - 1]?.sourceLine ?? null;
    }, [stepIndex, steps]);

    const explanation = useMemo(() => {
        if (stepIndex <= 0 || steps.length === 0) return undefined;
        const val = steps[stepIndex - 1]?.debugValue;
        return val != null ? String(val) : undefined;
    }, [stepIndex, steps]);

    const currentStep = stepIndex > 0 && steps.length > 0 ? steps[stepIndex - 1] : undefined;
    const question = currentStep?.question;
    const answer = currentStep?.answer;

    const vertexSnapshot: VertexSnapshot = useMemo(() => {
        if (stepIndex <= 0 || steps.length === 0) return {};
        return steps[stepIndex - 1]?.vertexSnapshot ?? {};
    }, [stepIndex, steps]);

    const queueEntries: QueueEntry[] = useMemo(() => {
        if (stepIndex <= 0 || steps.length === 0) return [];
        return steps[stepIndex - 1]?.queueSnapshot ?? [];
    }, [stepIndex, steps]);

    // ── Run algorithm ─────────────────────────────────────────────────────────

    function runAlgo(startOverrideArg?: string) {
        let parsedGraph: GenericGraph;
        try {
            parsedGraph = GenericGraph.fromNotation(caseData) as GenericGraph;
        } catch (err) {
            const error = ensureError(err);
            setCaseErrorMessage(error.message);
            return;
        }

        // Honor an explicit arg from Apply, else fall back to last committed
        // override from the Algorithm Options section.
        const override = startOverrideArg !== undefined ? startOverrideArg : appliedStartOverride;
        if (override) {
            try {
                parsedGraph.setProp("start", override);
            } catch (err) {
                setCaseErrorMessage(ensureError(err).message);
                return;
            }
        }

        if (!parsedGraph.startNode) {
            setCaseErrorMessage("No source node defined. Add a START line to the case (e.g. START s).");
            return;
        }

        const hasNegative = parsedGraph.getAllEdges().some(e => e.weight < 0);
        if (hasNegative && !allowNegativeWeights) {
            setCaseErrorMessage(
                "Negative edge weights detected. Enable \"Allow negative weights\" to proceed and observe Dijkstra's incorrect behavior.",
            );
            return;
        }
        if (hasNegative) {
            toast.warning("Negative edge weights detected: Dijkstra may produce incorrect results.");
        }

        let sol: DijkstraSolutionBase;
        try {
            sol = buildDijkstraSolution(algoData, parsedGraph, resolvedAnnotations, branchScopeMap);
        } catch (err) {
            const error = ensureError(err);
            setAlgoErrorMessage(error.message);
            return;
        }

        let newSteps: DijkstraStep[];
        try {
            newSteps = sol.getSolveSteps(parsedGraph.startNode);
        } catch (err) {
            const error = ensureError(err);
            setAlgoErrorMessage(`Error during solve: ${error.message}`);
            return;
        }

        setGraph(parsedGraph);
        setSolution(sol);
        setSteps(newSteps);
        setStepIndex(0);
        setRenderKey(k => k + 1);
        setLayoutSeed(1);
        setCaseErrorMessage("");
        setAlgoErrorMessage("");
        toast.success(`Ready — ${newSteps.length} steps recorded`);
    }

    runRef.current = runAlgo;

    useEffect(() => {
        if (algoData && caseData && !hasAutoRun.current) {
            hasAutoRun.current = true;
            runRef.current();
        }
    }, [algoData, caseData]);

    // ── Step management ───────────────────────────────────────────────────────

    const onStepChange = useCallback((newStep: number) => {
        if (!graph) return;
        const curSteps = stepsRef.current;
        const startIdx = stepIndexRef.current;
        if (curSteps.length === 0) return;
        let idx = startIdx;
        const maxIter = curSteps.length + 2;
        let iter = 0;
        while (newStep > idx && idx < curSteps.length && iter++ < maxIter) {
            const step = curSteps[idx];
            if (step.command) step.command.execute();
            idx++;
        }
        while (newStep < idx && idx > 0 && iter++ < maxIter) {
            idx--;
            const step = curSteps[idx];
            if (step.command) step.command.revert();
        }
        stepIndexRef.current = idx;
        if (idx !== startIdx) {
            setStepIndex(idx);
            setRenderKey(k => k + 1);
        }
    }, [graph]);

    // ── Callbacks ─────────────────────────────────────────────────────────────

    const onCaseDataChanged = useCallback((raw: string) => {
        setCaseData(raw);
        setCaseErrorMessage("");
    }, []);

    const onAlgoDataChanged = useCallback((raw: string) => {
        setAlgoData(raw);
        setAlgoErrorMessage("");
    }, []);

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-dvh overflow-hidden">
            <Header selectedPage="singlesourceshortestpath" />
            <div className="flex flex-row items-stretch flex-grow min-h-0">
                {/* Left panel: editors */}
                <div className="flex flex-col justify-stretch min-h-0" style={{ width: `${leftWidth}px` }}>
                    <EditorTabs
                        problem="single-source-shortest-path"
                        runner={runAlgo}
                        onSolutionChanged={onAlgoDataChanged}
                        onAnnotationsLoaded={onAnnotationsLoaded}
                        algoErrorMessage={algoErrorMessage}
                        activeLine={activeLine}
                        annotations={resolvedAnnotations}
                        defaultAnnotations={defaultResolvedAnnotations}
                        onAnnotationEdit={onAnnotationEdit}
                        caseData={caseData}
                        onCaseDataChanged={onCaseDataChanged}
                        caseErrorMessage={caseErrorMessage}
                        options={
                            <OptionsPanel>
                                <OptionsSection title="Animation Options">
                                    <AnimationSpeedRow intervalMs={intervalMs} onIntervalMsChange={setIntervalMs} />
                                </OptionsSection>
                                <OptionsSection title="Algorithm Options">
                                    <OptionRow
                                        label="Allow negative weights"
                                        title="Let Dijkstra run on graphs with negative edges to observe its incorrect behavior"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={allowNegativeWeights}
                                            onChange={e => {
                                                setAllowNegativeWeights(e.target.checked);
                                                setCaseErrorMessage("");
                                            }}
                                            className="accent-amber-400"
                                        />
                                    </OptionRow>
                                    <OptionRow
                                        label="Override start vertex"
                                        title="Pick a different source vertex without editing the case file"
                                    >
                                        <select
                                            value={pendingStartOverride}
                                            onChange={e => setPendingStartOverride(e.target.value)}
                                            disabled={nodeIds.length === 0}
                                            className={`${buttonStyleClassNames} px-2 py-1 rounded border border-secondary-200 dark:border-secondary-800 text-sm disabled:opacity-50`}
                                        >
                                            {nodeIds.length === 0 && <option value="">(run once to load)</option>}
                                            {nodeIds.map(id => (
                                                <option key={id} value={id}>{id}</option>
                                            ))}
                                        </select>
                                    </OptionRow>
                                    <div className="flex justify-end pt-1">
                                        <button
                                            onClick={handleApplyAlgorithmOptions}
                                            disabled={!graph}
                                            className={`${dangerButtonStyleClassNames} px-3 py-1 rounded text-sm disabled:opacity-50`}
                                        >
                                            Apply
                                        </button>
                                    </div>
                                </OptionsSection>
                                <OptionsSection title="Layout">
                                    <OptionRow label="Algorithm" title="Choose the layout algorithm used to seed node positions">
                                        <select
                                            value={layoutKind}
                                            onChange={e => setLayoutKind(e.target.value as LayoutKind)}
                                            className={`${buttonStyleClassNames} px-2 py-1 rounded border border-secondary-200 dark:border-secondary-800 text-sm`}
                                        >
                                            {LAYOUT_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    </OptionRow>
                                    <OptionRow label="Re-layout" title="Re-run the auto-layout (Cola cycles seeds; AVSDF/ELK simply recompute)">
                                        <button
                                            onClick={() => setLayoutSeed(s => s + 1)}
                                            className={`${buttonStyleClassNames} px-3 py-1 rounded border border-secondary-200 dark:border-secondary-800 text-sm`}
                                        >
                                            Re-layout
                                        </button>
                                    </OptionRow>
                                    <OptionRow label="Fit view" title="Center and fit the graph to the viewport">
                                        <button
                                            onClick={() => fitRef.current?.()}
                                            className={`${buttonStyleClassNames} px-3 py-1 rounded border border-secondary-200 dark:border-secondary-800 text-sm`}
                                        >
                                            Fit
                                        </button>
                                    </OptionRow>
                                    <OptionRow
                                        label={`Spacing (${layoutSpacing}px)`}
                                        title={physicsEnabled ? "Incompatible with physics" : "Target distance between adjacent nodes in the layout"}
                                    >
                                        <div className="flex flex-col items-end gap-0.5">
                                            <input
                                                type="range"
                                                min="100"
                                                max="500"
                                                step="20"
                                                value={layoutSpacing}
                                                onChange={e => setLayoutSpacing(parseInt(e.target.value, 10))}
                                                disabled={physicsEnabled}
                                                className="accent-amber-400 w-32 disabled:opacity-40 disabled:cursor-not-allowed"
                                            />
                                            {physicsEnabled && (
                                                <span className="text-[10px] italic text-secondary-500">Incompatible with physics</span>
                                            )}
                                        </div>
                                    </OptionRow>
                                </OptionsSection>
                                <OptionsSection title="Visual">
                                    <OptionRow label="Physics" title="Let vis-network's physics relax from the seeded positions so dragging propagates through edges">
                                        <input
                                            type="checkbox"
                                            checked={physicsEnabled}
                                            onChange={e => setPhysicsEnabled(e.target.checked)}
                                            className="accent-amber-400"
                                        />
                                    </OptionRow>
                                </OptionsSection>
                            </OptionsPanel>
                        }
                    />
                </div>
                <VDivider onWidthChangeRequest={(v) => setLeftWidth(leftWidth + v)} />

                {/* Right panel: solution viewport */}
                <div className="relative flex-grow m-2 overflow-hidden min-w-0">
                    {/* Graph viewport — inset on the right (for PQ/Vertex
                        stack) and bottom (for stepper bubble) so fit()
                        never parks nodes under the floating UI. */}
                    <div
                        className="absolute top-0 left-0"
                        style={{ right: `${RIGHT_GUTTER}px`, bottom: `${BOTTOM_GUTTER}px` }}
                    >
                        <DijkstraGraphView
                            graph={graph}
                            renderKey={renderKey}
                            currentStep={currentStep}
                            onFitRef={fitRef}
                            layoutSeed={layoutSeed}
                            layoutKind={layoutKind}
                            physicsEnabled={physicsEnabled}
                            layoutSpacing={layoutSpacing}
                        />
                    </div>

                    {/* Top-left: Play/Pause */}
                    <div className="absolute top-3 left-3 z-20 flex flex-col gap-2">
                        {steps.length > 0 && (
                            <button
                                onClick={() => setPlaying(p => !p)}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-950/80 backdrop-blur-sm border border-secondary-800 text-white text-sm hover:bg-primary-900/90 transition-colors cursor-pointer"
                            >
                                {playing ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                                <span>{playing ? "Pause" : "Play"} animation</span>
                            </button>
                        )}
                    </div>

                    {/* Top-center: Annotation Q&A / explanation */}
                    {question ? (
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 max-w-md w-full px-4 py-2 rounded-lg bg-primary-950/80 backdrop-blur-sm border border-secondary-800 text-sm">
                            <div className="text-white/60 italic">Q: {question}</div>
                            {answer && <div className="text-white font-semibold mt-0.5">A: {answer}</div>}
                        </div>
                    ) : explanation ? (
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 max-w-md w-full px-4 py-2 rounded-lg bg-primary-950/80 backdrop-blur-sm border border-secondary-800 text-white text-sm">
                            {explanation}
                        </div>
                    ) : null}

                    {/* Right rail: Priority Queue stacked above Vertices,
                        both fixed-width so row expansion scrolls inside
                        the Vertices panel instead of pushing the PQ. */}
                    <div
                        className="absolute top-3 right-3 z-20 flex flex-col gap-2"
                        style={{ width: `${RIGHT_PANEL_WIDTH}px` }}
                    >
                        <PriorityQueuePanel entries={queueEntries} />
                        <VertexPanel snapshot={vertexSnapshot} />
                    </div>

                    {/* Bottom-left stepper bubble — replaces the old
                        full-width debugger bar. */}
                    <div className="absolute bottom-3 left-3 z-20 px-2 py-1 rounded-lg bg-primary-950/80 backdrop-blur-sm border border-secondary-800 shadow-lg">
                        <DebugStepper
                            step={stepIndex}
                            maxSteps={steps.length}
                            playing={playing}
                            onPlayingChange={setPlaying}
                            onStepChange={onStepChange}
                            intervalMs={intervalMs}
                            onIntervalMsChange={setIntervalMs}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
