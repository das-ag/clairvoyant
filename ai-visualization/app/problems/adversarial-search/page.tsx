"use client"

import Header from "@/app/components/header";
import TreeView from "./components/treeView";
import EditorTabs from "@/app/components/editors/editorTabs";
import OptionsPanel, { OptionsSection, OptionRow } from "@/app/components/editors/optionsPanel";
import { GenericGraph, Graph, GraphEdgeSimple, GraphNode, GridGraph } from "@/lib/graphs/graph";
import { GraphSearchResult, GraphSearchSolution, buildGraphSearchSolution } from "@/lib/graphs/graphsolution"; // Import the missing class
import { useCallback, useEffect, useRef, useState } from "react";
import { ensureError } from "@/lib/errors/error";
import { VDivider } from "@/app/components/divider";
import { toast } from "react-toastify";
import Canvas from "@/app/components/graphics/canvas";
import { AdversarialAlgorithmStep, AdversarialExpansion, AdversarialSearchBuildError, AdversarialSearchSolution, buildAdversarialSolution } from "@/lib/adversarial/adversarialSolution";
import { AdversarialSearchCase, AdversarialSearchPosition } from "@/lib/adversarial/adversarialCase";
import { PropertyInspector } from "@/app/components/editors/propertyEditor";

import "./adversarial-search.css";
import { ItemProperty } from "@/lib/utils/properties";
import DynamicLabel from "@/app/components/text/dynamicLabel";
import PlayControls from "@/app/components/controls/playControls";
import { GAME_CANVAS_X, GAME_CANVAS_Y, buttonStyleClassNames } from "@/lib/statics/styleConstants";

const defaultDraw = (ctx: CanvasRenderingContext2D) => {}
const MAX_EXPANSION_STEP_SIZE = 100;
const MAX_ALGORITHM_STEP_SIZE = 100;
const TICK_INTERVAL_MS = 25; // 40 times per second
const TICK_LOGIC_TIMEOUT_MS = 20;
// configured speed ~4000 iterations per second
const GRAPH_UPDATE_INTERVAL_MS = 1500

type ExpansionGenerator = Generator<AdversarialExpansion, void>;
type AlgorithmGenerator = Generator<AdversarialAlgorithmStep>;

interface TickData {}
interface ExternalGraphData {
    dirty: boolean
}

