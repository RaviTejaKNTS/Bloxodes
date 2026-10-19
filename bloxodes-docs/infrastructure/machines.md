# Machines

Last verified: 2026-10-19

Three machines on Tailscale share the Bloxodes work. Each can SSH to the others by alias with `~/.ssh/devices_ed25519`. Hosts, users and sudo passwords are in `.envs/infrastructure/devices.env`. Pipe a sudo password to `sudo -S`; never print it.

| Alias | Machine | User | Bloxodes checkout |
| --- | --- | --- | --- |
| `homelab` | Linux server, `100.86.117.125` | `teja` | `/srv/data/projects/Bloxodes` |
| `macbook-pro` | MacBook Pro, `100.91.14.95` | `igeeksblog` (home `/Users/ravitejaknts`) | `~/projects/Bloxodes` |
| `macbook-air` | MacBook Air, `100.64.73.3`, may be asleep | `ravitejaknts` | `~/projects/Bloxodes` |

Rules:

- Work on the machine and checkout where the task started. Ask the owner before moving work to another machine.
- Keep each main checkout clean on `production`. Task work happens in T3 worktrees.
- Device administration lives in the Cockpit repo, checked out only on the Air at `~/projects/cockpit` (`github.com/RaviTejaKNTS/cockpit`). Start with its `AGENTS.md`.

## Homelab

- **Main checkout and env source:** `/srv/data/projects/Bloxodes` and its `.envs/`. The only place env files are edited.
- **T3 worktrees:** `/srv/data/t3code/worktrees/Bloxodes/`.
- **Article automation:** systemd units running `/srv/data/bloxodes-automation-runtime/current`. See [articles](../content/articles.md) and [schedules](../automation/schedules.md).
- **T3:** user service `t3code.service` on port 3773, with T3 memory budget, state backup and settled-worktree reaper timers.
- **Env mirror:** `env-mirror-pro.timer` pushes env files to the MacBook Pro every two minutes.
- **Owner preview:** only when the owner asks for it, run Next bound to `0.0.0.0` and share `http://teja-homelab.tail13b5bd.ts.net:3000/<route>` (fallback `http://100.86.117.125:3000`). Task QA uses GitHub's browser reports instead.
- **VPS access:** the homelab holds `~/.ssh/bloxodes_deploy_ed25519`, the key the VPS accepts. The device key doesn't work on the VPS. Reach it with `ssh homelab 'ssh -i ~/.ssh/bloxodes_deploy_ed25519 ravitejaknts@187.124.68.197 ...'`.
- No Bloxodes web or Supabase containers run here, and there are no wiki units (retired).

## MacBook Pro

- **T3 Code:** LaunchAgent `com.t3tools.t3code.service` (always running). Runs the two nightly Bloxodes schedules. See [schedules](../automation/schedules.md#t3-schedules-macbook-pro).
- **Worktree reaper:** LaunchAgent `com.ravitejaknts.t3-worktree-reaper`, hourly.
- **Env:** read-only mirror pushed from the homelab. Each worktree's `.envs` links to the main checkout's.
- No crontab.

## MacBook Air

- The owner's laptop. Has the Cockpit checkout, its own env-mirror LaunchAgent (pulls from the homelab) and T3.
- Runs no scheduled Bloxodes work.
