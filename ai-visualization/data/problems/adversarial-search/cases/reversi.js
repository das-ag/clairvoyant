const OTHELLO = true; // replace this for the othello variant vs. classic reversi rules
const startingPosition = OTHELLO ? "8/8/8/3WB3/3BW3/8/8/8 B" : "8/8/8/8/8/8/8/8 B";
const initialPosition = startingPosition; // replace this if you want a position later in the game
const absoluteWin = false // score is either 1 (for black wins), 0 (for draws), or -1 (for white wins), instead of linear
// Other interesting positions:
// advanced puzzle: "2BWWBBB/2BWWBB-/-BBBWBBB/BBBBBBBB/BBWBBWBB/BBBBBBWB/WBBWWWWW/-BBBB2B W"

// board dimensions, altering this requires altering the starting position notations too!
const [M,N] = [8,8];
const centerCoords = [[3,3],[3,4],[4,3],[4,4]];
const captureDeltas = [[1,0], [1,1], [0,1], [-1,1], [-1,0], [-1,-1], [0,-1], [1,-1]];

// some precalculation to fit an MxN grid into a 500x500px square:
const CellSize = 500 / Math.max(M,N);
const [BoardW, BoardH] = [M * CellSize, N * CellSize];
const [BoardX, BoardY] = [250 - BoardW / 2, 500 - BoardH / 2];

