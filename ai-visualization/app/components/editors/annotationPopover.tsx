"use client";

import React, { useEffect, useRef, useState } from "react";
import type { LineAnnotation } from "@/lib/rbt/rbtAnnotations";

interface AnnotationPopoverProps {
    line: number;
    isBranch: boolean;
    current: LineAnnotation | undefined;
    defaultAnnotation: LineAnnotation | undefined;
    top: number;
    left: number;
    onSave: (line: number, annotation: LineAnnotation | null) => void;
    onClose: () => void;
}

export default function AnnotationPopover({
    line,
    isBranch,
    current,
    defaultAnnotation,
    top,
    left,
    onSave,
    onClose,
}: AnnotationPopoverProps) {
    const [msg, setMsg] = useState(current?.msg ?? "");
    const [question, setQuestion] = useState(current?.question ?? "");
    const [answer, setAnswer] = useState(current?.answer ?? "");
    const containerRef = useRef<HTMLDivElement>(null);
    const firstInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        firstInputRef.current?.focus();
    }, []);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                handleSave();
                onClose();
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [msg, question, answer]);

    function handleSave() {
        if (isBranch) {
            const q = question.trim();
            const a = answer.trim();
            if (!q && !a) {
                onSave(line, null);
            } else {
                onSave(line, { question: q || undefined, answer: a || undefined });
            }
        } else {
            const m = msg.trim();
            onSave(line, m ? { msg: m } : null);
        }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSave();
            onClose();
        } else if (e.key === "Escape") {
            onClose();
        }
    }

    function handleReset() {
        if (isBranch) {
            setQuestion(defaultAnnotation?.question ?? "");
            setAnswer(defaultAnnotation?.answer ?? "");
        } else {
            setMsg(defaultAnnotation?.msg ?? "");
        }
    }

    function handleClear() {
        setMsg("");
        setQuestion("");
        setAnswer("");
    }

    return (
        <div
            ref={containerRef}
            onKeyDown={handleKeyDown}
            style={{
                position: "absolute",
                top: `${top}px`,
                left: `${left}px`,
                zIndex: 1000,
                background: "#1e1e2e",
                border: "1px solid #444",
                borderRadius: "6px",
                padding: "10px",
                minWidth: "280px",
                maxWidth: "400px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                fontFamily: "'Inter', sans-serif",
                fontSize: "13px",
                color: "#e0e0e0",
            }}
        >
            <div style={{ marginBottom: "6px", fontWeight: 600, fontSize: "11px", color: "#888" }}>
                Line {line} {isBranch ? "(Branch)" : ""}
            </div>

            {isBranch ? (
                <>
                    <label style={labelStyle}>Question</label>
                    <input
                        ref={firstInputRef}
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="e.g. Is the node RED?"
                        style={inputStyle}
                    />
                    <label style={labelStyle}>Answer</label>
                    <input
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="e.g. Yes — Case 1"
                        style={inputStyle}
                    />
                </>
            ) : (
                <>
                    <label style={labelStyle}>Message</label>
                    <input
                        ref={firstInputRef}
                        value={msg}
                        onChange={(e) => setMsg(e.target.value)}
                        placeholder="e.g. Recolor ${node.key} RED"
                        style={inputStyle}
                    />
                </>
            )}

            <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                <button onClick={handleReset} style={btnStyle}>
                    Reset
                </button>
                <button onClick={handleClear} style={btnStyle}>
                    Clear
                </button>
                <button
                    onClick={() => { handleSave(); onClose(); }}
                    style={{ ...btnStyle, background: "#4fc3f7", color: "#111" }}
                >
                    Save
                </button>
            </div>
        </div>
    );
}

const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "11px",
    color: "#999",
    marginBottom: "2px",
    marginTop: "6px",
};

const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "5px 8px",
    background: "#2a2a3e",
    border: "1px solid #555",
    borderRadius: "4px",
    color: "#e0e0e0",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box",
};

const btnStyle: React.CSSProperties = {
    flex: 1,
    padding: "4px 8px",
    background: "#333",
    border: "1px solid #555",
    borderRadius: "4px",
    color: "#ccc",
    fontSize: "12px",
    cursor: "pointer",
};
