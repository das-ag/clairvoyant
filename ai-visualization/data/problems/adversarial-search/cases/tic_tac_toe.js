(GameBase, PositionBase) => {
    class Position extends PositionBase {
        /** 
         * @param {TicTacToe} game
         * @param {string[][]} squares 
         * @param {string} next
        */
        constructor(game, squares, next) {
            super();
            this.data = {};
            this.game = game;
            this.squares = squares;
            this.next = next;
            let winner = this.getWinnerCharacter();
            if (winner === " ") {
                this.score = 0;
                this.terminal = this.isTie();
            } else {
                this.score = winner === "X" ? 1 : -1;
                this.terminal = true;
            }
        }
    
        getId() {
            return this.squares.flat().join("") + this.next;
        }
    
        /** @param {CanvasRenderingContext2D} ctx */
        render(ctx) {
            let helper = this.drawHelper(ctx);
            // draw a centered 500px by 500px, 3 by 3 grid
            helper.drawGrid(0, 250, 500, 500, 3, 3, "#808080");
            const w = 500 / 3;
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    let x = j * w + w / 2;
                    let y = i * w + w / 2 + 250;
                    let text = this.squares[i][j];
                    let color = this.game.colors[text];
                    helper.drawTextCentered(text, x, y + 15, w - 10, color);
                }
            }
        }
    
        getWinnerCharacter() {
            for (let i = 0; i < 3; i++) {
                if (this.squares[i][0] !== " " && this.squares[i][0] === this.squares[i][1] && this.squares[i][0] === this.squares[i][2]) {
                    return this.squares[i][0];
                }
                if (this.squares[0][i] !== " " && this.squares[0][i] === this.squares[1][i] && this.squares[0][i] === this.squares[2][i]) {
                    return this.squares[0][i];
                }
            }
            if (this.squares[0][0] !== " " && this.squares[0][0] === this.squares[1][1] && this.squares[0][0] === this.squares[2][2]) {
                return this.squares[0][0];
            }
            if (this.squares[0][2] !== " " && this.squares[0][2] === this.squares[1][1] && this.squares[0][2] === this.squares[2][0]) {
                return this.squares[0][2];
            }
            return " ";
        }
        isTie() {
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    if (this.squares[i][j] === " ") {
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
            return this.next === "X" ? 1 : -1;
        }
    }
    
    const posNames = [
        ["top-left", "top-center", "top-right"], 
        ["middle-left", "middle-center", "middle-right"], 
        ["bottom-left", "bottom-center", "bottom-right"]
    ];
    const posLabels = [
        ["TL", "TC", "TR"],
        ["ML", "MC", "MR"],
        ["BL", "BC", "BR"]
    ]
    
    function getPositionName(i, j) {
        return posNames[i][j];
    }
    function getPositionLabel(i, j) {
        return posLabels[i][j];
    }
    
    class TicTacToe extends GameBase {
        constructor() {
            super();
            this.colors = {
                "X": "#ff0000",
                "O": "#0000ff"
            }
            this.initialPos = new Position(this, [[" ", " ", " "], [" ", " ", " "], [" ", " ", " "]], "X");
        }
        get properties() {
            return [
                {name: "x_color", type: "color", value: this.colors["X"], display: "X Color"},
                {name: "o_color", type: "color", value: this.colors["O"], display: "O Color"},
            ];
        }
        setProp(name, value) {
            switch (name) {
                case "x_color":
                    this.colors["X"] = value;
                    return true;
                case "o_color":
                    this.colors["O"] = value;
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
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    if (position.squares[i][j] === " ") {
                        actions.push({name: getPositionName(i, j), label: getPositionLabel(i, j), data: [i, j]});
                    }
                }
            }
            return actions;
        }
    
        /** @param {Position} position */
        getResult(position, action) {
            let [i, j] = action.data;
            // clones squares
            let squares = position.squares.map(row => row.slice());
            squares[i][j] = position.next;
            return new Position(this, squares, position.next === "X" ? "O" : "X");
        }
    }

    return new TicTacToe();
}