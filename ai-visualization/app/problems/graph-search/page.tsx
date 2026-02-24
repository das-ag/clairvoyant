"use client"

import Header from "@/app/components/header";
import GraphView from "./components/graphView";
import SolutionEditor from "@/app/components/editors/solutionEditor";
import CaseEditor from "@/app/components/editors/problemEditor";
import { Graph, GraphContext, GridGraph } from "@/lib/graphs/graph";
import { GraphSearchResult, GraphSearchSolution, buildGraphSearchSolution } from "@/lib/graphs/graphsolution";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ensureError } from "@/lib/errors/error";
import { HDivider, VDivider } from "@/app/components/divider";
import { toast } from "react-toastify";

const INIT_CONTEXT = new GraphContext(null);

export default function GraphSearchPage() {
    let [ctx, setCtx] = useState(INIT_CONTEXT);
    let [graphData, setGraphData] = useState("");
    let [leftWidth, setLeftWidth] = useState(480);
    let [solHeight, setSolHeight] = useState(300);
    let [graphErrorMessage, setGraphErrorMessage] = useState("");
    let [algoErrorMessage, setAlgoErrorMessage] = useState("");
    let [debugData, setDebugData] = useState<any>(null);
    let [solutionData, setSolutionData] = useState("");
    let [graphSteps, setGraphSteps] = useState<GraphSearchResult[]>([]);
    let [graphStepIndex, setGraphStepIndex] = useState(0);
    
    const activeLine = useMemo(() => {
        if (graphStepIndex <= 0 || graphSteps.length === 0) return null;
        return graphSteps[graphStepIndex - 1]?.sourceLine ?? null;
    }, [graphStepIndex, graphSteps]);

    const explanation = useMemo(() => {
        if (graphStepIndex <= 0 || graphSteps.length === 0) return undefined;
        const val = graphSteps[graphStepIndex - 1]?.debugValue;
        return val != null ? String(val) : undefined;
    }, [graphStepIndex, graphSteps]);

    function updateSolutionSteps(solverData: string, graphContext: GraphContext) {
        const graph = graphContext.graph;
        if (!solverData || !graph) {
            return {success: false, fault: "graph", message: "Invalid solver or graph"};
        }

        if (!graph.startNode || !graph.endNode) {
            return {success: false, fault: "graph", message: "Invalid start or end node"};
        }

        try {
            let sol = buildGraphSearchSolution(solverData, graph);
            let steps = sol.getSolutionSteps(graph.startNode, graph.endNode);
            setGraphSteps(steps);
            setGraphStepIndex(0);
            return {success: true, message: "Solution steps updated"};
        } catch (err) {
            let error = ensureError(err);
            return {success: false, fault: "solver", message: `${error.stack ?? error.message}`};
        }
    };

    function runAlgo() {
        let result = updateSolutionSteps(solutionData, ctx);
        if (result.success) {
            toast.success(result.message);
            setGraphErrorMessage("");
            setAlgoErrorMessage("");
            resetStepData();
            return;
        };
    
        if (result.fault === "graph") {
            setGraphErrorMessage(result.message);
        } else if (result.fault === "solver") {
            setAlgoErrorMessage(result.message);
        } else {
            toast.error(result.message);
        }
    }

    const onGraphDataChanged = useCallback((rawData: string) => {
        setGraphData(rawData);
        try {
            setCtx(new GraphContext(Graph.fromNotation(rawData)));
            setGraphErrorMessage("");
        }
        catch (err) {
            let error = ensureError(err);
            setGraphErrorMessage(error.message);
            return;
        }
    }, []);

    const onSolutionDataChanged = useCallback((rawData: string) => {
        setSolutionData(rawData);
        setAlgoErrorMessage("");
    },[]);
    
    const handleStep = useCallback((steps: GraphSearchResult[], stepIndex: number) => {
        const graph = ctx.graph;
        if (!graph) {
            throw new Error("Graph cannot be null at step handling.");
        }
        if (stepIndex >= steps.length) {
            return steps.length;
        }
        let step = steps[stepIndex];
        if (step.command) {
            step.command.execute(ctx);
        }
        setDebugData(step.debugValue);
        setGraphStepIndex(stepIndex + 1);
        return stepIndex + 1;
    },[ctx]);

    const handleBackStep = useCallback((steps: GraphSearchResult[], stepIndex: number) => { 
        const graph = ctx.graph;
        if (!graph) {
            throw new Error("Graph cannot be null at step handling.");
        }
        if (stepIndex <= 0) {
            return 0;
        }
        let step = steps[stepIndex - 1];
        if (step.command) {
            step.command.revert(ctx);
        }
        setDebugData(stepIndex >= 2 ? steps[stepIndex - 2].debugValue : null);
        setGraphStepIndex(stepIndex - 1);
        return stepIndex - 1;
    },[ctx]);

    useEffect(() => {
        if (ctx.graph)
            setGraphData(ctx.graph?.stringify());
    }, [ctx.graph])
    
    const onStepRequested = useCallback((newStep: number) => {
        const graph = ctx.graph;
        if (!graph || !graph.startNode || !graph.endNode) {
            toast.error("Invalid graph. Please make sure the graph is valid.");
            return;
        }
        let steps = graphSteps;
        if (!graphSteps) {
            toast.error("No steps to step through. Please run the solver first.");           
        }

        let stepIndex = graphStepIndex;
        let maxCnt = 100;
        while (newStep > stepIndex) {
            stepIndex = handleStep(steps, stepIndex);
            if (maxCnt-- < 0) break;
        }
        while (newStep < stepIndex) {
            stepIndex = handleBackStep(steps, stepIndex);
            if (maxCnt-- < 0) break;
        }
    },[ctx, graphStepIndex, graphSteps, handleBackStep, handleStep]);
    
    const resetStepData = useCallback(() => {
        setGraphStepIndex(0);
        setDebugData(null);
        while (ctx.length > 1) {
            ctx.pop();
        }
        ctx.graph?.resetStepData();
    }, [ctx])

    const handleGraphBackwardsData = useCallback((graph: Graph, visual: boolean) => {
        if (!visual) {
            setGraphSteps([]);
            setGraphStepIndex(0);
            setDebugData(null);
            setCtx(new GraphContext(graph));
        } else {
            setCtx((v) => {
                v.update(graph);
                return v;
            });            
        }
        setCtx(new GraphContext(graph));
        setGraphData(graph.stringify());
    }, []);

    // command execution
    let executed = ctx.commandHandler.executeToCurrent(ctx);
    if (executed && executed.length > 0) {
        for (let cmd of executed) console.log(`Executed command: ${cmd.name}`);
        setGraphData(ctx.graph!.stringify());
    }

    return (
        <div className="flex flex-col h-dvh">
            <Header selectedPage="graphsearch"></Header>
            <div className="flex flex-row items-stretch flex-grow">
                <div className="flex flex-col justify-stretch" style={{"width": `${leftWidth}px`}}>
                    <SolutionEditor solutionHeight={solHeight} problem={"graph-search"} onSolutionChanged={onSolutionDataChanged} runner={runAlgo} errorMessage={algoErrorMessage} activeLine={activeLine}></SolutionEditor>
                    <HDivider onWidthChangeRequest={function (v: number): void {
                        setSolHeight(solHeight + v);
                    } }></HDivider>
                    <CaseEditor problem={"graph-search"} caseData={graphData} onCaseDataChanged={onGraphDataChanged} errorMessage={graphErrorMessage}></CaseEditor>
                </div>
                <VDivider onWidthChangeRequest={(v => {
                    setLeftWidth(leftWidth + v);
                })}></VDivider>
                <div className="p-3 m-2 flex-grow">
                    <GraphView graph={ctx.graph} stepHandler={onStepRequested} onGraphChanged={handleGraphBackwardsData}
                    totalSteps={graphSteps.length} logData={debugData} stepIndex={graphStepIndex} explanation={explanation}></GraphView>
                </div>
            </div>
        </div>
    )
}
