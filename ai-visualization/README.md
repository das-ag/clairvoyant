# Clairvoyant - AI Visualization

The Next.js application powering [clairvoyantapp.me](https://clairvoyantapp.me).

## Project structure

- `app/` -- Next.js App Router pages and API route handlers
- `app/api/v1/` -- API routes that serve algorithm and case data from `data/problems/`
- `lib/` -- Shared utilities, graph logic, and constants
- `data/problems/` -- Static problem data (algorithms and test cases)

## Development

```bash
npm install
npm run dev
```

## Deployment

Deployed to Vercel with the root directory set to `ai-visualization/`. Pushes to the main branch trigger automatic deployments.
