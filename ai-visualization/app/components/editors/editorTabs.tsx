import { ReactNode, useState } from "react";
import { buttonStyleClassNames } from "@/lib/statics/styleConstants";
import SolutionEditor from "./solutionEditor";
import CaseEditor from "./problemEditor";
import type { ResolvedAnnotationMap, LineAnnotation, AnnotationEntry } from "@/lib/rbt/rbtAnnotations";

type TabId = "algorithm" | "cases" | "options";

export default function EditorTabs({
    problem,
    runner,
    algoErrorMessage,
    onSolutionChanged,
    onAnnotationsLoaded,
    activeLine,
    annotations,
    defaultAnnotations,
    onAnnotationEdit,
    caseErrorMessage,
    caseData,
    onCaseDataChanged,
    codeMode,
    options,
}: {
    problem: string,
    runner: () => void,
    algoErrorMessage: string,
    onSolutionChanged: (v: string) => void,
    onAnnotationsLoaded?: (entries: AnnotationEntry[]) => void,
    activeLine?: number | null,
    annotations?: ResolvedAnnotationMap,
    defaultAnnotations?: ResolvedAnnotationMap,
    onAnnotationEdit?: (line: number, annotation: LineAnnotation | null) => void,
    caseErrorMessage: string,
    caseData: string,
    onCaseDataChanged: (v: string) => void,
    codeMode?: boolean,
    options?: ReactNode,
}) {
    const [activeTab, setActiveTab] = useState<TabId>("algorithm");

    const tabButtonBase = "rounded-t px-3 py-1 border-solid border-2 border-b-0";
    const activeTabClasses = `${tabButtonBase} border-secondary-50 dark:border-secondary-950 bg-secondary-100 dark:bg-secondary-800 text-secondary-900 dark:text-secondary-100 font-semibold`;
    const inactiveTabClasses = `${tabButtonBase} ${buttonStyleClassNames} border-secondary-50 dark:border-secondary-950 opacity-70`;

    const tabButton = (id: TabId, label: string) => (
        <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={activeTab === id ? activeTabClasses : inactiveTabClasses}
        >
            {label}
        </button>
    );

    return (
        <div className="flex flex-col flex-grow min-h-0 ml-2">
            <div className="flex flex-row items-end justify-between mb-1 px-1 pt-1 gap-2">
                <div className="flex flex-row gap-1">
                    {tabButton("algorithm", "Algorithm")}
                    {tabButton("cases", "Cases")}
                    {options !== undefined && tabButton("options", "Options")}
                </div>
                <button
                    onClick={runner}
                    className={`${buttonStyleClassNames} rounded px-3 py-1 border-solid border-2 border-secondary-50 dark:border-secondary-950 font-semibold`}
                    title="Run the current algorithm against the current case"
                >
                    Run
                </button>
            </div>
            <div className="flex-grow min-h-0 flex flex-col">
                <div className={`${activeTab === "algorithm" ? "flex" : "hidden"} flex-col flex-grow min-h-0`}>
                    <SolutionEditor
                        problem={problem}
                        errorMessage={algoErrorMessage}
                        onSolutionChanged={onSolutionChanged}
                        onAnnotationsLoaded={onAnnotationsLoaded}
                        activeLine={activeLine}
                        annotations={annotations}
                        defaultAnnotations={defaultAnnotations}
                        onAnnotationEdit={onAnnotationEdit}
                    />
                </div>
                <div className={`${activeTab === "cases" ? "flex" : "hidden"} flex-col flex-grow min-h-0`}>
                    <CaseEditor
                        problem={problem}
                        caseData={caseData}
                        onCaseDataChanged={onCaseDataChanged}
                        errorMessage={caseErrorMessage}
                        codeMode={codeMode}
                    />
                </div>
                {options !== undefined && (
                    <div className={`${activeTab === "options" ? "flex" : "hidden"} flex-col flex-grow min-h-0`}>
                        {options}
                    </div>
                )}
            </div>
        </div>
    );
}
