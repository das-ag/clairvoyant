/**
 * Inspects Error().stack to extract the calling line number from eval'd
 * algorithm code. Works across Chrome/Edge, Firefox, and Safari.
 *
 * Call this inside a solution base-class visualization method; it will
 * walk the stack frames and return the first line number originating
 * from an `<anonymous>` (eval'd) context—i.e. the user's algorithm code.
 */
export function getEvalCallerLine(): number | null {
    const err = new Error();
    const stack = err.stack;
    if (!stack) return null;

    const frames = stack.split("\n");
    for (const frame of frames) {
        // Chrome / Edge / Safari:
        //   "at ClassName.method (eval at buildFn (file:…), <anonymous>:LINE:COL)"
        const chromeMatch = frame.match(/<anonymous>:(\d+):\d+/);
        if (chromeMatch) return parseInt(chromeMatch[1], 10);

        // Firefox:
        //   "method@eval line N > eval:LINE:COL"
        const firefoxMatch = frame.match(/> eval:(\d+):\d+/);
        if (firefoxMatch) return parseInt(firefoxMatch[1], 10);
    }
    return null;
}