(GameBase, PositionBase) => {
    class Position extends PositionBase {
        /** 
         * @param {Reversi} game
         * @param {string} notation
        */
        constructor(game, notation) {
            super();
            this.data = {};
            this.game = game;
            this.notation = notation;
            let [squares, next] = Reversi.readNotation(notation);
            this.squares = squares;
            this.next = next;
            let counts = this.countSquares();
            let blackScore = counts['B'];
            let whiteScore = counts['W'];
            this.actions = undefined;
            if (counts['-'] == 0) { // board filled
                this.terminal = true;
                this.score = Reversi.calcUtilityScore(blackScore, whiteScore);
            } else { // board not filled
                this.actions = game.getActions(this);
                let canNextPlay = this.actions.length > 0;
                if (!canNextPlay) {
                    // assume whoever can't play loses all empty squares, per Othello rules
                    if (next == "W") {
                        blackScore += counts["-"];
                    } else {
                        whiteScore += counts["-"];
                    }
                    
                    this.score = Reversi.calcUtilityScore(blackScore, whiteScore);
                    this.terminal = true;
                } else {
                    this.score = Reversi.calcUtilityScore(blackScore, whiteScore);
                    this.terminal = false;
                }
            }
            this.data["blackScore"] = blackScore;
            this.data["whiteScore"] = whiteScore;
        }
    
        getId() {
            return this.notation;
        }
    
        /** @param {CanvasRenderingContext2D} ctx */
        render(ctx) {
            let helper = this.drawHelper(ctx);
            helper.drawGrid(BoardX, BoardY, BoardW, BoardH, M, N, "#808080");
            
            const pieceCenterShadeColor = "#ffffff30";
            for (let x = 0; x < M; x++) {
                for (let y = 0; y < N; y++) {
                    let text = this.squares[y][x];
                    if (text === "-") continue;
                    let centerX = x * CellSize + CellSize / 2 + BoardX;
                    let centerY = y * CellSize + CellSize / 2 + BoardY;
                    let color = this.game.colors[text === "B" ? 0 : 1];
                    helper.drawCircle(centerX, centerY, CellSize / 2 - 10, color);
                    helper.drawCircle(centerX, centerY, CellSize / 2 - 15, pieceCenterShadeColor);
                }
            }

            if (!this.terminal) {
                let centerX = 250;
                let centerY = BoardY / 2;
                let scale = 2;
                let r = (CellSize - 20) * scale / 2;
                let color = this.game.colors[this.next === "B" ? 0 : 1];
                helper.drawCircle(centerX, centerY, r, color);
                helper.drawCircle(centerX, centerY, r - 5 * scale, pieceCenterShadeColor);
            }
        }
    
        countSquares() {
            let counts = {'B': 0, 'W': 0, '-': 0}
            for (let x = 0; x < M; x++) {
                for (let y = 0; y < N; y++) {
                    counts[this.squares[y][x]]++;
                }
            }
            return counts;
        }

        isTerminal() {
            return this.terminal;
        }
        getScore() {
            if (absoluteWin) {
                if (this.score > 0) return 1;
                if (this.score < 0) return -1;
            }
            return this.score;
        }
        getPlayer() {
            return this.next === "B" ? 1 : -1;
        }

        // simple heuristic (optional)
        getHeuristic() {
            return this.score;
        }
    }
    
    function getPositionName(x, y) {
        return `${String.fromCodePoint(['a'.charCodeAt(0) + x])}${y + 1}`;
    }
    
    class Reversi extends GameBase {
        constructor() {
            super();
            this.colors = [
                "#222222",
                "#dddddd"
            ]
            this.initialPos = new Position(this, initialPosition);
        }

        get properties() {
            return [
                {name: "player_1_color", type: "color", value: this.colors[0], display: "1st Player Color"},
                {name: "player_2_color", type: "color", value: this.colors[1], display: "2nd Player Color"},
            ];
        }

        setProp(name, value) {
            switch (name) {
                case "player_1_color":
                    this.colors[0] = value;
                    return true;
                case "player_2_color":
                    this.colors[1] = value;
                    return true;
                default:
                    return false;
            }
        }
    
        getInitialPosition() {
            return this.initialPos;
        }
    
        /** @param {Position} position */
        getActions(position) {
            if (position.isTerminal()) {
                return [];
            }
            if (position.actions != undefined) {
                return position.actions;
            }
            let actions = [];
            const capturePiece = position.next == "W" ? "B" : "W"; 

            // if any of the central squares are available, one must be played in
            for (let [x,y] of centerCoords) {
                if (position.squares[y][x] == "-") {
                    actions.push({
                        "name": getPositionName(x,y),
                        "data": {
                            "position": [x,y],
                            "captures": Reversi.getCaptures(position.squares, x, y, position.next, capturePiece)
                        }
                    });
                }
            }
            if (actions.length > 0) {
                return actions;
            }

            // captures structure: captures[x + y * N] = captures resulting of playing in (x,y)
            let captures = [];
            for (let i = 0; i < M * N; i++) {
                captures.push([]);
            }
            for (let x = 0; x < M; x++) {
                for (let y = 0; y < N; y++) {
                    let piece = position.squares[y][x];
                    if (piece != position.next) {
                        continue;
                    }
                    for (let [dx, dy] of captureDeltas) {
                        let lineAnalysis = Reversi.checkLine(position.squares, x, y, dx, dy, capturePiece, "-");
                        if (lineAnalysis == undefined) continue;
                        let [pairX, pairY] = lineAnalysis.pair;
                        let pairPos = pairX + pairY * N;
                        captures[pairPos].push(...lineAnalysis.captures);
                    }
                }
            }
            for (let x = 0; x < M; x++) {
                for (let y = 0; y < N; y++) {
                    let i = x + y * N;
                    if (captures[i].length == 0) continue;
                    actions.push({
                        "name": getPositionName(x, y),
                        "data": {
                            "position": [x,y],
                            "captures": captures[i]
                        }
                    });
                }
            }
            return actions;
        }

        /** @param {Position} position */
        getResult(position, action) {
            let [x,y] = action.data["position"];
            let captures = action.data["captures"];
            const oppositePiece = position.next === "W" ? "B" : "W";
            let oldVal = position.squares[y][x]; // record old value at placed position
            position.squares[y][x] = position.next; // perform in-place change to formulate notation
            for (let [capX, capY] of captures) {
                position.squares[capY][capX] = position.next;
            }
            let notation = Reversi.getNotation(position.squares, oppositePiece);
            position.squares[y][x] = oldVal; // undo change
            for (let [capX, capY] of captures) {
                position.squares[capY][capX] = oppositePiece;
            }
            return new Position(this, notation);
        }

        /** 
         * @param {string[][]} squares
         * @param {string} next
         * @returns {string}
         * */
        static getNotation(squares, next) {
            let rows = [];
            for (let y = 0; y < N; y++) {
                let blankCnt = 0;
                let dynRow = [];
                for (let x = 0; x < M; x++) {
                    let char = squares[y][x];
                    if (char === "-") {
                        blankCnt++;
                        continue;
                    }
                    if (blankCnt == 1) dynRow.push("-");
                    else if (blankCnt > 1) dynRow.push(...new Array(`${blankCnt}`)); // push digits of the characters making up the count
                    blankCnt = 0;
                    dynRow.push(char);
                }
                if (blankCnt == 1) dynRow.push("-");
                else if (blankCnt > 1) dynRow.push(...new Array(`${blankCnt}`)); // push digits of the characters making up the count
                rows.push(dynRow.join(''));
            }
            return `${rows.join('/')} ${next}`;
        }

        /** 
         * @param {string} notation
         * @returns {[string[][], string]}
         * */
        static readNotation(notation) {
            const VALID_PIECES = ["W", "B"];
            const BLANK_PIECE = "-";
            // PREPROCESSING STEP
            notation = notation.toUpperCase();

            // HANDLING SEGMENTS
            let segments = notation.split(/\s+/g);
            if (segments.length !== 2) throw new SyntaxError("Given notation needs to be a board state followed a turn marker, separated by a space.");
            let [boardNotation, next] = segments
            // ensure the "next" turn is one of VALID_PIECES
            if (VALID_PIECES.indexOf(next) < 0) {
                throw new SyntaxError(`The turn marker must be one of W or B, to indicate player 1 or 2 respectively. Received "${next}"`);
            }

            // parsing of the BOARD
            let boardRows = boardNotation.split("/");
            if (boardRows.length !== N) throw new SyntaxError(`The board must have N = ${N} rows separated by a slash (/), ${boardRows.length} received.`);
            let squares = [];
            for (let row of boardRows) {
                let dynRow = [];
                let numBlanks = 0;
                for (let char of row) {
                    char = char.toUpperCase();
                    if (char === BLANK_PIECE || VALID_PIECES.indexOf(char) >= 0) {
                        // before appending, apply accumulated blanks
                        for (let i = 0; i < numBlanks; i++) dynRow.push("-");
                        numBlanks = 0;
                        dynRow.push(char);
                        continue;
                    }
                    let tempNum = parseInt(char);
                    if (isNaN(tempNum)) { throw new SyntaxError(`Unable to parse ${char} in row notation ${row} into a numeric digit or valid piece (${BLANK_PIECE}, ${VALID_PIECES.join(', ')}).`); }
                    numBlanks = 10 * numBlanks + tempNum;
                }
                // apply blanks accumulated at the end of the row
                for (let i = 0; i < numBlanks; i++) dynRow.push("-");
                if (dynRow.length !== M) {
                    throw new SyntaxError(`The row "${row}" has an invalid number of pieces ${dynRow.length} != ${M}.`);
                }
                squares.push(dynRow);
            }
            return [squares, next];
        }

        /** @param {number[][]} squares */
        /** @returns {undefined | {"pair": [number, number], "captures": [number,number][]}} */
        static checkLine(squares, originX, originY, deltaX, deltaY, capturePiece, endPiece = "-") {
            let x = originX + deltaX;
            let y = originY + deltaY;
            let captures = [];
            while (x >= 0 && x < M && y >= 0 && y < N) {
                let piece = squares[y][x];
                if (piece == endPiece) {
                    if (captures.length == 0) {
                        break;
                    }
                    return {
                        "pair": [x,y],
                        "captures": captures
                    }
                } else if (piece == capturePiece) {
                    captures.push([x,y]);
                } else {
                    break;
                }
                x += deltaX;
                y += deltaY;
            }
            return undefined;
        }

        static getCaptures(squares, pieceX, pieceY, piece, capturePiece) {
            let captures = [];
            for (let [dx, dy] of captureDeltas) {
                let lineAnalysis = Reversi.checkLine(squares, pieceX, pieceY, dx, dy, capturePiece, piece);
                if (lineAnalysis == undefined) continue;
                captures.push(...lineAnalysis.captures); 
            }
            return captures;
        }
    
        static calcUtilityScore(blackScore, whiteScore) {
            const totalSize = M * N;
            // best black case: 64 - 0 (score:  1) (assuming 8x8 = 64 square board)
            // best white case: 0 - 64 (score: -1) (assuming 8x8 = 64 square board)
            const diff = blackScore - whiteScore;
            return diff / totalSize;
        }
    }
    
    return new Reversi();
}