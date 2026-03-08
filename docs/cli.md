# CLI

```bash
nest                         # Attach TUI to running instance
nest -w wren                 # Attach to named workspace
nest -s background           # Attach to specific session
nest init [name]             # Create workspace (setup wizard)
nest start                   # Start kernel foreground (bare metal)
nest start -c config.yaml    # Start with explicit config
nest status                  # Show workspace info
nest list                    # List known workspaces
```

## Default Command

Running `nest` with no subcommand (or just flags) connects the TUI to a running instance. If nothing's running, it tells you how to start it.

Workspace resolution order:
1. `-w <name>` flag — look up in registry, then `~/.nest/<name>`, then as path
2. Current directory has `config.yaml` — use it
3. Registry has a default workspace — use it
4. `~/.nest/` has exactly one workspace — use it
5. Fail with list of known workspaces

## Workspaces

A workspace is a self-contained directory. Default: `~/.nest/<name>/`.

```
~/.nest/wren/
├── config.yaml
├── plugins/
├── cron.d/
├── .usage.jsonl
└── .pi/agent/          ← isolated from ~/.pi/agent/
    ├── models.json
    ├── sessions/
    └── settings.json
```

`nest init` walks through:

1. **Instance name** — workspace path
2. **Agent working directory** — pi's cwd
3. **Model provider** — Anthropic, OpenAI, Google, etc.
4. **Session** — name and config
5. **Chat platforms** — Discord with token + channel mapping
6. **HTTP server** — port and auth token
7. **Cron** — scheduler directory

Workspaces are registered in `~/.nest/workspaces.json`.

## Pi Isolation

Each workspace has its own `.pi/agent/` for models, sessions, and settings — it **never touches `~/.pi/agent/`**. You can run pi standalone alongside nest without config conflicts.

## Docker

Nest doesn't manage Docker containers. If `nest init` generated Docker files, use Docker tools directly:

```bash
docker compose up -d         # start
docker compose down          # stop
docker compose up -d --build # rebuild
docker compose logs -f       # logs
```

`nest` (attach) works the same regardless — it connects via WebSocket to whatever's listening on the configured port.

## Bare Metal

`nest start` runs the kernel in the foreground. For background operation, use systemd or a process manager:

```bash
cp systemd/nest.service ~/.config/systemd/user/
systemctl --user enable --now nest
```
