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
- English remains the fallback for any missing Brazilian Portuguese copy.
- The existing localization mechanism remains the maintenance boundary for this contribution.
- Historical case content and the complete documentation archive are outside this change.

## Design

Extend the existing `zh` and `en` localization paths with an explicit `pt-BR` locale. Reuse the current translation catalogs and helper functions rather than introducing a new i18n framework. Locale selection must keep the current default and persist/submit `pt-BR` using the same flow as the existing choices.

User-facing product copy and generated human-report copy receive Brazilian Portuguese entries. Language-dependent model instructions recognize `pt-BR` and request Brazilian Portuguese output. Missing localized copy falls back to English so the new locale cannot render undefined labels.

Focused tests cover locale selection, submitted language, representative interface strings, report language metadata, and representative report copy. Existing build and test suites provide regression coverage for Chinese and English.

In the active product UI, only application-owned copy marked with `data-product-i18n` is translated, and only its direct text nodes are considered. Attribute translations opt in separately with `data-product-i18n-aria-label`, `data-product-i18n-placeholder`, or `data-product-i18n-title`. Keep user names, provider responses, keywords, source titles, and evidence highlights unmarked; mark a missing-value fallback separately from real data. Dynamic updates use the same boundary.

Run `npm run test:localization-browser` for the browser regressions. They check verbatim evidence and user data, dynamic interface translations, and persisted project language through both the overview and continuous-measurement creation forms. The tests use local fixtures and temporary storage without calling model providers. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` only when using an existing Chromium installation instead of Playwright's managed browser.

## Decision log

1. **Add a third locale instead of replacing Chinese.** The community keeps all current audiences while adding Brazilian Portuguese.
2. **Extend the current localization mechanism.** A new i18n framework would make the contribution larger and harder to review without delivering additional current value.
3. **Use `pt-BR` as the locale identifier.** This distinguishes Brazilian Portuguese and matches the requested language variant.
4. **Keep English as fallback.** It prevents missing strings from breaking the interface while preserving the current default behavior.
5. **Exclude historical content and infrastructure.** The contribution remains focused on the product experience and generated reports.
