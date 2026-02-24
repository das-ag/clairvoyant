// ── Annotation types ────────────────────────────────────────────────────

export interface LineAnnotation {
    msg?: string;
    question?: string;
    answer?: string;
}

/** On-disk format — anchored by content, not line number. */
export interface AnnotationEntry {
    fn: string;
    anchor: string;
    occurrence?: number;
    annotation: LineAnnotation;
}

/** Runtime format — resolved to current line numbers for fast lookup. */
export type ResolvedAnnotationMap = Map<number, LineAnnotation>;

/** Maps each line to the innermost enclosing if/else-if/else line. */
export type BranchScopeMap = Map<number, number>;

// ── Function boundary detection ─────────────────────────────────────────

interface FnRange {
    name: string;
    startLine: number;
    endLine: number;
}

/**
 * Identify method boundaries inside a class body.  Assumes the
 * code is a single class declaration followed by `ClassName.prototype;`.
 */
function parseFunctionRanges(code: string): FnRange[] {
    const lines = code.split("\n");
    const ranges: FnRange[] = [];
    let depth = 0;
    let currentFn: { name: string; startLine: number; entryDepth: number } | null = null;

    for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const trimmed = lines[i].trim();

        if (!currentFn && depth === 1) {
            const m = trimmed.match(/^(\w+)\s*\(.*\)\s*\{/);
            if (m) {
                currentFn = { name: m[1], startLine: lineNum, entryDepth: depth };
            }
        }

        for (const ch of lines[i]) {
            if (ch === "{") depth++;
            else if (ch === "}") depth--;
        }

        if (currentFn && depth <= currentFn.entryDepth) {
            ranges.push({ name: currentFn.name, startLine: currentFn.startLine, endLine: lineNum });
            currentFn = null;
        }
    }
    return ranges;
}

// ── resolveAnnotations ──────────────────────────────────────────────────

/**
 * Match content-anchored annotations to current line numbers.
 * For each entry, finds the line within the named function whose trimmed
 * content equals `anchor`, using `occurrence` to disambiguate repeats.
 */
export function resolveAnnotations(
    entries: AnnotationEntry[],
    code: string,
): ResolvedAnnotationMap {
    const map: ResolvedAnnotationMap = new Map();
    if (entries.length === 0) return map;

    const fns = parseFunctionRanges(code);
    const lines = code.split("\n");

    for (const entry of entries) {
        const fnRange = fns.find((f) => f.name === entry.fn);
        if (!fnRange) continue;

        const target = entry.anchor.trim();
        const occ = entry.occurrence ?? 0;
        let matchCount = 0;

        for (let i = fnRange.startLine - 1; i < fnRange.endLine; i++) {
            if (lines[i].trim() === target) {
                if (matchCount === occ) {
                    map.set(i + 1, entry.annotation);
                    break;
                }
                matchCount++;
            }
        }
    }
    return map;
}

// ── unresolveAnnotation ─────────────────────────────────────────────────

/**
 * Given a line number in the current code, compute the content-based
 * anchor key so the annotation can be stored durably.
 */
export function unresolveAnnotation(
    lineNum: number,
    code: string,
): { fn: string; anchor: string; occurrence: number } | null {
    const lines = code.split("\n");
    if (lineNum < 1 || lineNum > lines.length) return null;

    const fns = parseFunctionRanges(code);
    const enclosing = fns.find(
        (f) => lineNum >= f.startLine && lineNum <= f.endLine,
    );
    if (!enclosing) return null;

    const anchor = lines[lineNum - 1].trim();
    let occurrence = 0;
    for (let i = enclosing.startLine - 1; i < lineNum - 1; i++) {
        if (lines[i].trim() === anchor) occurrence++;
    }

    return { fn: enclosing.name, anchor, occurrence };
}

// ── buildBranchScopeMap ─────────────────────────────────────────────────

const BRANCH_RE =
    /^(\}\s*)?(else\s+)?if\s*\(|^(\}\s*)?else\s*(\{|$)/;

/**
 * Build a map from each line inside an if/else-if/else body to the
 * line number of the branch declaration.
 */
export function buildBranchScopeMap(code: string): BranchScopeMap {
    const map: BranchScopeMap = new Map();
    const lines = code.split("\n");
    const stack: number[] = [];
    const stackExitDepths: number[] = [];
    let depth = 0;
    let pendingSingleLine: number | null = null;

    for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const trimmed = lines[i].trim();
        if (!trimmed) continue;

        if (pendingSingleLine !== null) {
            map.set(lineNum, pendingSingleLine);
            pendingSingleLine = null;
        }

        const isBranch = BRANCH_RE.test(trimmed);
        const endsWithBrace = trimmed.endsWith("{");

        for (const ch of lines[i]) {
            if (ch === "}") {
                depth--;
                while (
                    stack.length > 0 &&
                    stackExitDepths[stackExitDepths.length - 1] > depth
                ) {
                    stack.pop();
                    stackExitDepths.pop();
                }
            } else if (ch === "{") {
                depth++;
            }
        }

        if (isBranch) {
            if (endsWithBrace) {
                stack.push(lineNum);
                stackExitDepths.push(depth);
            } else {
                pendingSingleLine = lineNum;
            }
        } else if (stack.length > 0) {
            map.set(lineNum, stack[stack.length - 1]);
        }
    }
    return map;
}

// ── evaluateTemplate ────────────────────────────────────────────────────

/**
 * Evaluate a template string containing `${...}` expressions against
 * a context object.  Falls back to the raw template on any error.
 */
export function evaluateTemplate(
    template: string,
    context: Record<string, any>,
): string {
    try {
        const keys = Object.keys(context);
        const values = Object.values(context);
        // eslint-disable-next-line no-new-func
        const fn = new Function(...keys, `return \`${template}\`;`);
        return fn(...values);
    } catch {
        return template;
    }
}
