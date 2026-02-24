const initialPosition = "B:W21,22,23,24,25,26,27,28,29,30,31,32:B1,2,3,4,5,6,7,8,9,10,11,12";

// other positions:
// late game: "B:WK13:BK12"

(GameBase, PositionBase) => {
    class Position extends PositionBase {
        /** 
         * @param {Checkers} game 
         * @param {string} notation
        */
        constructor(game, notation) {
            super();
            this.data = {};
            this.game = game;
            this.squares = [];
            for (let i = 0; i < 32; i++) this.squares[i] = " ";
            let chunks = notation.split(":");
            if (chunks.length !== 3) {
                throw new SyntaxError(`Position notation requires 3 sections separated by colons (:), received ${chunks.length}`);
            }
            let [next, white, black] = chunks;
            this.next = next;
            white = white.substring(1); // ignore the "W" preceding the white positions
            black = black.substring(1); // ignore the "B" preceding the black positions
            this.notation = notation;
            if (white.length > 0) {
                for (let w of white.split(",")) {
                    w = w.toUpperCase().trim();
                    let isKing = false;
                    if (w.startsWith("K")) {
                        isKing = true;
                        w = w.substring(1);
                    }
                    let num = parseInt(w);
                    if (Number.isNaN(num)) throw new SyntaxError(`Unable to parse ${w} into a number while parsing white piece positions.`);
                    this.squares[num - 1] = isKing ? "k" : "o";
                }
            }
            if (black.length > 0) {
                for (let b of black.split(",")) {
                    b = b.toUpperCase().trim();
                    let isKing = false;
                    if (b.startsWith("K")) {
                        isKing = true;
                        b = b.substring(1);
                    }
                    let num = parseInt(b);
                    if (Number.isNaN(num)) throw new SyntaxError(`Unable to parse ${b} into a number while parsing black piece positions.`);
                    this.squares[num - 1] = isKing ? "K" : "O";
                }
                let winner = this.getWinner();
                if (winner === " ") {
                    this.score = 0;
                    this.terminal = this.isTie();
                } else {
                    this.score = winner === "B" ? 1 : -1;
                    this.terminal = true;
                }
            }
        }
    
        getId() {
            return this.notation;
        }

        getHeuristic() {
            const KINGVAL = 1.5;
            // count all pieces, with kings valued 50% more
            let [cntBlack, cntWhite] = this.getPieceCounts(KINGVAL);
            let delta = cntBlack - cntWhite;
            return delta / (12 * KINGVAL)
        }

        getUtility() {
            if (this.isTerminal()) return this.score;
            return this.getHeuristic();
        }
    
        /** @param {CanvasRenderingContext2D} ctx */
        render(ctx) {
            let helper = this.drawHelper(ctx);
            // draw a centered 500px by 500px, 8 by 8 grid
            helper.drawGrid(0, 250, 500, 500, 8, 8, "#808080");
            const w = 500 / 8;
            for (let n = 0; n < 32; n++) {
                let [i,j] = coordinates[n];
                let x = j * w + w / 2;
                let y = i * w + w / 2 + 250;
                let piece = this.squares[n];
                if (piece.trim() === "") continue;
                let firstPlayer = this.game.isPlayer1(piece);
                let color = this.game.colors[firstPlayer ? 0 : 1];
                helper.drawCircle(x, y, w/2 - 5, color);
                if (piece.toUpperCase() === "K") {
                    // King
                    let oppositeColor = this.game.colors[firstPlayer ? 1 : 0];
                    helper.drawTextCentered("K", x, y, w - 10, oppositeColor);
                }
            }
        }
    
        getPieceCounts(kingValue = 1) {
            let cntBlack = 0;
            let cntWhite = 0;
            for (let c of this.squares) {
                if (c.trim() === "") continue;
                let value = c.toUpperCase() === "K" ? kingValue : 1;
                if (this.game.isPlayer1(c)) cntBlack += value;
                else cntWhite += value;
            }
            return [cntBlack, cntWhite];
        }
        getWinner() {
            let [cntBlack, cntWhite] = this.getPieceCounts();
            if (cntWhite === 0) return "B";
            if (cntBlack === 0) return "W";
            return " ";
        }
        isTie() {
            // TODO: check if next player left without legal moves
            
            return false;
        }
    
        isTerminal() {
            return this.terminal;
        }
        getScore() {
            return this.score;
        }
        getPlayer() {
            return this.next === "B" ? 1 : -1;
        }
    }

    function getPositionNumber(i, j) {
        return 32 - (i * 4 + Math.floor(j / 2));
    }
    const coordinates = [
        [7,6], [7,4], [7,2], [7,0],
        [6,7], [6,5], [6,3], [6,1],
        [5,6], [5,4], [5,2], [5,0],
        [4,7], [4,5], [4,3], [4,1],
        [3,6], [3,4], [3,2], [3,0],
        [2,7], [2,5], [2,3], [2,1],
        [1,6], [1,4], [1,2], [1,0],
        [0,7], [0,5], [0,3], [0,1],
    ]
    // precalculate some move information...
    const movesDown = [];
    const movesUp = [];
    const capturesDown = [];
    const capturesUp = [];
    for (let n in coordinates) {
        let [i,j] = coordinates[n];
        let newMovesDown = [];
        if (i + 1 < 8) {
            if (j - 1 >=0) newMovesDown.push(getPositionNumber(i + 1, j - 1));
            if (j + 1 < 8) newMovesDown.push(getPositionNumber(i + 1, j + 1));
        }
        movesDown.push(newMovesDown);
        let newMovesUp = [];
        if (i - 1 >=0) {
            if (j - 1 >=0) newMovesUp.push(getPositionNumber(i - 1, j - 1));
            if (j + 1 < 8) newMovesUp.push(getPositionNumber(i - 1, j + 1));
        }
        movesUp.push(newMovesUp);
        let newCapturesDown = [];
        if (i + 2 < 8) {
            if (j - 2 >=0) newCapturesDown.push({"capture": getPositionNumber(i + 1, j - 1), "target": getPositionNumber(i + 2, j - 2)});
            if (j + 2 < 8) newCapturesDown.push({"capture": getPositionNumber(i + 1, j + 1), "target": getPositionNumber(i + 2, j + 2)});
        }
        capturesDown.push(newCapturesDown);
        let newCapturesUp = [];
        if (i - 2 >=0) {
            if (j - 2 >=0) newCapturesUp.push({"capture": getPositionNumber(i - 1, j - 1), "target": getPositionNumber(i - 2, j - 2)});
            if (j + 2 < 8) newCapturesUp.push({"capture": getPositionNumber(i - 1, j + 1), "target": getPositionNumber(i - 2, j + 2)});
        }
        capturesUp.push(newCapturesUp);
    }

    class Checkers extends GameBase {
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

        getPieceMoves(piece, pos) {
            return this.getPieceActions(piece, pos, movesUp, movesDown);
        }
        getPieceCaptures(piece, pos) {
            return this.getPieceActions(piece, pos, capturesUp, capturesDown);
        }
        getPieceActions(piece, pos, up, down) {
            let i = pos - 1;
            // Queen, moves in any direction
            if (piece.toUpperCase() === "K") {
                return [...up[i], ...down[i]]
            }

            if (this.isPlayer1(piece)) {
                // player 1, moves up
                return up[i];
            } else {
                // player 2, moves down
                return down[i];
            }
        }

        isPlayer1(piece) {
            return piece.toUpperCase() === piece;
        }
        
        getNotation(next, squares) {
            let resultW = [];
            let resultB = [];
            for (let n = 1; n <= 32; n++) {
                let piece = squares[n-1];
                if (piece.trim() === "") continue;
                let isKing = piece.toUpperCase() === "K";
                let notation = isKing ? `K${n}` : `${n}`;
                if (this.isPlayer1(piece)) {
                    resultB.push(notation);
                } else {
                    resultW.push(notation);
                }
            }
            return `${next}:W${resultW.join(",")}:B${resultB.join(",")}`;
        }

        /** @param {Position} position */
        /** @param {Set<number>} bannedCaptures */
        checkCapturesFrom(piece, n, position, bannedCaptures = new Set()) {
            let squares = position.squares;
            let results = [];
            for (let move of this.getPieceCaptures(piece, n)) {
                let {capture, target} = move;
                if (bannedCaptures.has(capture)) continue; // already captured that position
                let capPiece = squares[capture - 1];
                if (capPiece.trim() === "") continue; // no piece to capture
                let targetPiece = squares[target - 1];
                if (targetPiece.trim() != "") continue; // target position not free
                if (this.isPlayer1(capPiece) === this.isPlayer1(piece)) continue; // can't capture own pieces

                let newPiece = this.checkPromotion(piece, target);
                bannedCaptures.add(capture);
                let followUpCaptures = this.checkCapturesFrom(newPiece, target, position, bannedCaptures);
                bannedCaptures.delete(capture);

                if (followUpCaptures.length === 0) {
                    results.push({
                        name: `${n}x${target}`,
                        move_from: n,
                        move_to: target,
                        captures: [capture],
                        becomes: newPiece
                    });
                    continue;
                } else {
                    results.push(...followUpCaptures.map(c => {return {
                        name: `${n}x${c.name}`,
                        move_from: n,
                        move_to: c.move_to,
                        captures: [capture, ...c.captures],
                        becomes: c.becomes
                    }}));
                }
            }
            return results;
        }

        checkPromotion(piece, n) {
            let piecePlayer1 = this.isPlayer1(piece);
            
            if (piecePlayer1 && n >= 29) return "K";
            if (!piecePlayer1 && n <= 4) return "k";
            return piece;
        }
    
        /** @param {Position} position */
        getActions(position) {
            if (position.isTerminal()) {
                return [];
            }
            let captures = [];
            // TO DO, CHECK CAPTURES!!!
            for (let n = 1; n <= 32; n++) {
                let piece = position.squares[n - 1];
                if (piece.trim() === "") continue; // no piece there
                let player1 = this.isPlayer1(piece);
                if (player1 != (position.getPlayer() === 1)) continue;
                captures.push(...this.checkCapturesFrom(piece, n, position));
            }

            // If captures are possible, they must be played
            if (captures.length > 0) return captures.map(c => {
                let {name, ...rest} = c;
                return {
                    name: name,
                    data: rest
                }
            });

            let moves = [];
            for (let n = 1; n <= 32; n++) {
                // If the square is occupied by the person moving next...
                let piece = position.squares[n - 1];
                if (piece.trim() === "") continue;

                let player1 = this.isPlayer1(piece);
                if (player1 != (position.getPlayer() === 1)) continue;

                // If there's a piece of the correct color, get all moves for that piece
                for (let target of this.getPieceMoves(piece, n)) {
                    let targetPiece = position.squares[target - 1];
                    // ensure target unoccupied
                    if (targetPiece.trim() != "") continue;
                    // check for promotion...
                    let newPiece = this.checkPromotion(piece, target);
                    
                    // add action to moves
                    moves.push({name: `${n}-${target}`, data: {
                        move_from: n,
                        move_to: target,
                        captures: [],
                        becomes: newPiece
                    }});
                }
            }
            return moves;
        }
    
        /** @param {Position} position */
        getResult(position, action) {
            let {move_from, move_to, captures, becomes} = action.data;
            // clones squares
            let squares = position.squares.map(c => c);
            squares[move_from - 1] = " ";
            squares[move_to - 1] = becomes;
            for (let cap of captures) {squares[cap - 1] = " "}
            return new Position(this, this.getNotation(position.next === "W" ? "B" : "W", squares));
        }
    }

    return new Checkers();
}