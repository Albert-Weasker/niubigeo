# Security Policy

NiubiGEO Community Edition is a self-hosted tool that uses user-provided AI provider keys.

## Supported Versions

The current public target is:

```text
v0.1.0-alpha
```

Alpha versions are not considered stable for production environments.

## Secrets

Never commit:

- `.env`
- Provider API keys
- Customer domains or private prompts
- Generated reports containing sensitive data
- Local run directories with private evidence

Use `.env.example` for documentation only.

## Provider Key Handling

Provider keys must remain provider-specific:

- `OPENROUTER_API_KEY` calls OpenRouter only.
- `OPENAI_API_KEY` calls OpenAI only.
- `ANTHROPIC_API_KEY` calls Anthropic only.
- `GEMINI_API_KEY` calls Google Gemini only.
- `PERPLEXITY_API_KEY` calls Perplexity only.
- `DEEPSEEK_API_KEY` calls DeepSeek only.

OpenRouter-routed results must still be labeled as OpenRouter API results.

## Reporting A Vulnerability

For now, report vulnerabilities privately to the repository maintainers.

Please include:

- A short description.
- Affected version or commit.
- Steps to reproduce.
- Whether secrets, provider keys, or generated reports can be exposed.

Do not open a public issue for active key leakage or customer-data exposure.
