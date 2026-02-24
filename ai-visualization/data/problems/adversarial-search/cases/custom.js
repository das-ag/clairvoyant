const tree = {
    "A": {
        "A": {
            "A": {
                "A": 0.2,
                "B": -0.3,
                "C": 0.4
            },
            "B": {
                "A": -0.2,
                "B": 0.3,
                "C": -0.75
            },
            "C": {
                "A": -0.2,
                "B": {
                    "A": 0.9,
                    "B": 0.3,
                    "C": 0.4
                },
                "C": -0.75
            },
        },
        "B": {
            "A": {
                "A": -0.7,
                "B": -0.3,
                "C": -0.6
            },
            "B": {
                "A": -0.4,
                "B": -0.7,
                "C": 0.1
            },
            "C": {
                "A": 0.3,
                "B": 0.25,
                "C": -0.1
            }
        },
        "C": {
            "A": 0,
            "B": {
                "A": 0,
                "B": {
                    "A": 0.5,
                    "B": 0,
                    "C": 0
                },
                "C": 0.2 
            },
            "C": -1
        }
    },
    "B": {
        "A": 0,
        "B": {
            "A": 0,
            "B": 1,
            "C": {
                "A": -0.25,
                "B": -0.15,
                "C": -1
            }
        },
        "C": {
            "A": {
                "A": -0.5,
                "B": 0,
                "C": -1
            },
            "B": {
                "A": 0.5,
                "B": -0.2,
                "C": -0.85
            },
            "C": -0.5
        }
    },
    "C": {
        "A": {
            "A": {
                "A": 0,
                "B": -0.2,
                "C": -0.4
            },
            "B": {
                "A": -0.5,
                "B": -0.75,
                "C": -0.3
            },
            "C": {
                "A": -0.1,
                "B": -0.25,
                "C": -0.15
            }
        },
        "B": {
            "A": {
                "A": 0.1,
                "B": 0.05,
                "C": -0.5
            },
            "B": {
                "A": -0.2,
                "B": 0.3,
                "C": -0.75
            },
            "C": {
                "A": -1,
                "B": -1,
                "C": -0.4
            },
        },
        "C": {
            "A": {
                "A": -1,
                "B": -1,
                "C": -0.4
            },
            "B": 0,
            "C": {
                "A": 0.1,
                "B": 0.05,
                "C": -0.5
            },
        },
    }
};

(GameBase, PositionBase) => {
    class Position extends PositionBase {
        /** 
         * @param {CustomGame} game
         * @param {Position | undefined} source 
         * @param {string} action
         * @param {object | number} tree
        */
        constructor(game, source, action, tree) {
            super();
            this.game = game;
            this.source = source;
            this.action = action;
            this.tree = tree;
            this.depth = (source?.depth ?? -1) + 1;
            if (typeof tree === "number") {
                this.score = tree;
                this.terminal = true;
            } else {
                this.score = 0;
                this.terminal = false;
            }
        }
    
        getId() {
            if (!this.source) return "";

            let sourceId = this.source.getId();
            if (sourceId === "") return this.action; 

            return `${sourceId}-${this.action}`;
        }
    
        /** @param {CanvasRenderingContext2D} ctx */
        render(ctx) {
            // no rendering
        }

        isTie() {
            return this.terminal && this.score === 0;
        }
    
        isTerminal() {
            return this.terminal;
        }
        getScore() {
            return this.score;
        }
        getPlayer() {
            return this.depth % 2 === 0 ? 1 : -1;
        }
    }
    
    class CustomGame extends GameBase {
        constructor(tree) {
            super();
            this.initialPos = new Position(this, undefined, "", tree);
        }
        get properties() {
            return [];
        }
        setProp(name, value) {
            switch (name) {
                default:
                    return false;
            }
        }
    
        getInitialPosition() {
            return this.initialPos;
        }
    
        /** @param {Position} position */
        getActions(position) {
            if (position.isTerminal()) return [];
            return Object.keys(position.tree).map(k => {
                return {"name": k}
            })
        }
    
        /** @param {Position} position */
        getResult(position, action) {
            return new Position(this, position, action.name, position.tree[action.name])
        }
    }

    return new CustomGame(tree);
}