# NiubiGEO Motion Design System

## Purpose

Motion in NiubiGEO communicates state, progress, evidence, and failure. It must never invent activity or hide incomplete data.

The global interaction contract is:

```text
Click has feedback.
Waiting shows real progress.
Success is confirmed.
Failure has an inline recovery path.
Charts move only when evidence forms a valid series.
```

## Interaction States

Every asynchronous command uses the shared motion controller and the following state model:

```text
idle -> loading -> success
                -> error -> retry
idle -> disabled
```

Hover and keyboard focus are presentation states around the same command. Pressed feedback is applied immediately and never waits for a network response.

Timing requirements:

| Interaction | Duration |
| --- | ---: |
| Pressed feedback | 80 ms |
| Hover and focus feedback | 140 ms |
| Content entrance | 160 ms |
| Drawer transition | 200 ms |
| Chart update | 300 ms |
| Initial chart draw | 650 ms |
| Success confirmation | 800 ms |

An asynchronous button enters `loading` synchronously, keeps a stable minimum width, sets `aria-busy`, becomes disabled, and rejects duplicate activation. After three seconds its label changes to the current execution stage. Failure restores an enabled retry action and adds a persistent error beside the affected control.

## Command Types

### Navigation

The selected navigation item changes immediately. The sidebar, project selector, and global filters stay mounted while only the content view transitions. Scroll positions are retained per view.

### Save And Update

Save commands use `loading`, `success`, and `error` states. Errors remain next to the relevant form or task card until the user retries or starts another action.

### Audit Runs

Audit runs use an asynchronous job endpoint. Progress comes from the real runner lifecycle:

```text
Preparing questions
Calling providers by model
Building the result
Saving the result
Completed or failed
```

Each model row shows completed and failed Observation counts against its planned count. The progress bar is derived from those counts and is not timer-driven.

### Destructive Commands

Destructive commands require confirmation before the request starts. Deletion is not optimistic. The command then displays deleting, deleted, or a persistent retryable failure.

### Switches

Binary state uses a switch control. The thumb moves immediately, the server update begins in the same interaction, and a failed request restores the previous state before displaying the error. The switch exposes `role="switch"`, `aria-checked`, `aria-busy`, focus feedback, and disabled state.

## Chart Motion Contract

Chart animation is applied after data qualification, never before it.

Every line, including the main trend, brand comparison, and metric sparklines, must pass the shared `seriesDrawable()` gate. A drawable line requires:

- one project;
- one immutable baseline;
- one metric with its own denominator;
- at least two valid time points;
- comparable Observation identities;
- evidence changes for every adjacent pair;
- no partial, failed, or analysis-incomplete run.

If those conditions fail, the UI renders an explanatory empty state and no SVG trend path.

### Initial Draw

1. Axes become visible in 120 ms.
2. Each real SVG path uses its runtime `getTotalLength()` value and draws from left to right in 650 ms.
3. Data points appear in order with a 30 ms interval.
4. Legends, definitions, and evidence summaries appear last in 160 ms.

No path length, point, metric, or trend is fabricated for animation.

### Data Update

Before a model, search, project, metric, or period update, the current geometry is captured and the old lines move to 40 percent opacity. When the response arrives, paths with compatible point identities interpolate to the new coordinates in 300 ms. The page and chart container remain mounted.

### Data Point Evidence

Each visible point has a minimum 24 by 24 pixel interaction target. Hover or focus enlarges the visible point, shows a vertical reference line and tooltip, and reduces unrelated series opacity. Selecting a point produces one short pulse and opens the evidence drawer.

The drawer contains the numerator and denominator, comparison status, added, persistent, and removed Observations, question, model, source, and the corresponding answer evidence.

## Accessibility And Performance

- Keyboard focus has the same visual clarity as hover.
- Drawers restore focus to the control that opened them.
- Progress uses `aria-live`; controls use `aria-busy` and native disabled behavior.
- Motion primarily changes transform, opacity, background color, and border color.
- Reduced-motion preferences lower all animation and transition durations to the minimum.
- Motion cannot delay access to data or turn missing data into zero.

## Architecture Boundaries

- `src/ui/motion-runtime.ts` owns shared browser interaction behavior.
- `src/ui/workbench-style.ts` owns state visuals and timing tokens.
- `src/jobs/async-job-registry.ts` owns in-memory asynchronous job state.
- `src/runner/audit-progress.ts` defines provider-run progress snapshots.
- `AuditRunner` emits real Observation progress.
- `RunOrchestrator` persists run progress and forwards snapshots.
- `src/server.ts` exposes job creation and polling endpoints.
- View renderers provide data and evidence only; they do not invent progress or comparison results.

The implementation contains no local text-pattern classifier, regular expression, language keyword branch, brand branch, or product-specific animation rule.

## Verification

The automated contract checks:

- every global UI state and timing;
- stable async button behavior;
- switch rollback support;
- real SVG path length measurement;
- request-animation-frame chart morphing;
- evidence point interaction;
- long-run progress endpoints;
- reduced-motion and keyboard focus;
- no browser alerts for asynchronous failures;
- all chart renderers use the comparable-evidence gate;
- all first-party code and generated browser code contain no regular expressions;
- production semantics contain no target-specific branches.

