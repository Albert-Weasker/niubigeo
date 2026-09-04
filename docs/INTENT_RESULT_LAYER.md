# Intent Result Layer

NiubiGEO's domain audit flow stays unchanged:

```text
domain
-> generated or confirmed questions
-> Provider execution
-> AI answer and citations
```

The Intent Result Layer runs after each completed Provider answer:

```text
PromptRun.result
-> Intent Analyzer
-> Task Decomposer
-> Answer Assessor
-> Entity Relationship Analyzer
-> Result Adapter
```

This layer answers one question:

```text
What did the user ask for, and how much did the AI answer satisfy it?
```

It must not force every answer into a brand-competition template.

## Design Rules

- The AI Provider judges intent, tasks, task completion, and entity relationships.
- Local code validates schema, filters invalid evidence, and stores structured output.
- Entity co-occurrence is not a competition signal.
- An entity must have an explicit relationship such as `recommended_option`, `channel`, `direct_alternative`, or `unrelated`.
- Evidence quotes must come from the actual AI answer text.
- Source URLs must come from Provider-returned citations.
- If intent, task completion, or entity relationship is unclear, the layer records uncertainty instead of guessing.
- No brand, industry, language, or test-domain special cases.
- New intent-layer code must not use regular expressions.

## Stored Shape

Each `PromptRun` can include:

```ts
intentAnalysis?: IntentRunAnalysis
```

Core structure:

```ts
IntentRunAnalysis {
  schemaVersion: "intent-v1"
  promptIntent: IntentAnalysis
  tasks: AnswerTask[]
  taskResults: TaskAssessment[]
  entities: EntityRelationship[]
  adaptedResult: IntentReportCard
  analyzer: {
    providerId: string
    model: string
    sourceLabel: string
  }
  status: "completed" | "failed"
}
```

## Display Modes

The report adapter chooses a display mode from the primary intent:

| Intent | Report focus |
|---|---|
| `recommendation` | Recommended options, reasons, whether the target was included |
| `comparison` | Compared objects, dimensions, and conclusion |
| `alternative` | Alternative options and whether the relationship is explicit |
| `brand_evaluation` | Attitude, reasons, concerns |
| `fact` | Core answer, key facts, sources |
| `pricing` | Price, plan limits, source confidence |
| `tutorial` | Steps, prerequisites, risk |
| `troubleshooting` | Cause, fix, risk |
| `source_finding` | Sources and credibility |
| `industry_research` | Market participants and categories |
| `risk_assessment` | Risk conclusion, reasons, uncertainty |
| `open_exploration` | Main takeaways and open questions |
| `mixed`, `unclear`, `other` | Task completion and uncertainty |

## Acceptance

A reader opening one AI answer should see:

- what the user asked;
- what the AI answered;
- what the AI missed;
- what each named entity is doing in the answer;
- which conclusions have evidence;
- which parts remain uncertain.
