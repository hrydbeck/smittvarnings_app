# Docker alternatives and recommended patterns

This document describes the different ways to run the components (watcher, conversion, ReporTree) using Docker and Docker Compose and how they differ.

## Two common approaches

1. Docker Compose (recommended for local multi-service flows)

- Use `docker compose up` to start multiple services (watcher, ReporTree service, etc.).
- Advantages:
  - Declarative: the compose file describes services, volumes, networks and environment.
  - Easy to run multi-container stacks and logs: `docker compose logs -f`.
  - Can set `user: "${LOCAL_UID}:${LOCAL_GID}"` in the service definition so containers create files with your host UID/GID.
  - Good for reproducible local dev environments and demos.
- Typical use:

```bash
LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) docker compose up -d --build watcher reportree-service
```

Notes:

- Compose is ideal when the watcher needs a helper service such as ReporTree running as a service container (for example when ReporTree requires a long-lived container or when you want to expose multiple services).
- Keep an eye on `LOCAL_UID`/`LOCAL_GID` (or set them in `.env`) to avoid root-owned files.

2. One-off `docker run` or `docker compose run --rm` (recommended for single-shot or CI)

- Use `docker run --rm` for single commands (e.g., run ReporTree for a single pair of profile+metadata). The project's one-shot runner scripts launch `docker run` inside the runner so the logic is encapsulated.
- Advantages:
  - Simple and explicit for single tasks.
  - Good for CI when you want to run a job and then exit.
  - `--user $(id -u):$(id -g)` avoids root-owned files.
- Typical single-run example (from `docs/USAGE.md`):

```bash
docker run --rm -v $(pwd)/intermediate_files:/data -w /data --user $(id -u):$(id -g) \
  insapathogenomics/reportree reportree.py -m /data/profiles_for_reportree/s_aureus/<metadata> \
  -a /data/profiles_for_reportree/s_aureus/<profile> -out /data/clusters/s_aureus/<label> \
  --analysis grapetree --method MSTreeV2 -thr 10
```

## Differences and trade-offs

- State & lifecycle:

  - Compose is service-oriented (longer-running). Services stay up and can respond to new files.
  - `docker run` is task-oriented (short-lived) and exits after completion.

- File ownership & permissions:

  - Compose: set `user:` in the service or pass `LOCAL_UID`/`LOCAL_GID` to avoid root ownership of volumes.
  - `docker run`: pass `--user $(id -u):$(id -g)`.

- Logging & debugging:

  - Compose makes it easy to follow logs for multiple services.
  - `docker run` prints output to the terminal (or CI logs) and then exits.

- CI suitability:
  - Use `docker run --rm` (or `docker compose run --rm`) in CI pipelines for single-shot steps, so jobs terminate and can be timed out.
  - For integration tests, you may start a compose stack, run tests against it, then bring it down.

## Running the watcher: container vs host

- Two choices:

  - Run the Node watcher inside a container (compose service) — keeps the runtime similar to production and isolates dependencies.
  - Run the watcher on the host (Node installed locally) — convenient for quick debugging and stepping through code with an editor.

- If you run the watcher in a container, ensure the container has access to the `jasen_out/` and `intermediate_files/` volumes (bind mounts) and that the container writes files as your host UID.

## Practical tips

- Prefer Compose for local multi-service workflows and demos.
- Prefer `docker run --rm` for CI or scripted single-run tasks (one-shot runners already use this pattern).
- Set `LOCAL_UID`/`LOCAL_GID` when using compose to avoid owning files as root:

```
LOCAL_UID=$(id -u)
LOCAL_GID=$(id -g)
docker compose up -d --build watcher reportree-service
```

- If you need to debug inside the container, start the service then `docker compose exec watcher /bin/bash` (or `sh`) and inspect logs and files.

## Example patterns used in this repo

- Watchers (long-running) are implemented as Node scripts under `bin/` and can run inside a container or on the host.
- One-shot runners are implemented to call `docker run` directly so they work consistently in CI and local runs.

If you'd like, I can add a short example `docker-compose.override.yml` and a small `Makefile` with convenience targets (start, stop, demo, verify) to make local workflows even simpler. Let me know which you'd prefer.
