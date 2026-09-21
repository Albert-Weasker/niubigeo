# Brazilian Portuguese localization

## Understanding

- Add Brazilian Portuguese as a third product language.
- Preserve the existing Simplified Chinese and English experiences.
- Expose `pt-BR` in the language selector without changing the global default.
- Translate user-facing interface copy, operational messages, and generated human reports.
- Preserve technical terms when translating them would reduce precision.
- Do not change business rules, persistence, providers, workers, or model execution.
- Document the new language in the main project documentation.

## Assumptions

- Localization has no material performance or scale impact.
- No new sensitive data is introduced.
- Missing Brazilian Portuguese interface copy is a test failure; the UI must never fall back to English or Chinese while `pt-BR` is selected.
- The existing localization mechanism remains the maintenance boundary for this contribution.
- Historical case content and the complete documentation archive are outside this change.

## Design

Extend the existing `zh` and `en` localization paths with an explicit `pt-BR` locale. Reuse the current translation catalogs and helper functions rather than introducing a new i18n framework. Locale selection must keep the current default and persist/submit `pt-BR` using the same flow as the existing choices.

User-facing product copy and generated human-report copy receive Brazilian Portuguese entries. Language-dependent model instructions recognize `pt-BR` and request Brazilian Portuguese output. Missing localized copy falls back to English so the new locale cannot render undefined labels.

Focused tests cover locale selection, submitted language, representative interface strings, report language metadata, and representative report copy. Existing build and test suites provide regression coverage for Chinese and English.

In the active product UI, translation is opt-in: `data-product-i18n` marks direct application-owned text nodes, and separate attribute markers identify accessible labels, placeholders, and titles. Nested unmarked text and all raw-answer containers remain verbatim. For mixed labels and data, renderers translate only the application-owned fragment before interpolating escaped names, domains, model identifiers, or evidence. Dynamic updates use the same catalog and boundary.

The Brazilian Portuguese browser suite checks actual product sections with Latin fixture data and fails if interface Han characters remain visible. Separate collision fixtures verify that Chinese names and provider evidence remain exactly unchanged in all three locales. Representative translated labels are asserted explicitly.

Run `npm run test:localization-browser` for the browser regressions. They check verbatim evidence and user data, dynamic interface translations, and persisted project language through both the overview and continuous-measurement creation forms. The tests use local fixtures and temporary storage without calling model providers. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` only when using an existing Chromium installation instead of Playwright's managed browser.

## Decision log

1. **Add a third locale instead of replacing Chinese.** The community keeps all current audiences while adding Brazilian Portuguese.
2. **Extend the current localization mechanism.** A new i18n framework would make the contribution larger and harder to review without delivering additional current value.
3. **Use `pt-BR` as the locale identifier.** This distinguishes Brazilian Portuguese and matches the requested language variant.
4. **Keep English as fallback.** It prevents missing strings from breaking the interface while preserving the current default behavior.
5. **Exclude historical content and infrastructure.** The contribution remains focused on the product experience and generated reports.
6. **Make ownership explicit across the active interface.** Extend opt-in markers to dynamic screens and use full-page coverage tests to catch missing UI copy without applying translation to arbitrary data.
7. **Preserve data, not interface fallbacks.** Proper names and provider content remain verbatim; every product-owned label must have an explicit `pt-BR` entry.

Model-manager regressions cover all three locales, live selection counts, filters, preserved model identities, and saved selections. Desktop and mobile hit tests verify that dialogs remain within the viewport and their action buttons are not covered by the language selector or advisor.
