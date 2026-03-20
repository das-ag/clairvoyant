import { getCase, getCases } from "@/lib/api/problems";
import { API_URL } from "@/lib/statics/appConstants";
import { buttonStyleClassNames, highlights, themes } from "@/lib/statics/styleConstants";
import { capitalize, formatPrettyFile } from "@/lib/strings/pretty";
import { useCallback, useEffect, useRef, useState } from "react";
import Select from "react-select";
import { syntaxHighlighting } from "@codemirror/language"
import ClipboardButton from "../clipboardButton";
import ReactCodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import React from "react";
import CodeView from "./codeView";

const init_defaultCases: string[] = [];

const js = javascript();

export default function CaseEditor({problem, errorMessage, caseData, onCaseDataChanged, codeMode = false, solutionHeight = 0}: {
    problem: string, 
    errorMessage: string,
    caseData: string,
    codeMode?: boolean,
    solutionHeight?: number,
    onCaseDataChanged: (v: string) => void
}) {
    let [caseId, setCaseId] = useState("");

    let [defaultCases, setDefaultCases] = useState(init_defaultCases);
    let [currentTheme, setCurrentTheme] = useState("dark");
    let [langData, _setLangData] = useState(js);

    const textRef = useRef<HTMLDivElement>(null);

    const fetchCaseData = useCallback((forProblem: string, forCaseId: string) => {
        getCase(forProblem, forCaseId)
        .then(json => {
            let responseCaseData = json as string;
            onCaseDataChanged(responseCaseData);
        })
        .catch(err => console.error(err));
    }, [onCaseDataChanged]);

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
        getCases(problem)
        .then(responseCases => {
            setDefaultCases(responseCases);
            setCaseId(responseCases[0]);
            fetchCaseData(problem, responseCases[0]);
        })
        .catch(err => console.error(err));
    }, [fetchCaseData, problem]);

    return (
    <div className="flex-grow flex flex-col items-stretch">
        <div className="flex flex-row justify-between">
            <h2 className="inline-block">Case: </h2>
            {codeMode ?
                <button onClick={toggleTheme}>Theme: {currentTheme}</button> :
                <></>
            }
        </div>
        <div className="flex flex-row mb-1">
            <Select unstyled className="flex-grow" classNames={{
                control: (state) => {return `${buttonStyleClassNames} rounded pl-2 border-solid border-2 border-secondary-50 dark:border-secondary-950`}, 
                option: (state) => {return `${buttonStyleClassNames} p-1`}}}
                options={defaultCases.map(n => {return {value: n, label: formatPrettyFile(n)}})}
                value={caseId ? { value: caseId, label: formatPrettyFile(caseId) } : null}
                onChange={e => {setCaseId(e?.value ?? ""); fetchCaseData(problem, e?.value ?? "");}}>
            </Select>
            <ClipboardButton textToCopy={caseData} className={`${buttonStyleClassNames} border-2 border-solid border-secondary-50 dark:border-secondary-950 min-w-8 ml-1 rounded px-2`}></ClipboardButton>
        </div>
        <div className="flex-grow flex flex-col relative" ref={textRef}>
        {codeMode ? (
            <CodeView className="absolute inset-0" style={{height: `calc(${textRef.current?.clientHeight}px - 1rem)`}} lang="javascript" extensions={[themes[currentTheme], syntaxHighlighting(highlights[currentTheme]), langData]} value={caseData} onChange={e => onCaseDataChanged(e ?? "")}>
            </CodeView>
        ) : (
            <textarea className="flex-grow min-h-0 w-full bg-primary-50 dark:bg-primary-950 text-secondary dark:text-secondary-200" 
                value={caseData} onChange={e => onCaseDataChanged(e.target.value ?? "")}>
            </textarea>
        )}
        </div>
        {errorMessage ? (<div className="bg-opacity-50 max-h-32 overflow-y-auto border p-1 mt-1 border-solid rounded-md border-danger-500 bg-danger-100 dark:bg-danger-900 text-danger-800 dark:text-danger-200">
            {errorMessage}
        </div>) : (<></>)}
    </div>
    );
}