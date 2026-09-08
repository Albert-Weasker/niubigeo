# Phase 5 Measurement Architecture

## Boundary

Phase 5 measures two independent observation protocols.

`domain-recognition/v1` receives exactly one domain. It records what one
model says it can establish about that domain. It never receives website
content, another model's response, a competitor list, or a keyword list.

`keyword-discovery/v1` receives one frozen neutral keyword and a neutral
product-selection scenario. It does not receive the monitored objects,
their aliases, their domains, or a desired answer list. Its structured result
records every identified object in the returned answer, including objects not
in the WatchSet.

The two protocols are stored, filtered, and charted independently. A domain
recognition result is not evidence of unaided keyword discovery.

## Durable hierarchy

```text
Project
  Monitoring configuration (immutable model snapshot)
  WatchSet version (immutable objects, keywords and protocol snapshot)
  MeasurementRun
    MeasurementModelRun
      ProbeRun
        ProbeAttempt
          protocol result + raw Provider response + raw answer
```

Each `ProbeRun` owns its own attempt list. Retrying a failed probe appends an
attempt and leaves its first attempt untouched. Trend snapshots use the first
attempt for each planned probe, so retries never enlarge a sample.

## Continuity

A plotted series has one probe fingerprint. The fingerprint contains the
provider/model route, search mode, protocol, language, scenario, subject,
sampling rule, generation parameters, matching-rule version, and the keyword
set when relative keyword weight is shown. Unrelated model additions and
removals do not alter another model's fingerprint.

## Evidence rules

Every aggregate point carries its planned probes, included attempts, numerator
attempts, denominator attempts, exclusions, and the exact raw attempt ids.
Provider citations stay separate from URLs merely written in an answer.
Offline samples have no applicable citation denominator.

## Scheduling

Manual and scheduled starts use the same MeasurementRun service. A scheduler
creates a durable occurrence keyed by task id and scheduled UTC time before it
creates a run. It skips missed occurrences, does not overlap a running task,
and records an unknown request state instead of blindly retrying after a
crash. Budget reservations are durable and remain reserved when Provider cost
is unknown.
