# Clairvoyant - AI Visualization

The Next.js application powering [clairvoyantapp.me](https://clairvoyantapp.me).

## Problems

| Tab | Route | Algorithm |
|-----|-------|-----------|
| Graph Search | `/problems/graph-search` | BFS, DFS, UCS, A\* |
| Adversarial Search | `/problems/adversarial-search` | Minimax |
| Red-Black Tree | `/problems/red-black-tree` | CLRS RB-INSERT / RB-DELETE |
| Single Source Shortest Paths | `/problems/single-source-shortest-path` | CLRS Dijkstra |

## Project structure

- `app/` -- Next.js App Router pages and API route handlers
- `app/api/v1/` -- API routes that serve algorithm and case data from `data/problems/`
- `app/components/controls/` -- Shared UI controls (DebugStepper, WatchPanel, CaseTracker, PriorityQueuePanel)
- `lib/` -- Shared utilities, graph logic, and algorithm implementations
  - `lib/rbt/` -- Red-Black Tree data structure, solution base, layout engine, annotation system
  - `lib/dijkstra/` -- Dijkstra solution base (`DijkstraStep`, `DijkstraSolutionBase`, `buildDijkstraSolution`)
  - `lib/graphs/` -- Generic / Grid graph data model and graph-search solution base
- `data/problems/` -- Static problem data (algorithms and test cases)

### Adding a new visualization

1. Add an entry to `lib/statics/appConstants.tsx` (`PROBLEMS` constant).
2. Create `data/problems/<id>/algorithms/<name>.js` — CLRS-style pseudocode using visualization methods.
3. Create `data/problems/<id>/algorithms/<name>.annotations.json` — per-line annotations.
4. Create `data/problems/<id>/cases/*.txt` — test cases in the graph notation format.
5. Create `app/problems/<id>/page.tsx` mirroring the RBT or SSSP page pattern.
6. Optionally create a custom view component under `app/problems/<id>/components/`.

## Development

```bash
npm install
npm run dev
```

## Deployment

Deployed to Vercel with the root directory set to `ai-visualization/`. Pushes to the main branch trigger automatic deployments.
