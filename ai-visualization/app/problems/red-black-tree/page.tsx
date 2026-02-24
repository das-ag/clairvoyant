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

export default function RedBlackTreePage() {
    let [tree, setTree] = useState<RBTree | null>(null);
    let [solution, setSolution] = useState<RBTSolutionBase | null>(null);
    let [leftWidth, setLeftWidth] = useState(480);
    let [solHeight, setSolHeight] = useState(300);
    let [caseErrorMessage, setCaseErrorMessage] = useState("");
    let [algoErrorMessage, setAlgoErrorMessage] = useState("");
    let [caseData, setCaseData] = useState("");
    let [algoData, setAlgoData] = useState("");
    let [steps, setSteps] = useState<RBTStep[]>([]);
    let [stepIndex, setStepIndex] = useState(0);
    let [renderKey, setRenderKey] = useState(0);

    const stepsRef = useRef(steps);
    stepsRef.current = steps;
    const stepIndexRef = useRef(stepIndex);
    stepIndexRef.current = stepIndex;
    let [insertValue, setInsertValue] = useState("");
    let [deleteValue, setDeleteValue] = useState("");

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
        let idx = stepIndexRef.current;
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
        setStepIndex(idx);
        setRenderKey((k) => k + 1);
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
        } catch (err) {
            const error = ensureError(err);
            toast.error(`Delete error: ${error.message}`);
        }
    }

    // ── Callbacks ───────────────────────────────────────────────────

    const onCaseDataChanged = useCallback((raw: string) => {
        setCaseData(raw);
        setCaseErrorMessage("");
    }, []);

    const onAlgoDataChanged = useCallback((raw: string) => {
        setAlgoData(raw);
        setAlgoErrorMessage("");
    }, []);

    // ── Render ──────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-dvh overflow-hidden">
            <Header selectedPage="redblacktree" />
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
                    <RBTView tree={tree} renderKey={renderKey} currentStep={stepIndex > 0 ? steps[stepIndex - 1] : undefined} />

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
                                        explanation={explanation}
                                        question={question}
                                        answer={answer}
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
