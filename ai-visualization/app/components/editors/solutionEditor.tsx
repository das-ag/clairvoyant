import { getSolution, getSolutions } from "@/lib/api/problems";
import { buttonStyleClassNames, highlights, themes } from "@/lib/statics/styleConstants";
import { capitalize, formatPrettyFile } from "@/lib/strings/pretty";
import { useCallback, useEffect, useState } from "react";
import Select from "react-select";
import ReactCodeMirror, { EditorView, Extension } from "@uiw/react-codemirror";
import { syntaxHighlighting } from "@codemirror/language"
import Image from "next/image";
import { javascript } from "@codemirror/lang-javascript";
import CodeView from "./codeView";

// Then register the languages you need

const init_defaultAlgos: string[] = []

const js = javascript();

export default function SolutionEditor({problem, errorMessage, solutionHeight, runner, onSolutionChanged: onSolutionChanged, activeLine}: {
    problem: string,
    errorMessage: string,
    solutionHeight: number,
    runner: () => void,
    onSolutionChanged: (v: string) => void,
    activeLine?: number | null
}) {
    let [algoData, setAlgoData] = useState("");
    let [algoId, setAlgoId] = useState("");
    let [langData, _setLangData] = useState(js);

    let [defaultAlgorithms, setDefaultAlgorithms] = useState(init_defaultAlgos);
    let [currentTheme, setCurrentTheme] = useState("dark");

    const setSolution = useCallback((value: string) => {
        setAlgoData(value);
        onSolutionChanged(value);
    }, [onSolutionChanged])

    const fetchAlgorithm = useCallback((forProblem: string, forAlgoId: string) => {
        getSolution(forProblem, forAlgoId)
        .then(responseCaseData => {
            setSolution(responseCaseData);
        })
    }, [setSolution])

    function toggleTheme() {
        const allThemes = Object.keys(themes);
        const curThemeIndex = allThemes.indexOf(currentTheme);
        if (curThemeIndex < 0) {
            setCurrentTheme(allThemes[0]);
            return;
        }
        const nextThemeIndex = (curThemeIndex + 1) % allThemes.length;
        setCurrentTheme(allThemes[nextThemeIndex]);
    }

    useEffect(() => {
        if (!problem) return;
        getSolutions(problem)
        .then(responseCases => {
            setDefaultAlgorithms(responseCases);
            setAlgoId(responseCases[0])
        })
    }, [problem])

    return (
    <div className="flex flex-col items-stretch">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/default.min.css"></link>
        <div className="flex flex-row justify-between">
            <h2 className="inline-block">Algorithm: </h2>
            <button onClick={toggleTheme}>Theme: {currentTheme}</button>
        </div>
        <div className="flex flex-row mb-1">
            <Select unstyled className="flex-grow" classNames={{
                    control: (state) => {return `${buttonStyleClassNames} rounded pl-2 border-solid border-2 border-secondary-50 dark:border-secondary-950`}, 
                    option: (state) => {return `${buttonStyleClassNames} p-1`}
                }}
                options={defaultAlgorithms.map(n => {return {value: n, label: formatPrettyFile(n)}})} 
                onChange={e => {setAlgoId(e?.value ?? ""); fetchAlgorithm(problem, e?.value ?? "");}}>
            </Select>
            <button onClick={runner} className={`${buttonStyleClassNames} rounded px-2 border-solid border-2 border-secondary-50 dark:border-secondary-950`}>
                Run
            </button>
            <a href={`/docs/${problem}`} className={`${buttonStyleClassNames} rounded px-2 border-solid border-2 border-secondary-50 dark:border-secondary-950 flex flex-row justify-around items-center`}>
                <Image className="dark:invert" src="/DocScroll.png" alt="Documentation Icon" width={24} height={24}></Image>
            </a>
        </div>
        <div className="flex-grow flex">
            <CodeView style={{height: `${solutionHeight}px`}} lang="javascript" extensions={[themes[currentTheme], syntaxHighlighting(highlights[currentTheme]), langData]} value={algoData} onChange={e => setSolution(e ?? "")} activeLine={activeLine}>
            </CodeView>
        </div>
        {errorMessage ? (<div className="bg-opacity-50 max-h-32 overflow-y-auto border p-1 mt-1 border-solid rounded-md border-danger-500 bg-danger-100 dark:bg-danger-900 text-danger-800 dark:text-danger-200">
            {errorMessage}
        </div>) : (<></>)}
    </div>
    );
}