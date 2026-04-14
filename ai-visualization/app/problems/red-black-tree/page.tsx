"use client"

import Header from "@/app/components/header";
import SolutionEditor from "@/app/components/editors/solutionEditor";
import CaseEditor from "@/app/components/editors/problemEditor";
import DebugStepper from "@/app/components/controls/debugStepper";
import WatchPanel, { WatchEntry } from "@/app/components/controls/watchPanel";
import RBTView from "./components/rbtView";
import { RBTree } from "@/lib/rbt/rbtree";
import { RBTStep, RBTSolutionBase, buildRBTSolution } from "@/lib/rbt/rbtSolution";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ensureError } from "@/lib/errors/error";
import { HDivider, VDivider } from "@/app/components/divider";
import { toast } from "react-toastify";
import { buttonStyleClassNames } from "@/lib/statics/styleConstants";
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
import CaseTracker, { CaseEntry } from "@/app/components/controls/caseTracker";
import { useIsMobile } from "@/app/hooks/useIsMobile";

const DEMO_KEYS = [3, 9, 11, 17, 21, 27, 33, 39, 45, 51];

export default function RedBlackTreePage() {
    let [tree, setTree] = useState<RBTree | null>(null);
    let [solution, setSolution] = useState<RBTSolutionBase | null>(null);
    let [leftWidth, setLeftWidth] = useState(550);
    let [solHeight, setSolHeight] = useState(670);
    let [caseErrorMessage, setCaseErrorMessage] = useState("");
    let [algoErrorMessage, setAlgoErrorMessage] = useState("");
    let [caseData, setCaseData] = useState("");
    let [algoData, setAlgoData] = useState("");
    let [steps, setSteps] = useState<RBTStep[]>([]);
    let [stepIndex, setStepIndex] = useState(0);
    let [renderKey, setRenderKey] = useState(0);
    let [playing, setPlaying] = useState(false);
    const fitRef = useRef<(() => void) | null>(null);
    const hasAutoRun = useRef(false);
    const runBuildRef = useRef<() => void>(() => {});

    const stepsRef = useRef(steps);
    stepsRef.current = steps;
    const stepIndexRef = useRef(stepIndex);
    stepIndexRef.current = stepIndex;
    let [insertValue, setInsertValue] = useState("");
    let [deleteValue, setDeleteValue] = useState("");
    const isMobile = useIsMobile();
    const [activeTab, setActiveTab] = useState<'code' | 'cases'>('code');
    const [viewportVh, setViewportVh] = useState(60);
    const viewportVhRef = useRef(60);
    const splitHandleRef = useRef<HTMLDivElement | null>(null);
    const splitDragRef = useRef<{ startY: number; startVh: number } | null>(null);
    const [demoMode, setDemoMode] = useState(false);
    const demoModeRef = useRef(false);
    demoModeRef.current = demoMode;
    const demoPhaseRef = useRef<'insert' | 'delete'>('insert');
    const demoIdxRef = useRef(0);

    // ── Annotation state ─────────────────────────────────────────────

    let [defaultAnnotationEntries, setDefaultAnnotationEntries] = useState<AnnotationEntry[]>([]);
    let [annotationEntries, setAnnotationEntries] = useState<AnnotationEntry[]>([]);

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

    // ── Derived state ───────────────────────────────────────────────

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

    const watchEntries: WatchEntry[] = useMemo(() => {
        if (stepIndex <= 0 || steps.length === 0) return [];
        const snap = steps[stepIndex - 1]?.pointerSnapshot ?? {};
        return Object.entries(snap).map(([key, value]) => {
            const isRed = value.includes("RED");
            const isBlack = value.includes("BLACK");
            return {
                key,
                value,
                color: isRed ? "#ef4444" : isBlack ? "#94a3b8" : undefined,
            };
        });
    }, [stepIndex, steps]);

    const caseStack: CaseEntry[] = useMemo(() => {
        const result: CaseEntry[] = [];
        for (let i = 0; i < stepIndex && i < steps.length; i++) {
            if (steps[i].caseLabel) {
                result.push({ label: steps[i].caseLabel!, stepIndex: i + 1 });
            }
        }
        return result;
    }, [stepIndex, steps]);

    const caseStepIndices = useMemo(() => {
        const set = new Set<number>();
        steps.forEach((s, i) => { if (s.caseLabel) set.add(i + 1); });
        return set;
    }, [steps]);

    // ── Case parsing ────────────────────────────────────────────────

    function parseCase(raw: string): number[] | null {
        const trimmed = raw.trim();
        if (!trimmed.startsWith("ARRAY")) {
            setCaseErrorMessage("Case must start with ARRAY followed by space-separated integers.");
            return null;
        }
        const parts = trimmed.substring(5).trim().split(/\s+/).filter(Boolean);
        const nums: number[] = [];
        for (const p of parts) {
            const n = parseInt(p, 10);
            if (isNaN(n)) {
                setCaseErrorMessage(`Invalid integer: "${p}"`);
                return null;
            }
            nums.push(n);
        }
        return nums;
    }

    // ── Run (build tree from array) ─────────────────────────────────

    function runBuild() {
        const keys = parseCase(caseData);
        if (keys === null) return;

        const newTree = new RBTree();
        let sol: RBTSolutionBase;
        try {
            sol = buildRBTSolution(algoData, newTree, resolvedAnnotations, branchScopeMap);
        } catch (err) {
            const error = ensureError(err);
            setAlgoErrorMessage(error.message);
            return;
        }

        try {
            sol.bulkInsert(keys);
        } catch (err) {
            const error = ensureError(err);
            setAlgoErrorMessage(`Error during bulk insert: ${error.message}`);
            return;
        }

        setTree(newTree);
        setSolution(sol);
        setSteps([]);
        setStepIndex(0);
        setCaseErrorMessage("");
        setAlgoErrorMessage("");
        setRenderKey((k) => k + 1);
        toast.success(`Tree built with ${keys.length} keys`);
    }

    runBuildRef.current = runBuild;

    useEffect(() => {
        if (algoData && caseData && !hasAutoRun.current) {
            hasAutoRun.current = true;
            runBuildRef.current();
        }
    }, [algoData, caseData]);

    // ── Step management ─────────────────────────────────────────────

    function finishCurrentSteps() {
        if (!tree) return;
        const curSteps = stepsRef.current;
        let idx = stepIndexRef.current;
        if (curSteps.length === 0) return;
        while (idx < curSteps.length) {
            const step = curSteps[idx];
            if (step.command) step.command.execute(tree);
            idx++;
        }
        stepIndexRef.current = idx;
        setStepIndex(idx);
        setRenderKey((k) => k + 1);
    }

    const onStepChange = useCallback((newStep: number) => {
        if (!tree) return;
        const curSteps = stepsRef.current;
        const startIdx = stepIndexRef.current;
        let idx = startIdx;
        if (curSteps.length === 0) return;
        const maxIter = curSteps.length + 1;
        let iter = 0;
        while (newStep > idx && idx < curSteps.length && iter++ < maxIter) {
            const step = curSteps[idx];
            if (step.command) step.command.execute(tree);
            idx++;
        }
        while (newStep < idx && idx > 0 && iter++ < maxIter) {
            idx--;
            const step = curSteps[idx];
            if (step.command) step.command.revert(tree);
        }
        stepIndexRef.current = idx;
        if (idx !== startIdx) {
            setStepIndex(idx);
            setRenderKey((k) => k + 1);
        }
    }, [tree]);

    // ── Insert / Delete operations ──────────────────────────────────

    function handleInsert() {
        const key = parseInt(insertValue, 10);
        if (isNaN(key)) { toast.error("Enter a valid integer for insert."); return; }
        if (!tree || !solution) { toast.error("Build the tree first (Run)."); return; }
        finishCurrentSteps();

        try {
            const newSteps = solution.getInsertSteps(key);
            setSteps(newSteps);
            setStepIndex(0);
            setRenderKey((k) => k + 1);
            setPlaying(true);
        } catch (err) {
            const error = ensureError(err);
            toast.error(`Insert error: ${error.message}`);
        }
    }

    function handleDelete() {
        const key = parseInt(deleteValue, 10);
        if (isNaN(key)) { toast.error("Enter a valid integer for delete."); return; }
        if (!tree || !solution) { toast.error("Build the tree first (Run)."); return; }
        finishCurrentSteps();

        try {
            const newSteps = solution.getDeleteSteps(key);
            setSteps(newSteps);
            setStepIndex(0);
            setRenderKey((k) => k + 1);
            setPlaying(true);
        } catch (err) {
            const error = ensureError(err);
            toast.error(`Delete error: ${error.message}`);
        }
    }

    const handleCaseJump = useCallback((stepIdx: number) => {
        setPlaying(false);
        onStepChange(stepIdx);
    }, [onStepChange]);

    // ── Callbacks ───────────────────────────────────────────────────

    const onCaseDataChanged = useCallback((raw: string) => {
        setCaseData(raw);
        setCaseErrorMessage("");
    }, []);

    const onAlgoDataChanged = useCallback((raw: string) => {
        setAlgoData(raw);
        setAlgoErrorMessage("");
    }, []);

    // ── Mobile split-handle drag ─────────────────────────────────────
    useEffect(() => {
        if (!isMobile) return;
        const handle = splitHandleRef.current;
        if (!handle) return;
        const onTouchStart = (e: TouchEvent) => {
            splitDragRef.current = { startY: e.touches[0].clientY, startVh: viewportVhRef.current };
        };
        const onTouchMove = (e: TouchEvent) => {
            if (!splitDragRef.current) return;
            e.preventDefault();
            const dy = e.touches[0].clientY - splitDragRef.current.startY;
            const newVh = Math.max(30, Math.min(82, splitDragRef.current.startVh + (dy / window.innerHeight) * 100));
            setViewportVh(newVh);
            viewportVhRef.current = newVh;
        };
        const onTouchEnd = () => { splitDragRef.current = null; };
        handle.addEventListener('touchstart', onTouchStart, { passive: true });
        handle.addEventListener('touchmove', onTouchMove, { passive: false });
        handle.addEventListener('touchend', onTouchEnd, { passive: true });
        return () => {
            handle.removeEventListener('touchstart', onTouchStart);
            handle.removeEventListener('touchmove', onTouchMove);
            handle.removeEventListener('touchend', onTouchEnd);
        };
    }, [isMobile]);

    // ── Demo mode auto-cycle ─────────────────────────────────────────
    useEffect(() => {
        if (!demoMode || playing || !tree || !solution) return;

        const sol = solution;
        const timer = setTimeout(() => {
            if (!demoModeRef.current) return;

            finishCurrentSteps();

            try {
                let newSteps: RBTStep[];
                if (demoPhaseRef.current === 'insert') {
                    const key = DEMO_KEYS[demoIdxRef.current];
                    newSteps = sol.getInsertSteps(key);
                    demoIdxRef.current++;
                    if (demoIdxRef.current >= DEMO_KEYS.length) {
                        demoIdxRef.current = 0;
                        demoPhaseRef.current = 'delete';
                    }
                } else {
                    const key = DEMO_KEYS[demoIdxRef.current];
                    newSteps = sol.getDeleteSteps(key);
                    demoIdxRef.current++;
                    if (demoIdxRef.current >= DEMO_KEYS.length) {
                        demoIdxRef.current = 0;
                        demoPhaseRef.current = 'insert';
                    }
                }
                setSteps(newSteps);
                setStepIndex(0);
                setRenderKey((k) => k + 1);
                setPlaying(true);
            } catch {
                // Key not insertable/deletable — advance cycle index and retry next tick
                demoIdxRef.current++;
                if (demoIdxRef.current >= DEMO_KEYS.length) {
                    demoIdxRef.current = 0;
                    demoPhaseRef.current = demoPhaseRef.current === 'insert' ? 'delete' : 'insert';
                }
            }
        }, 1000);

        return () => clearTimeout(timer);
    }, [demoMode, playing, tree, solution]);

    // ── Render ──────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-dvh overflow-hidden">
            <Header selectedPage="redblacktree" />

            {isMobile ? (
                /* ── MOBILE: viewport top, tabbed editors bottom ── */
                <div className="flex flex-col flex-grow min-h-0">

                    {/* Viewport — height driven by viewportVh state (default 60dvh).
                        shrink-0 prevents flex from collapsing it when the editor expands. */}
                    <div className="relative overflow-hidden shrink-0" style={{ height: `${viewportVh}dvh` }}>
                        <RBTView
                            tree={tree}
                            renderKey={renderKey}
                            currentStep={stepIndex > 0 ? steps[stepIndex - 1] : undefined}
                            currentStepIndex={stepIndex}
                            onFitRef={fitRef}
                        />

                        {/* Single overlay column — pointer-events-none so touch passes through
                            to the SVG in the spacer zone; interactive children opt back in. */}
                        <div className="absolute inset-0 z-20 flex flex-col pointer-events-none">

                            {/* Top row: Play/Pause (left)  +  Case Tracker (right) */}
                            <div className="flex flex-row justify-between items-start p-3 gap-2 shrink-0">
                                <div className="flex flex-col gap-2 pointer-events-auto">
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
                                <div className="pointer-events-auto">
                                    <CaseTracker cases={caseStack} onJumpToStep={handleCaseJump} />
                                </div>
                            </div>

                            {/* Annotation: flows naturally below top row — no overlap possible */}
                            {question ? (
                                <div className="px-2 shrink-0 pointer-events-auto">
                                    <div className="px-4 py-2 rounded-lg bg-primary-950/80 backdrop-blur-sm border border-secondary-800 text-sm">
                                        <div className="text-white/60 italic">Q: {question}</div>
                                        {answer && <div className="text-white font-semibold mt-0.5">A: {answer}</div>}
                                    </div>
                                </div>
                            ) : explanation ? (
                                <div className="px-2 shrink-0 pointer-events-auto">
                                    <div className="px-4 py-2 rounded-lg bg-primary-950/80 backdrop-blur-sm border border-secondary-800 text-white text-sm">
                                        {explanation}
                                    </div>
                                </div>
                            ) : null}

                            {/* Spacer — tree is visible and touch-pannable here */}
                            <div className="flex-grow" />

                            {/* Bottom controls */}
                            <div className="pointer-events-auto p-3 bg-primary-950/80 backdrop-blur-sm border-t border-secondary-800 shrink-0">
                                {/* Insert / Delete */}
                                <div className="flex flex-row items-center gap-2 flex-wrap">
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            value={insertValue}
                                            onChange={(e) => setInsertValue(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === "Enter") handleInsert(); }}
                                            placeholder="key"
                                            className="w-20 px-2 py-1 rounded bg-primary-50 dark:bg-primary-950 border border-secondary-200 dark:border-secondary-800 text-sm"
                                        />
                                        <button onClick={handleInsert} className={`${buttonStyleClassNames} px-3 py-1 rounded text-sm`}>
                                            Insert
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            value={deleteValue}
                                            onChange={(e) => setDeleteValue(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === "Enter") handleDelete(); }}
                                            placeholder="key"
                                            className="w-20 px-2 py-1 rounded bg-primary-50 dark:bg-primary-950 border border-secondary-200 dark:border-secondary-800 text-sm"
                                        />
                                        <button onClick={handleDelete} className={`${buttonStyleClassNames} px-3 py-1 rounded text-sm`}>
                                            Delete
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setDemoMode(d => !d)}
                                        className={`px-3 py-1 rounded text-sm border transition-colors cursor-pointer ${
                                            demoMode
                                                ? 'bg-secondary/20 border-secondary text-secondary dark:bg-secondary-400/20 dark:border-secondary-400 dark:text-secondary-300'
                                                : `${buttonStyleClassNames} border-secondary-200 dark:border-secondary-800`
                                        }`}
                                    >
                                        {demoMode ? 'Demo: ON' : 'Demo'}
                                    </button>
                                </div>

                                {/* Stepper — WatchPanel hidden on mobile (too narrow) */}
                                <div className="mt-2">
                                    <DebugStepper
                                        step={stepIndex}
                                        maxSteps={steps.length}
                                        playing={playing}
                                        onPlayingChange={setPlaying}
                                        onStepChange={onStepChange}
                                        caseSteps={caseStepIndices}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Split handle — drag to resize the viewport/editor split */}
                    <div
                        ref={splitHandleRef}
                        className="flex items-center justify-center h-4 shrink-0 bg-secondary-100 dark:bg-secondary-900 touch-none cursor-row-resize"
                    >
                        <div className="w-10 h-1 rounded-full bg-secondary-400 dark:bg-secondary-600" />
                    </div>

                    {/* Tab bar + Run button */}
                    <div className="flex flex-row border-b border-secondary-200 dark:border-secondary-800 bg-secondary-100 dark:bg-secondary-900 shrink-0">
                        <button
                            onClick={() => setActiveTab('code')}
                            className={`flex-1 py-2 text-sm font-medium transition-colors ${
                                activeTab === 'code'
                                    ? 'text-secondary dark:text-secondary-200 border-b-2 border-secondary dark:border-secondary-200'
                                    : 'text-secondary/60 dark:text-secondary-200/60'
                            }`}
                        >
                            Code
                        </button>
                        <button
                            onClick={() => setActiveTab('cases')}
                            className={`flex-1 py-2 text-sm font-medium transition-colors ${
                                activeTab === 'cases'
                                    ? 'text-secondary dark:text-secondary-200 border-b-2 border-secondary dark:border-secondary-200'
                                    : 'text-secondary/60 dark:text-secondary-200/60'
                            }`}
                        >
                            Cases
                        </button>
                        {/* Run button — mobile only, lets the user re-run from either tab */}
                        <button
                            onClick={runBuild}
                            className={`${buttonStyleClassNames} px-4 py-2 text-sm font-medium shrink-0 border-l border-secondary-200 dark:border-secondary-800`}
                        >
                            ▶ Run
                        </button>
                    </div>

                    {/* Active editor — fills remaining height */}
                    <div className="flex-grow min-h-0 flex flex-col overflow-hidden">
                        {activeTab === 'code' ? (
                            <SolutionEditor
                                problem="red-black-tree"
                                hideToolbar={true}
                                onSolutionChanged={onAlgoDataChanged}
                                onAnnotationsLoaded={onAnnotationsLoaded}
                                runner={runBuild}
                                errorMessage={algoErrorMessage}
                                activeLine={activeLine}
                                annotations={resolvedAnnotations}
                                defaultAnnotations={defaultResolvedAnnotations}
                                onAnnotationEdit={onAnnotationEdit}
                            />
                        ) : (
                            <CaseEditor
                                problem="red-black-tree"
                                caseData={caseData}
                                onCaseDataChanged={onCaseDataChanged}
                                errorMessage={caseErrorMessage}
                            />
                        )}
                    </div>
                </div>

            ) : (
                /* ── DESKTOP: existing layout, unchanged ── */
                <div className="flex flex-row items-stretch flex-grow min-h-0">
                    {/* Left panel: editors */}
                    <div className="flex flex-col justify-stretch min-h-0" style={{ width: `${leftWidth}px` }}>
                        <SolutionEditor
                            solutionHeight={solHeight}
                            problem="red-black-tree"
                            onSolutionChanged={onAlgoDataChanged}
                            onAnnotationsLoaded={onAnnotationsLoaded}
                            runner={runBuild}
                            errorMessage={algoErrorMessage}
                            activeLine={activeLine}
                            annotations={resolvedAnnotations}
                            defaultAnnotations={defaultResolvedAnnotations}
                            onAnnotationEdit={onAnnotationEdit}
                        />
                        <HDivider onWidthChangeRequest={(v) => setSolHeight(solHeight + v)} />
                        <CaseEditor
                            problem="red-black-tree"
                            caseData={caseData}
                            onCaseDataChanged={onCaseDataChanged}
                            errorMessage={caseErrorMessage}
                        />
                    </div>
                    <VDivider onWidthChangeRequest={(v) => setLeftWidth(leftWidth + v)} />

                    {/* Right panel: viewport */}
                    <div className="relative flex-grow m-2 overflow-hidden min-w-0">
                        {/* Tree visualization fills entire panel */}
                        <RBTView
                            tree={tree}
                            renderKey={renderKey}
                            currentStep={stepIndex > 0 ? steps[stepIndex - 1] : undefined}
                            currentStepIndex={stepIndex}
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

                        {/* Top-center: Annotation */}
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

                        {/* Top-right: Case Tracker */}
                        <div className="absolute top-3 right-3 z-20">
                            <CaseTracker cases={caseStack} onJumpToStep={handleCaseJump} />
                        </div>

                        {/* Controls overlay at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
                            <div className="pointer-events-auto p-3 bg-primary-950/80 backdrop-blur-sm border-t border-secondary-800">
                                {/* Insert / Delete controls */}
                                <div className="flex flex-row items-center gap-2 flex-wrap">
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            value={insertValue}
                                            onChange={(e) => setInsertValue(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === "Enter") handleInsert(); }}
                                            placeholder="key"
                                            className="w-20 px-2 py-1 rounded bg-primary-50 dark:bg-primary-950 border border-secondary-200 dark:border-secondary-800 text-sm"
                                        />
                                        <button onClick={handleInsert} className={`${buttonStyleClassNames} px-3 py-1 rounded text-sm`}>
                                            Insert
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            value={deleteValue}
                                            onChange={(e) => setDeleteValue(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === "Enter") handleDelete(); }}
                                            placeholder="key"
                                            className="w-20 px-2 py-1 rounded bg-primary-50 dark:bg-primary-950 border border-secondary-200 dark:border-secondary-800 text-sm"
                                        />
                                        <button onClick={handleDelete} className={`${buttonStyleClassNames} px-3 py-1 rounded text-sm`}>
                                            Delete
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setDemoMode(d => !d)}
                                        className={`px-3 py-1 rounded text-sm border transition-colors cursor-pointer ${
                                            demoMode
                                                ? 'bg-secondary/20 border-secondary text-secondary dark:bg-secondary-400/20 dark:border-secondary-400 dark:text-secondary-300'
                                                : `${buttonStyleClassNames} border-secondary-200 dark:border-secondary-800`
                                        }`}
                                    >
                                        {demoMode ? 'Demo: ON' : 'Demo'}
                                    </button>
                                </div>

                                {/* Watch + Stepper */}
                                <div className="flex flex-row gap-2 mt-2 items-start flex-wrap xl:flex-nowrap">
                                    <div className="w-48 shrink-0">
                                        <WatchPanel entries={watchEntries} />
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <DebugStepper
                                            step={stepIndex}
                                            maxSteps={steps.length}
                                            playing={playing}
                                            onPlayingChange={setPlaying}
                                            onStepChange={onStepChange}
                                            caseSteps={caseStepIndices}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
