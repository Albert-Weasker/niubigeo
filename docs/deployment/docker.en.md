# Docker deployment

[中文](docker.md)

## Run the published release

NiubiGEO v0.3.1 supports Linux amd64 and arm64. Start the workbench with a persistent named volume:

```bash
docker pull ghcr.io/albert-weasker/niubigeo:v0.3.1
docker run -d --name niubigeo \
  -p 127.0.0.1:8787:8787 \
  -e OPENROUTER_API_KEY \
  -v niubigeo-data:/app/data/product-v2 \
  ghcr.io/albert-weasker/niubigeo:v0.3.1
```

Open <http://localhost:8787>. Set `OPENROUTER_API_KEY` in your shell before starting the container, or connect a provider using a platform logo in the workbench. Browser keys are temporary and cannot be used by the separate worker.

For scheduled runs, start a worker with the same image, server-side key and data volume. Due runs incur API charges.

```bash
docker run -d --name niubigeo-worker --no-healthcheck \
  -e OPENROUTER_API_KEY \
  -v niubigeo-data:/app/data/product-v2 \
  ghcr.io/albert-weasker/niubigeo:v0.3.1 \
  node dist/src/product/scheduling/schedule-worker.js 60
```

## Docker Compose

From the repository directory, pull the pinned published image and start without a local build:

```bash
docker compose pull
docker compose up --no-build -d niubistar-geo
# Optional: enable scheduled monitoring
docker compose --profile monitoring up --no-build -d niubigeo-worker
```

Both services use v0.3.1. To run changes from your checked-out source instead, use `docker compose up --build -d niubistar-geo`; rebuild the worker as well if enabled. Unreleased source fixes are not retroactively added to the published v0.3.1 image.

Compose binds `./data` on the host to `/app/data`; product data lives in `./data/product-v2`. The standalone commands above instead use the named volume `niubigeo-data` mounted directly at `/app/data/product-v2`. These are alternative storage arrangements, not the same storage. Use one arrangement consistently for the server and worker. When switching, stop both services and explicitly back up and migrate the product data.

## Upgrade and access

Back up the complete product data directory before upgrading, including project configuration, baselines, runs, evidence and schedules. Do not delete the data volume during an upgrade. See the [backup and upgrade guide](../upgrade.md).

The workbench does not provide built-in authentication. Published ports above bind to localhost; remote deployments need authentication and TLS at the reverse proxy or deployment boundary. Do not put keys in source control or image build arguments.

For recorded deployment limitations and historical verification details, see the [Chinese deployment reference](docker.md).

Docker `v0.3.0` is a compatibility alias for the verified v0.3.1 image; its package/OCI version is v0.3.1. Pull and recreate existing containers to update. The original Git tag is unchanged.
