# TeamRescue

A frontend-only group-project recovery simulator for college students. Built with **React 19, Vite 6, Tailwind CSS 4, React Flow (@xyflow/react), and Lucide icons**. No backend, account, API key, or AI service is required. All data and calculations stay in the browser.

## Run locally

Install Node.js **24 LTS** and npm, then open a terminal in this directory. The project pins Node 24 so Vercel uses the same major version:

```sh
npm install
npm run dev
```

Open the Local URL printed by Vite, normally **http://127.0.0.1:5173**. To expose a preview to other devices on your own network, use `npm run dev -- --host 0.0.0.0`.

```sh
npm test          # All logic and DOM interaction tests; no browser required
npm run test:logic # Scheduling and reassignment invariants only
npm run test:ui    # Forms, demo, comparison, storage, and print action
npm run build    # Production bundle in dist/
npm run preview  # Serve that bundle locally, normally port 4173
```

After dependencies are installed, running, testing, and building require no external API. The application loads no remote fonts, images, scripts, or analytics. Browser storage is scoped to the exact origin, so the development URL and a deployed URL have separate progress. Keep the same local URL to return to saved work.

## Try it

1. **Try a demo scenario** replaces the current project with Campus Connect, marks frontend lead Alex unavailable, and generates a recovery plan in one click. Interface design moves to Priya, the React dashboard moves to Jordan, and Analytics charts remains blocked because Alex is the only data visualization specialist.
2. In **Your team**, click a name to edit skills, role, or total available hours. Use **+** to add teammates. The availability switches simulate someone dropping out. The original dependency map highlights affected tasks and their descendants in amber.
3. Click **Add task** to set all required skills, effort, deadline, original owner, and prerequisite tasks. Click any map card or task row to edit it. Cycles and missing prerequisites are rejected. Deleting a task removes references to it; deleting a teammate clears their original assignments.
4. **Generate recovery plan** evaluates a new suggestion. Switch between **Original** and **Recovery**, inspect the playbook, or open **Compare plans** for every ownership change and blocked reason. Editing project data invalidates the prior suggestion so it cannot silently become stale.
5. **Export plan** opens the browser print dialog with a dedicated landscape report containing both owners, deadlines, hours, capacity, and blocked-task explanations. Choose **Save as PDF**, or print to paper. When no recovery plan exists, the report contains the original plan.

Progress saves automatically to `localStorage` under `teamrescue.v1`, including whether a recovery plan was generated. Reloading regenerates the same deterministic suggestion from the saved inputs. The interface warns if storage is unavailable. Invalid or incompatible saved data falls back to the sample. Clearing browser data removes saved work. **Reset sample** asks before replacing your project. The demo also replaces it; use it before entering your own data.

## Scheduling model

- Teammate hours are **total project capacity**, not weekly hours. Every required skill must be present on one available teammate; skill matching is case insensitive. Tasks are not split between people.
- The planning start date is editable by clicking the project card in the sidebar. Sample dates are generated relative to the current local date. Deadlines are inclusive calendar dates.
- Each teammate can do at most **4 work hours per calendar day**, including weekends, up to their total available project hours. Fractional effort and capacities use half-hour increments in the forms.
- Dependencies must finish before dependent work starts; teammates cannot work on two tasks at once. The model uses a continuous work-hour timeline where each date represents a 4-hour work block. It does not model meetings, holidays, changing daily availability, task completion state, or real-time collaboration.
- The deterministic planner explores candidate owners in a topological, deadline-prioritized task order. It maximizes the number of scheduled tasks, then minimizes ownership changes. Original owners are tried first. Available skills, total capacity, dependencies, and deadlines are enforced for every returned assignment.
- Search is bounded to **40,000 states** with at most **40 tasks and 30 teammates**. It explores ownership choices, not every possible task ordering. A suggestion is feasible but is **not guaranteed globally optimal**. When the state limit is reached, the interface says so. A blocked task means it could not fit the suggested schedule; it is not proof that every alternative ordering is impossible.
- Blocking explanations distinguish unavailable skill combinations, insufficient qualified capacity, deadlines, and blocked prerequisites. Try adding a teammate/skill, adjusting capacity, or changing deadlines, then regenerate.

The pure calculation module is `src/engine.js`; UI and browser persistence live in `src/App.jsx`. Tests cover the demo, all-skill matching, hour limits, no overlapping work, deadlines, dependent blocking, empty inputs, storage validation, determinism, and varied scenario invariants. Vitest, jsdom, and Testing Library exercise the actual React forms, availability switches, comparison view, invalidation of stale plans, storage failures, reload hydration, search, reset, and the print action.

### Verification limits

The production build and 27 automated logic/DOM tests run locally. The Vite development server starts successfully, and the built HTML, JavaScript, and CSS return HTTP 200 in a local preview. The Vercel deployment is tested in a browser for the demo, recovered and blocked tasks, original/recovery comparison, teammate creation, dependent task creation, search, and persistence after reload. Desktop and mobile layouts are inspected. The final browser print-preview layout has not been visually verified; the print action and report contents are covered by DOM tests. A regression test covers resetting a custom recovered team to the demo without rendering stale teammate references.

## Deploy to Vercel with source on GitHub

TeamRescue is a static SPA. No server functions, database, environment variables, secrets, or paid services are needed. GitHub hosts the source repository; **Vercel hosts the live website**. GitHub Pages is not used.

1. Push this directory's contents to the GitHub repository root. Commit `package-lock.json`, application source, tests, and `vercel.json`. Do not commit `node_modules`, `dist`, `.vercel`, or secrets.
2. Sign in to Vercel and choose **Add New → Project → Import Git Repository**. Connect GitHub and select the TeamRescue repository. Grant access only to that repository when prompted.
3. Keep the **Root Directory** at the repository root and select the **Vite** framework preset. `vercel.json` declares `npm ci` for installation, `npm run build` for the production build, and `dist` for output. Use Node.js 24 in Project Settings → Build and Deployment.
4. Click **Deploy**. Wait until the deployment is **Ready**, then open its production `.vercel.app` URL. Future pushes to the production branch trigger production builds; other branches generate previews.
5. Verify **Try a demo scenario** produces seven schedulable tasks, two ownership changes, and the Analytics charts skill-gap warning. Add a teammate or task, reload to check persistence, compare plans, and choose **Export plan → Save as PDF**.

Before every release, run `npm ci`, `npm test`, and `npm run build`. If a Vercel build fails, inspect its build logs and check the selected root directory, Node version, and committed lockfile before retrying. No environment variables are required.

There is no client-side URL router, so no SPA redirect rule is necessary. Vite uses relative asset paths (`base: './'`). Serve `dist/index.html` over HTTP(S), rather than opening it with a `file://` URL. Local Vite servers are for development or verification; Vercel serves production.

## Accessibility and responsive behavior

Keyboard-operable forms, labeled availability switches, a task-list alternative to the dependency graph, semantic tables, visible focus states, reduced-motion support, responsive navigation, and dedicated print styles are included. Map cards open task editors; the map can be zoomed or expanded. Statuses use words as well as color.
