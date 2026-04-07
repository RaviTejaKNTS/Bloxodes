## VPS Security Hardening Plan

This document captures the VPS audit, the hardening work that was applied, and the operating model for running Bloxodes on Ubuntu 24.04 LTS with Docker, Dokploy, and Cloudflare.

### Current VPS State

The server has now been hardened and bootstrapped for Docker and Dokploy.

- Host: `187.124.68.197`
- OS: Ubuntu 24.04.4 LTS
- Kernel: `6.8.0-107-generic`
- Virtualization: KVM
- Admin user: `codex-admin` with sudo
- SSH auth: key-only
- Root SSH login: disabled
- Password SSH login: disabled
- Firewall: `ufw` active
- Fail2ban: active
- Swap: `2 GB`
- Docker: installed from Docker's official repo
- Dokploy: installed and healthy
- Dokploy version: `v0.28.8`
- Reboot status: clean after reboot

### Completed Hardening Work

These changes were applied on the live VPS.

- created a non-root sudo admin user: `codex-admin`
- disabled `PermitRootLogin`
- disabled `PasswordAuthentication`
- disabled `KbdInteractiveAuthentication`
- disabled `X11Forwarding`
- disabled `AllowAgentForwarding`
- disabled `AllowTcpForwarding`
- reduced `MaxAuthTries` to `3`
- reduced `LoginGraceTime` to `30`
- enabled `ufw` with only `22`, `80`, and `443` open
- installed and enabled `fail2ban`
- added a `2 GB` swap file
- removed unnecessary packages for a headless Docker host
- installed Docker Engine, Buildx, and Docker Compose plugin
- configured Docker log rotation
- rebooted and re-verified SSH, firewall, swap, Docker, and fail2ban
- installed Dokploy with the correct `ADVERTISE_ADDR`
- protected the Dokploy panel from public access using the `DOCKER-USER` chain

### Current Exposure Model

Publicly reachable:

- `22/tcp`
- `80/tcp`
- `443/tcp`

Not publicly reachable:

- Dokploy panel on `3000/tcp`
- raw app container ports

Important:

- A direct public request to `http://187.124.68.197:3000` times out by design.
- Dokploy is reachable locally on the VPS at `http://127.0.0.1:3000`.
- Dokploy's Traefik container is handling `80/443`.

### High-Risk Findings

These were the original high-risk findings before hardening.

- `PermitRootLogin yes`
- `PasswordAuthentication yes`
- `PubkeyAuthentication yes`
- `X11Forwarding yes`
- `AllowAgentForwarding yes`
- `AllowTcpForwarding yes`
- No active firewall
- Root password was used/shared during setup and should be treated as compromised

There was also a key-auth issue:

- The temporary audit key was added to `/root/.ssh/authorized_keys`, but it was appended to the same line as an existing Hostinger-managed RSA key.
- Because of that malformed line, SSH key authentication did not work correctly.

That problem was resolved by moving to a dedicated non-root user with a clean `authorized_keys` file.

### Keep Or Change Ubuntu

Keep Ubuntu 24.04 LTS.

It is a good base for:

- Docker
- Dokploy
- Traefik
- Next.js SSR
- long-term security updates

There is no need to reinstall the OS. In-place cleanup and hardening were enough.

### SSH Hardening

The final SSH target state is now in effect.

- `PermitRootLogin no`
- `PasswordAuthentication no`
- `KbdInteractiveAuthentication no`
- `PubkeyAuthentication yes`
- `X11Forwarding no`
- `AllowAgentForwarding no`
- `AllowTcpForwarding no`
- `MaxAuthTries 3`
- `LoginGraceTime 30`
- `ClientAliveInterval 300`
- `ClientAliveCountMax 2`

One Ubuntu-specific gotcha:

- `/etc/ssh/sshd_config.d/50-cloud-init.conf` was forcing `PasswordAuthentication yes`
- OpenSSH was honoring the first matching value it saw
- so later override files were not enough on their own

The fix was:

- add a stronger early hardening file
- replace the cloud-init SSH password setting with `PasswordAuthentication no`
- add `/etc/cloud/cloud.cfg.d/99-disable-ssh-password-auth.cfg` with `ssh_pwauth: false`

### Immediate Hardening Priorities

These are now the remaining priorities after the initial hardening work.

1. Rotate the root password.
   Treat the current password as compromised because it was shared during setup.

2. Rotate the `codex-admin` password privately.
   SSH password login is disabled, but the password was still shared during setup and should be replaced from the Hostinger console or an existing shell session.

3. Restrict SSH by source IP if possible.
   `22/tcp` is currently open globally to avoid locking out normal access. Tighten it to your home/static IP or a trusted admin IP range when ready.

4. Decide how you want to expose the Dokploy panel long term.
   Recommended options:
   - keep it private and use SSH tunneling
   - put it behind Tailscale
   - put it behind Cloudflare Access

5. Decide whether to keep or remove Monarx.
   It is still present and local-only. Keep it for now unless you want a more minimal host.

### Suggested SSH Hardening Override

The effective hardening lives in an early override file:

```conf
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
MaxAuthTries 3
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 2
```

Validation and reload:

```bash
sshd -t && systemctl reload ssh
```

Important:

- Test key login with the non-root sudo user before disabling password authentication.
- Keep one active SSH session open while testing a second one.

### Packages And Services To Remove

