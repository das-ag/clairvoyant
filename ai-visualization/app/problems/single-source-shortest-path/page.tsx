"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "@/app/components/header";
import SolutionEditor from "@/app/components/editors/solutionEditor";
import CaseEditor from "@/app/components/editors/problemEditor";
import DebugStepper from "@/app/components/controls/debugStepper";
import VertexPanel from "@/app/components/controls/vertexPanel";
import PriorityQueuePanel from "@/app/components/controls/priorityQueuePanel";
import DijkstraGraphView from "./components/dijkstraGraphView";
import { HDivider, VDivider } from "@/app/components/divider";
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
    const [solHeight, setSolHeight] = useState(670);

    // ── Algorithm state ───────────────────────────────────────────────────────
    const [graph, setGraph] = useState<GenericGraph | null>(null);
    const [solution, setSolution] = useState<DijkstraSolutionBase | null>(null);
    const [steps, setSteps] = useState<DijkstraStep[]>([]);
    const [stepIndex, setStepIndex] = useState(0);
    const [renderKey, setRenderKey] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [allowNegativeWeights, setAllowNegativeWeights] = useState(false);

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

    function runAlgo() {
        let parsedGraph: GenericGraph;
        try {
            parsedGraph = GenericGraph.fromNotation(caseData) as GenericGraph;
        } catch (err) {
            const error = ensureError(err);
            setCaseErrorMessage(error.message);
            return;
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
                    <SolutionEditor
                        solutionHeight={solHeight}
                        problem="single-source-shortest-path"
                        onSolutionChanged={onAlgoDataChanged}
                        onAnnotationsLoaded={onAnnotationsLoaded}
                        runner={runAlgo}
                        errorMessage={algoErrorMessage}
                        activeLine={activeLine}
                        annotations={resolvedAnnotations}
                        defaultAnnotations={defaultResolvedAnnotations}
                        onAnnotationEdit={onAnnotationEdit}
                    />
                    <HDivider onWidthChangeRequest={(v) => setSolHeight(solHeight + v)} />
                    <CaseEditor
                        problem="single-source-shortest-path"
                        caseData={caseData}
                        onCaseDataChanged={onCaseDataChanged}
                        errorMessage={caseErrorMessage}
                    />
                </div>
                <VDivider onWidthChangeRequest={(v) => setLeftWidth(leftWidth + v)} />

                {/* Right panel: solution viewport */}
                <div className="relative flex-grow m-2 overflow-hidden min-w-0">
                    {/* Graph visualization fills entire panel */}
                    <DijkstraGraphView
                        graph={graph}
                        renderKey={renderKey}
                        currentStep={currentStep}
                        onFitRef={fitRef}
                    />

                    {/* Top-left: Play/Pause + Fit */}
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
                        <button
                            onClick={() => fitRef.current?.()}
                            className="flex items-center px-3 py-1.5 rounded-lg bg-primary-950/80 backdrop-blur-sm border border-secondary-800 text-white text-xs hover:bg-primary-900/90 transition-colors cursor-pointer opacity-70 hover:opacity-100"
                        >
                            Fit
                        </button>
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

                    {/* Top-right: Priority Queue Panel */}
                    <div className="absolute top-3 right-3 z-20">
                        <PriorityQueuePanel entries={queueEntries} />
                    </div>

                    {/* Bottom overlay: controls */}
                    <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
                        <div className="pointer-events-auto p-3 bg-primary-950/80 backdrop-blur-sm border-t border-secondary-800">
                            {/* Negative weight toggle */}
                            <label className="flex items-center gap-2 text-xs text-secondary-400 mb-2 cursor-pointer select-none w-fit">
                                <input
                                    type="checkbox"
                                    checked={allowNegativeWeights}
                                    onChange={e => {
                                        setAllowNegativeWeights(e.target.checked);
                                        setCaseErrorMessage("");
                                    }}
                                    className="accent-amber-400"
                                />
                                <span>Allow negative weights <span className="text-amber-400">(observe incorrect behavior)</span></span>
                            </label>

                            {/* Vertex list + Stepper */}
                            <div className="flex flex-row gap-2 items-start flex-wrap xl:flex-nowrap">
                                <div className="w-56 shrink-0">
                                    <VertexPanel snapshot={vertexSnapshot} />
                                </div>
                                <div className="flex-grow min-w-0">
                                    <DebugStepper
                                        step={stepIndex}
                                        maxSteps={steps.length}
                                        playing={playing}
                                        onPlayingChange={setPlaying}
                                        onStepChange={onStepChange}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