export default function GraphSearchPage() {
    let [leftWidth, setLeftWidth] = useState(480);
    let [caseErrorMessage, setCaseErrorMessage] = useState("");
    let [algoErrorMessage, setAlgoErrorMessage] = useState("");
    let [debugData, setDebugData] = useState<any>(null);
    let [algoData, setAlgoData] = useState("");
    let [caseData, setCaseData] = useState("");
    let [graphRenderKey, setGraphRenderKey] = useState(0);
    let [canvasRenderKey, setCanvasRenderKey] = useState(0);
    
    let [game, setGame] = useState<AdversarialSearchCase | null>(null);
    let [solver, setSolver] = useState<AdversarialSearchSolution | null>(null);
    let [expansionGenerator, setExpansionGenerator] = useState<ExpansionGenerator | null>(null);
    let [algorithmGenerator, setAlgorithmGenerator] = useState<AlgorithmGenerator | null>(null);
    let [tickData, setTickData] = useState<TickData>({});
    let [externalGraphData, setExternalGraphData] = useState<ExternalGraphData>({
        "dirty": false
    })
    let [expansionPlaying, setExpansionPlaying] = useState<boolean>(false);
    let [algorithmPlaying, setAlgorithmPlaying] = useState<boolean>(false);
    let [activeLine, setActiveLine] = useState<number | null>(null);

    let [shownPosition, setShownPosition] = useState<AdversarialSearchPosition | null>(null);

    // Draft player colors for the Options tab (applied on Apply)
    let [draftPlayer1Color, setDraftPlayer1Color] = useState<string>("");
    let [draftPlayer2Color, setDraftPlayer2Color] = useState<string>("");

    // property management
    let [gameProperties, setGameProperties] = useState<ItemProperty[]>([])

    // ticking
    let doTick = useCallback(() => {
        if (!solver || !game) return;
        //console.log(`running tick with budgets (${solver.expansionBudget}, ${solver.algorithmBudget})`)
        let tickStartTime = Date.now();

        // handle nullable fields and reset the generator/initial position if they're unset
        let internalInitialPosition: AdversarialSearchPosition | undefined;

        let internalExpansionGenerator = expansionGenerator;
        if (!internalExpansionGenerator) {
            internalInitialPosition = game.getInitialPosition();
            internalExpansionGenerator = solver.runExpansion(internalInitialPosition)
            setExpansionGenerator(internalExpansionGenerator);
        }

        const minExpansionBudgetInIteration = Math.max(0, solver.expansionBudget - MAX_EXPANSION_STEP_SIZE);
        let anyExpansionsRun = false;
        while (solver.expansionBudget > minExpansionBudgetInIteration) {
            if (Date.now() - tickStartTime > TICK_LOGIC_TIMEOUT_MS) {
                // abort immediately
                return;
            }

            let action : IteratorResult<AdversarialExpansion>;
            try {
                action = internalExpansionGenerator.next();
            } catch (err) {
                let error = ensureError(err);
                toast.error(error.stack);
                externalGraphData.dirty = true;
                break;
            }

            if (action.done) {
                toast.success("Expansion complete");
                solver.expansionBudget = 0;
                externalGraphData.dirty = true;
                break;
            } else {
                anyExpansionsRun = true;  
                externalGraphData.dirty = true;
            }
        }

        setExpansionPlaying(solver.expansionBudget > 0);

        // if any expansions happened and there's any progress on the algorithm, reset and do not run any algorithm steps
        if (anyExpansionsRun && algorithmGenerator) {
            solver.resetAlgorithmState();
            setAlgorithmGenerator(null);
            return;
        }
        // do not keep running if no algorithm budget exists
        if (solver.algorithmBudget === 0) return;

        // handle nullable fields and reset the generator/initial position if they're unset
        let internalAlgorithmGenerator = algorithmGenerator;
        if (!internalAlgorithmGenerator) {
            if (internalInitialPosition === undefined) internalInitialPosition = game.getInitialPosition();
            internalAlgorithmGenerator = solver.runAlgorithm(internalInitialPosition);
            setAlgorithmGenerator(internalAlgorithmGenerator);
        }

        const minAlgorithmBudgetInIteration = Math.max(0, solver.expansionBudget - MAX_ALGORITHM_STEP_SIZE);
        while (solver.algorithmBudget > minAlgorithmBudgetInIteration) {
            if (Date.now() - tickStartTime > TICK_LOGIC_TIMEOUT_MS) {
                // abort immediately
                return;
            }

            let result : IteratorResult<AdversarialAlgorithmStep>;
            try {
                result = internalAlgorithmGenerator!.next();
            } catch (err) {
                let error = ensureError(err);
                externalGraphData.dirty = true;
                toast.error(error.stack);
                break;
            }

            if (result.done) {
                toast.success("Algorithm complete");
                externalGraphData.dirty = true;
                solver.algorithmBudget = 0;
                setActiveLine(null);
                break;
            } else {
                externalGraphData.dirty = true;
                if (result.value?.sourceLine != null) {
                    setActiveLine(result.value.sourceLine);
                }
            }
        }
        
        setAlgorithmPlaying(solver.algorithmBudget > 0);
    }, [game, solver, expansionGenerator, algorithmGenerator, externalGraphData])

    useEffect(() => {
        const intervalId = setInterval(doTick, TICK_INTERVAL_MS);
        console.log(`Updated tick function, interval ID = ${intervalId}`);
        return () => {clearInterval(intervalId);}
    }, [doTick]);

    // DYNAMIC GRAPH UPDATES
    let updateGraph = useCallback(() => {
        if (!externalGraphData.dirty) return;
        setGraphRenderKey(k => k + 1);
        externalGraphData.dirty = false;
    }, [externalGraphData])

    useEffect(() => {
        const intervalId = setInterval(updateGraph, GRAPH_UPDATE_INTERVAL_MS);
        return () => {clearInterval(intervalId);}
    }, [updateGraph])

    function runGameSetup() {
        try {
            let [solver, game] = buildAdversarialSolution(algoData, caseData);
            setSolver(solver);
            setGame(game);
            initializeGame(game, solver);
            setGameProperties(game.properties);
            setExpansionGenerator(null);
            setAlgorithmGenerator(null);
            setCaseErrorMessage("");
            setAlgoErrorMessage("");
        } catch (err) {
            let error = ensureError(err);
            if (error instanceof AdversarialSearchBuildError) {
                let fault = error.fault;
                if (fault === "solver") {
                    setAlgoErrorMessage(error.stack ?? error.message);
                } else if (fault === "case") {
                    setCaseErrorMessage(error.stack ?? error.message);
                }
            }
            else 
            {
                setAlgoErrorMessage(`Runtime error: ${error.stack}`);
            }
        }
    }

    function initializeGame(game: AdversarialSearchCase, solver: AdversarialSearchSolution) {
        setGraphRenderKey(0);
        setShownPosition(solver.gameTree.startNode!.data.position);
    }

    type RunningParameters = {expansionBudget?: number, algorithmBudget?: number};
    let setRunningParameters = useCallback((parameters: RunningParameters) => {
        if (!solver || !game) {
            toast.error("This requires the solver and game to be properly loaded.");
            return;
        }
        if (parameters.expansionBudget !== undefined) solver.expansionBudget = parameters.expansionBudget;
        if (parameters.algorithmBudget !== undefined) solver.algorithmBudget = parameters.algorithmBudget;
        setExpansionPlaying(solver.expansionBudget > 0);
        setAlgorithmPlaying(solver.algorithmBudget > 0);
    }, [solver, game]);
    let modifyRunningParameters = useCallback((parameters: RunningParameters) => {
        if (!solver || !game) {
            toast.error("This requires the solver and game to be properly loaded.");
            return;
        }
        let alteredParams: RunningParameters = {}
        for (let key of Object.keys(parameters)) {
            let k = key as keyof RunningParameters;
            alteredParams[k] = parameters[k]! + solver[k];
        }
        setRunningParameters(alteredParams);
    }, [solver, game, setRunningParameters])

    const onGamePropertyChange = useCallback((property: string, oldValue: any, newValue: any) => {
        game?.setProp(property, newValue);
        setGameProperties(game?.properties ?? []);
        setCanvasRenderKey(n => n + 1);
    }, [game]);

    // Keep the Options-tab draft colors in sync with whichever case is loaded.
    useEffect(() => {
        const p1 = gameProperties.find(p => p.name === "player_1_color")?.value;
        const p2 = gameProperties.find(p => p.name === "player_2_color")?.value;
        if (typeof p1 === "string") setDraftPlayer1Color(p1);
        if (typeof p2 === "string") setDraftPlayer2Color(p2);
    }, [gameProperties]);

    const applyPlayerColors = useCallback(() => {
        if (!game) {
            toast.error("Load a case first.");
            return;
        }
        game.setProp("player_1_color", draftPlayer1Color);
        game.setProp("player_2_color", draftPlayer2Color);
        setGameProperties(game.properties);
        setCanvasRenderKey(n => n + 1);
    }, [game, draftPlayer1Color, draftPlayer2Color]);

    const hasPlayerColorProps = gameProperties.some(p => p.name === "player_1_color" || p.name === "player_2_color");
    const onPositionPropertyChange = useCallback((property: string, oldValue: any, newValue: any) => {
        if (property === "__expand") {
            console.log(`Expanding ${shownPosition?.id}`);
            if (shownPosition) solver?.expand(shownPosition);
            setGraphRenderKey(n => n + 1);
            return;
        }
        shownPosition?.setProp(property, newValue);
    }, [shownPosition, solver]);

    const onCaseDataChanged = useCallback((rawData: string) => {
        setCaseData(rawData);
        setCaseErrorMessage("");
        // For this problem, this is code that runs with the algorithm
    }, []);

    const onAlgoDataChanged = useCallback((rawData: string) => {
        setAlgoData(rawData);
        setAlgoErrorMessage("");
    },[]);

    const onNodeSelected = useCallback((node: GraphNode | null) => {
        let pos: AdversarialSearchPosition = node?.data.position;
        setShownPosition(pos ?? null);
    },[]);

    const positionRender = useCallback((ctx: CanvasRenderingContext2D) => {
        if (shownPosition) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            shownPosition.render(ctx);
        }
    }, [shownPosition]);

    let extendedProperties = shownPosition ? shownPosition.properties : [];
    let positionNode = solver?.gameTree.getNodeById(shownPosition?.id ?? "");
    if (shownPosition && positionNode) {
        let isPositionTerminal = shownPosition.isTerminal();
        extendedProperties.push(...[
            {name: "isTerminal", value: isPositionTerminal, type: "boolean", fixed: true, display: "Terminal?"},           
        ]);
        if (!isPositionTerminal) {
            extendedProperties.push(...[
                {name: "__expand", value: positionNode.data.expanded, type: "boolean", display: "Expand", trigger: true}
            ]);
        }
    }

    return (
        <div className="flex flex-col h-dvh overflow-hidden">
            <Header selectedPage="adversarialsearch"></Header>
            <div className="flex flex-row items-stretch flex-grow min-h-0">
                <div className="flex flex-col justify-stretch min-h-0" style={{"width": `${leftWidth}px`}}>
                    <EditorTabs
                        problem="adversarial-search"
                        runner={runGameSetup}
                        onSolutionChanged={onAlgoDataChanged}
                        algoErrorMessage={algoErrorMessage}
                        activeLine={activeLine}
                        caseData={caseData}
                        onCaseDataChanged={onCaseDataChanged}
                        caseErrorMessage={caseErrorMessage}
                        codeMode
                        options={
                            <OptionsPanel>
                                <OptionsSection title="Player colors">
                                    {hasPlayerColorProps ? (
                                        <>
                                            <OptionRow label="1st Player Color">
                                                <input
                                                    type="color"
                                                    value={draftPlayer1Color || "#000000"}
                                                    onChange={e => setDraftPlayer1Color(e.target.value)}
                                                    className="h-7 w-12 cursor-pointer rounded"
                                                />
                                            </OptionRow>
                                            <OptionRow label="2nd Player Color">
                                                <input
                                                    type="color"
                                                    value={draftPlayer2Color || "#000000"}
                                                    onChange={e => setDraftPlayer2Color(e.target.value)}
                                                    className="h-7 w-12 cursor-pointer rounded"
                                                />
                                            </OptionRow>
                                            <div className="flex flex-row justify-end pt-1">
                                                <button
                                                    onClick={applyPlayerColors}
                                                    className={`${buttonStyleClassNames} px-3 py-1 rounded border border-secondary-200 dark:border-secondary-800 text-sm font-semibold`}
                                                    title="Apply the selected colors to the game viewport"
                                                >
                                                    Apply
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-sm text-secondary-600 dark:text-secondary-400 italic">
                                            Load a case to configure player colors.
                                        </p>
                                    )}
                                </OptionsSection>
                            </OptionsPanel>
                        }
                    />
                </div>
                <VDivider onWidthChangeRequest={(v => {
                    setLeftWidth(leftWidth + v);
                })}></VDivider>
                <div className="relative overflow-hidden flex flex-row p-3 m-2 flex-grow">
                    <div className="tree-inspector max-h-[calc(100dvh-110px)]">
                        <TreeView renderKey={graphRenderKey} graph={solver?.gameTree ?? null} onNodeSelected={onNodeSelected}></TreeView>
                        { shownPosition !== null ? 
                            <div className="position-inspector w-full">
                                <DynamicLabel text={shownPosition.id}></DynamicLabel>
                                <PropertyInspector properties={extendedProperties} onChange={(p,o,v) => onPositionPropertyChange(p,o,v)}></PropertyInspector>
                            </div> : <></>
                        }
                    </div>
                    <div className="game-view w-1/2 max-h-[calc(100dvh-110px)] flex justify-center align-middle">
                        <div className="relative w-full h-full">
                            <Canvas className="mx-auto max-h-full max-w-full" renderKey={canvasRenderKey} draw={positionRender} width={GAME_CANVAS_X} height={GAME_CANVAS_Y}></Canvas>
                            <div className="absolute left-0 top-0 h-full w-full" id="gameDiv"></div>
                        </div>
                    </div>
                    { game ? 
                        <div className="game-inspector">
                            <PropertyInspector properties={gameProperties.filter(p => p.name !== "player_1_color" && p.name !== "player_2_color")} onChange={(p,o,v) => onGamePropertyChange(p,o,v)}></PropertyInspector>
                        </div> : <></>
                    }
                    
                    { solver ? 
                        <div className="controls flex flex-col gap-2">
                            <div className="bg-primary-200 dark:bg-primary-800 rounded-2xl align-middle px-2 pt-1">
                                <h3>Expansion</h3>
                                <PlayControls playing={expansionPlaying} color={"primary"}
                                    play={() => setRunningParameters({"expansionBudget": Number.MAX_SAFE_INTEGER})}
                                    stop={() => setRunningParameters({"expansionBudget": 0})}
                                    step={() => modifyRunningParameters({"expansionBudget": 1})}
                                />
                            </div>
                            <div className="bg-primary-200 dark:bg-primary-800 rounded-2xl align-middle px-2 pt-1">
                                <h3>Evaluation</h3>
                                <PlayControls playing={algorithmPlaying} color={"primary"}
                                    play={() => setRunningParameters({"algorithmBudget": Number.MAX_SAFE_INTEGER})}
                                    stop={() => setRunningParameters({"algorithmBudget": 0})}
                                    step={() => modifyRunningParameters({"algorithmBudget": 1})}
                                />
                            </div>
                        </div> : <></>
                    }
                </div>
            </div>
        </div>
    )
}