const initialPosition = "7/7/7/7/7/7 W";
// equivalent to:     = "-------/-------/-------/-------/-------/------- W"
// OTHER INTERESTING POSITIONS:
// late-game draw: "WBWB-W-/BBWW-B-/BBBW-W-/WWWBBB-/WBWWWBB/WWBBBWB W"
// win by claimeven: "-WWB2W/-BBW2B/-WBB2W/-BWB2B/WWBW2W/BBWBB-W W"
// win by claimeven early-game: "3B3/3W3/3B3/3W3/2BB-W-/2WB-W- B"

const [M,N,K] = [7,6,4]
const restriction = (position, x, y) => {
    // cannot replace existing piece
    if (position.squares[y][x] !=="-") return false;

    // must be placed at the bottom of a column
    for (let i = y + 1; i < N; i++) {
        if (position.squares[i][x] === "-") return false;
    }

    return true;
}

// some precalculation to fit an MxN grid into a 500x500px square:
const CellSize = 500 / Math.max(M,N);
const [BoardW, BoardH] = [M * CellSize, N * CellSize];
const [BoardX, BoardY] = [250 - BoardW / 2, 500 - BoardH / 2];

(GameBase, PositionBase) => {
    class Position extends PositionBase {
        /** 
         * @param {MNKGame} game
         * @param {string} notation
        */
        constructor(game, notation) {
            super();
            this.data = {};
            this.game = game;
            this.notation = notation;
            let [squares, next] = MNKGame.readNotation(notation);
            this.squares = squares;
            this.next = next;
            let winner = this.getWinnerCharacter();
            if (winner === "-") {
                this.score = 0;
                this.terminal = this.isTie();
            } else {
                this.score = (winner === "W" ? 1 : -1);
                this.terminal = true;
            }
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
                    let color = this.game.colors[text === "W" ? 0 : 1];
                    helper.drawCircle(centerX, centerY, CellSize / 2 - 10, color);
                    helper.drawCircle(centerX, centerY, CellSize / 2 - 15, pieceCenterShadeColor);
                }
            }

            if (this.winCoords !== undefined) {
                let [start, end] = this.winCoords;
                let [sx, sy] = start;
                let [ex, ey] = end;
                helper.drawLine(
                    sx * CellSize + CellSize / 2 + BoardX, sy * CellSize + CellSize / 2 + BoardY, 
                    ex * CellSize + CellSize / 2 + BoardX, ey * CellSize + CellSize / 2 + BoardY, 
                    "#00ff00", 10
                );
                ctx.lineWidth = 1;
            } else if (!this.terminal) {
                let centerX = 250;
                let centerY = BoardY / 2;
                let scale = 2;
                let r = (CellSize - 20) * scale / 2;
                let color = this.game.colors[this.next === "W" ? 0 : 1];
                helper.drawCircle(centerX, centerY, r, color);
                helper.drawCircle(centerX, centerY, r - 5 * scale, pieceCenterShadeColor);
            }
        }
    
        getWinnerCharacter() {
            let consecutiveCount;
            let piece = "-";
            // columns
            for (let x = 0; x < M; x++) {
                consecutiveCount = 0;
                for (let y = 0; y < N; y++) {
                    // counter logic
                    let char = this.squares[y][x];
                    if (char !== piece) {
                        piece = char;
                        consecutiveCount = 1;
                    } else if (char !== "-") {
                        if (++consecutiveCount >= K) {
                            this.winCoords = [[x,y], [x,y-K+1]];
                            return char;
                        }
                    }
                }
            }
            // rows
            for (let y = 0; y < N; y++) {
                consecutiveCount = 0;
                for (let x = 0; x < M; x++) {
                    let char = this.squares[y][x];
                    if (char !== piece) {
                        piece = char;
                        consecutiveCount = 1;
                    } else if (char !== "-") {
                        if (++consecutiveCount >= K) {
                            this.winCoords = [[x,y], [x-K+1,y]];
                            return char;
                        }
                    }
                }
            }
            // diagonals
            for (let xs = K - N; xs < M - K; xs++) {
                // main diagonals (x increases as y increases)
                consecutiveCount = 0;
                for (let y = 0; y < N; y++) {
                    let x = xs + y;
                    if (x < 0) continue;
                    if (x >= M) break;

                    let char = this.squares[y][x];
                    if (char !== piece) {
                        piece = char;
                        consecutiveCount = 1;
                    } else if (char !== "-") {
                        if (++consecutiveCount >= K) {
                            this.winCoords = [[x,y], [x-K+1,y-K+1]];
                            return char;
                        }
                    }
                }
                // mirror diagonals (x decreases as y increases)
                consecutiveCount = 0;
                for (let y = 0; y < N; y++) {
                    let x = M - xs - 1 - y;
                    if (x >= M) continue;
                    if (x < 0) break;

                    let char = this.squares[y][x];
                    if (char !== piece) {
                        piece = char;
                        consecutiveCount = 1;
                    } else if (char !== "-") {
                        if (++consecutiveCount >= K) {
                            this.winCoords = [[x,y], [x+K-1,y-K+1]];
                            return char;
                        }
                    }
                }
            }
            return "-";
        }
        isTie() {
            for (let y = 0; y < N; y++) {
                for (let x = 0; x < M; x++) {
                    if (this.squares[y][x] === "-") {
                        return false;
                    }
                }
            }
            return true;
        }

        isTerminal() {
            return this.terminal;
        }
        getScore() {
            return this.score;
        }
        getPlayer() {
            return this.next === "W" ? 1 : -1;
        }
    }
    
    function getPositionName(x, y) {
        return `${String.fromCodePoint(['a'.charCodeAt(0) + x])}${y + 1}`;
    }
    
    class MNKGame extends GameBase {
        constructor() {
            super();
            this.colors = [
                "#eeee55",
                "#ff2222"
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
            let actions = [];
            for (let x = 0; x < M; x++) {
                for (let y = 0; y < N; y++) {
                    if (restriction(position, x, y)) {
                        actions.push({name: getPositionName(x, y), label: `${x + 1}`, data: [x, y]});
                    }
                }
            }
            return actions;
        }
    
        getNotation(squares, next) {
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

        /** @param {Position} position */
        getResult(position, action) {
            let [x, y] = action.data;
            let oldVal = position.squares[y][x]; // record old value at placed position
            position.squares[y][x] = position.next; // perform in-place change to formulate notation
            let notation = this.getNotation(position.squares, position.next === "W" ? "B" : "W");
            position.squares[y][x] = oldVal; // undo change
            return new Position(this, notation);
        }

        /** @param {string} notation */
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
    }
    
    return new MNKGame();
}