These packages were removed for a minimal headless SSR host:

- `modemmanager`
- `fwupd`
- `packagekit`
- `packagekit-tools`
- `multipath-tools`
- `open-iscsi`
- `open-vm-tools`
- `udisks2`
- `snapd`

Likely keep:

- `cloud-init`
- `qemu-guest-agent`
- `ufw`
- `unattended-upgrades`
- `apparmor`

### Monarx Agent

The VPS currently has Monarx packages running:

- `monarx-agent`
- `monarx-protect`
- `monarx-protect-autodetect`

This is not currently exposed publicly, but it is extra software on the host.

Recommendation:

- If you want the most minimal and predictable Docker host, consider removing Monarx after confirming Hostinger does not rely on it for any support or bundled protection you care about.
- If you prefer to keep provider-added protections initially, leave it in place until the app is fully deployed and stable, then revisit.

### Docker And Dokploy

Recommended platform stack:

- Ubuntu 24.04 LTS
- Docker Engine
- Dokploy
- Traefik via Dokploy
- Cloudflare in front

Recommended host model:

- single VPS
- single public reverse proxy path via Traefik
- Next.js app in Docker
- no direct public exposure of the app container port

One Dokploy-specific note:

- Dokploy uses Docker Swarm
- Docker `live-restore` conflicts with Swarm initialization
- Docker log rotation is enabled, but `live-restore` was intentionally removed to allow Dokploy to work correctly

### Dokploy And SSH

Dokploy does not block SSH-based management.

That means:

- you can still inspect containers with `docker ps`
- you can still inspect logs with `docker logs`
- you can still inspect volumes and networks
- you can still manage the host with `systemctl`, `ufw`, `journalctl`, and normal Linux tooling

Recommended division of responsibility:

- Use Dokploy for:
  - app deployments
  - environment variables
  - domains and certs
  - service restart workflows
  - app-level logs and management

- Use SSH for:
  - host updates
  - firewall changes
  - Docker inspection and recovery
  - backup validation
  - incident response
  - emergency repairs

So yes, Dokploy-managed apps remain easy to manage over SSH.

### Private Dokploy Access

The Dokploy panel is intentionally not public.

Use SSH local port forwarding to access it:

```bash
ssh -L 3000:127.0.0.1:3000 codex-admin@187.124.68.197
```

Then open:

```text
http://127.0.0.1:3000/register
```

That gives you private access to the initial Dokploy setup without exposing the panel to the internet.

### Firewall Notes With Docker

One important detail:

- Docker can bypass naive `ufw` expectations because of its iptables rules.

If Dokploy is used, make sure firewall policy is designed with Docker in mind. In practice that usually means one of:

- using the `DOCKER-USER` chain directly
- using a `ufw-docker` style integration
- putting the Dokploy admin panel behind Tailscale or Cloudflare Access

The current VPS uses the `DOCKER-USER` chain to drop inbound traffic to `3000/tcp` while leaving `80/443` available for Traefik.

### Recommended Final Port Exposure

Public:

- `80/tcp`
- `443/tcp`

Restricted:

- `22/tcp` from trusted IPs only if possible

Avoid keeping admin surfaces publicly exposed unless protected:

- Dokploy panel
- any raw app container ports
- ad hoc debug ports

### Recommended Deployment Model For Bloxodes

- Keep Ubuntu 24.04 LTS
- Harden SSH first
- Enable firewall
- Install Docker from the official Docker repository
- Install Dokploy
- Put Cloudflare in front

### Useful Management Commands

Host-level checks:

```bash
sudo ufw status verbose
sudo fail2ban-client status sshd
sudo sshd -T | egrep 'permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication'
swapon --show
docker service ls
docker ps
```

Dokploy checks:

```bash
sudo docker service ps dokploy --no-trunc
sudo docker service logs dokploy --since 10m
curl -I http://127.0.0.1:3000
```
- Keep the Next.js app private behind Traefik
- Use the repo Docker setup and persistent Next cache volume
- Keep GitHub Actions for heavy scheduled jobs at first

### Concrete Action Plan

1. Rotate the root password.
2. Create a non-root sudo admin user.
3. Fix key-based SSH access for that user.
4. Disable root SSH login.
5. Disable password SSH login.
6. Enable `ufw` with the correct allow rules.
7. Install `fail2ban`.
8. Apply updates and reboot.
9. Remove unnecessary packages/services.
10. Add swap.
11. Install Docker.
12. Install Dokploy.
13. Protect the Dokploy admin surface.
14. Deploy the app behind Traefik and Cloudflare.

### SSH Access For Codex

Best practice is to give Codex access through a dedicated sudo user with an SSH public key, not through `root`.

Recommended flow:

1. Create a user such as `codex-admin`.
2. Add the user to the `sudo` group.
3. Create `~codex-admin/.ssh/authorized_keys`.
4. Add the Codex public key on its own line.
5. Test SSH login.
6. Only after that, disable root login and password auth.

If temporary root access is used for setup, it should still be key-based, short-lived, and removed after the server is hardened.

### Notes From The Live Audit

- `root` login by password is currently accepted.
- The server is reachable from the public internet on SSH.
- `ufw` is inactive even though installed.
- No Docker services are present yet.
- The system is not overloaded and has ample free disk and RAM.
- Swap is not configured.
- The SSH key issue should be fixed before any further remote automation.
