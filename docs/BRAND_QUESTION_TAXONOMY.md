# Brand Question Taxonomy

NiubiGEO classifies only questions that directly concern the product or service represented by the submitted domain. The Provider performs semantic classification. Local code validates the returned schema and evidence; it does not classify free text with keyword lists or product-specific branches.

## Decision dimensions

The taxonomy is multi-label. Each intent is judged independently because a single question may request several outcomes.

| Intent | Required user outcome | Boundary |
| --- | --- | --- |
| `product_understanding` | Explain what the target is, does, or how it works | Description alone is not evaluation, fit, or choice |
| `brand_evaluation` | Judge whether the target is suitable, worthwhile, appropriate, or worth considering for a stated need | Describing the audience alone is `product_fit`; asking what to choose or adopt is also `purchase_decision` |
| `recommendation` | Propose one or more options involving the target | Evaluating one named target does not automatically request a list of recommendations |
| `comparison` | Explain differences or tradeoffs between the target and alternatives | Co-occurrence without requested comparison is insufficient |
| `alternative` | Establish which product can replace another | Comparison does not automatically establish replacement |
| `pricing` | Explain price, plans, billing, quotas, or cost limits | Operational constraints are `adoption` unless they affect price or entitlement |
| `product_fit` | Identify which users, teams, needs, or use cases fit the target | It describes fit conditions; it may coexist with `brand_evaluation`, but does not itself request a choice |
| `product_usage` | Explain how to use the target or what to inspect while using it | Usage is distinct from deciding whether to adopt |
| `purchase_decision` | Decide whether or which option to choose, buy, migrate to, or adopt | Audience fit is `product_fit`; a worth judgment without a requested choice is `brand_evaluation` |
| `risk_evaluation` | Identify or weigh security, compliance, dependency, migration, limitation, or other downside risks | Neutral constraints are not risks unless their downside matters to the decision |
| `adoption` | Explain prerequisites, limits, migration effects, or implementation implications | Choosing is `purchase_decision`; weighing downside exposure is `risk_evaluation` |
| `source_analysis` | Identify evidence or sources supporting claims about the target | A normal factual question does not imply source analysis |

## Fit, evaluation, and choice

These three labels answer different questions:

```text
product_fit       -> Who or what situation fits the product?
brand_evaluation  -> Is the product suitable or worth considering for this need?
purchase_decision -> Should the user choose, buy, migrate to, or adopt it?
```

They can coexist when the user explicitly requests more than one outcome. The classifier must not select only the nearest label and suppress the others.

## Validation contract

A minimum valid result contains:

```json
{
  "domainMatched": true,
  "targetBrand": "Identified brand",
  "intents": ["product_understanding"]
}
```

All other explanatory fields are optional. Missing optional fields must not terminate the audit. A question rejected before the answer request must receive no answer-model call.

## Stable monitoring applicability

Monitoring metrics must not decide their denominator from an answer that can vary between runs. Before a baseline can run, every enabled question receives a Provider-generated `PromptIntentProfile`:

```json
{
  "intents": ["brand_evaluation", "purchase_decision"],
  "candidateApplicable": true,
  "recommendationApplicable": false,
  "status": "completed"
}
```

This profile is part of the immutable baseline and its comparable key. The answer analysis may explain what a particular model returned, but it cannot change whether the question belongs in the candidate or recommendation denominator.

The boundary remains:

- `product_fit` asks who or which situation fits the product;
- `brand_evaluation` asks whether the product is suitable or worth considering;
- `purchase_decision` asks whether the user should choose, buy, adopt, or migrate;
- `candidateApplicable` means the question requires the target to be considered among options;
- `recommendationApplicable` means the question requires an explicit recommendation or decision.

Questions, languages, brands, and industries receive the same Provider-based classification path. Local code only validates the returned schema and joins results by immutable question ID.
