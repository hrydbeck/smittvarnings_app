# Makefile — handy shortcuts for local dev and demos

LOCAL_UID ?= $(shell id -u)
LOCAL_GID ?= $(shell id -g)
COMPOSE := docker compose

.PHONY: help build up up-detach down logs demo verify reset chown exec

help:
	@echo "Makefile targets:"
	@echo "  make build           - build images used by docker compose"
	@echo "  make up              - start compose services (attached)"
	@echo "  make up-detach       - start compose services detached (recommended)"
	@echo "  make down            - stop and remove compose services"
	@echo "  make logs            - follow compose logs"
	@echo "  make demo            - run demo (scripts/run_demo_initial_then_additional.sh)"
	@echo "  make verify          - run verify_initial.sh (adjust to verify_additional if needed)"
	@echo "  make reset           - reset workspace (careful: may remove intermediate files)"
	@echo "  make chown           - fix ownership of intermediate files"
	@echo "  make exec SERVICE    - exec into a running service (e.g. SERVICE=watcher)"

build:
	$(COMPOSE) build

up:
	LOCAL_UID=$(LOCAL_UID) LOCAL_GID=$(LOCAL_GID) $(COMPOSE) up

up-detach:
	LOCAL_UID=$(LOCAL_UID) LOCAL_GID=$(LOCAL_GID) $(COMPOSE) up -d

down:
	$(COMPOSE) down --remove-orphans

logs:
	$(COMPOSE) logs -f

demo:
	@echo "Running demo script (initial then additional)"
	chmod +x scripts/run_demo_initial_then_additional.sh || true
	./scripts/run_demo_initial_then_additional.sh

verify:
	@echo "Running verify_initial.sh"
	chmod +x scripts/verify_initial.sh || true
	./scripts/verify_initial.sh

reset:
	@echo "Resetting workspace (this may remove intermediate files)."
	sh scripts/reset_workspace.sh --wipe

chown:
	sudo chown -R $(shell id -u):$(shell id -g) intermediate_files jasen_out logs || true

exec:
	# usage: make exec SERVICE=watcher
	$(COMPOSE) exec $(SERVICE) /bin/sh -l
