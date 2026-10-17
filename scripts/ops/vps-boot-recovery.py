#!/usr/bin/env python3
"""Retry failed boot starts. No SDK, env file, Compose apply, or root required."""

import argparse
import datetime as dt
import fcntl
import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import re
import subprocess
import sys
import time


LOG = logging.getLogger("boot-recovery")
DEFAULT_BASE = Path("/home/codex-admin/bloxodes-supabase")
DISCONNECT_RESERVE_SECONDS = 90
RECONNECT_BUDGET_SECONDS = 60


def timestamp(value):
    if not isinstance(value, str) or value.startswith("0001-"):
        return None
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.timestamp() if parsed.tzinfo is not None else None
    except ValueError:
        return None


def candidate(container, boot):
    """Require evidence of a failed start; a stopped container alone isn't enough."""
    state = container.get("State", {})
    labels = container.get("Config", {}).get("Labels") or {}
    policy = container.get("HostConfig", {}).get("RestartPolicy", {}).get("Name")
    if policy not in ("unless-stopped", "always"):
        return False
    if any(key.startswith("com.docker.swarm.") for key in labels):
        return False
    if labels.get("com.bloxodes.boot-recovery.disabled") == "true":
        return False
    if state.get("Status") not in ("exited", "created") or not state.get("Error"):
        return False
    created = timestamp(container.get("Created"))
    if created is None or created > boot:
        return False
    for field in ("StartedAt", "FinishedAt"):
        value = state.get(field)
        if timestamp(value) is None and not (isinstance(value, str) and value.startswith("0001-")):
            return False
    # After an unclean shutdown dockerd stamps FinishedAt while restoring, after boot, so
    # only StartedAt proves nobody ran (and then stopped) the container since boot.
    started = timestamp(state.get("StartedAt"))
    return started is None or started <= boot


def compose_dynamic(config, service, network):
    """Prove the exact service/network has no configured fixed address."""
    definition = config.get("services", {}).get(service, {})
    if definition.get("mac_address"):
        return False
    entries = definition.get("networks")
    if not isinstance(entries, dict):
        return False
    matches = []
    for key, entry in entries.items():
        definition = config.get("networks", {}).get(key, {})
        if definition.get("name") == network:
            matches.append(entry)
    return len(matches) == 1 and (matches[0] is None or (
        isinstance(matches[0], dict)
        and "ipv4_address" not in matches[0]
        and "ipv6_address" not in matches[0]
        and not matches[0].get("mac_address")
        and not matches[0].get("interface_name")
    ))


def address_collision(message):
    text = message.lower()
    return ("address already in use" in text and "network" in text
            and not any(term in text for term in ("bind", "port is already allocated", "listen tcp", "listen udp")))


def repairable_endpoint(endpoint, network):
    ipam = endpoint.get("IPAMConfig") or {}
    # Preserve only endpoint shapes whose settings we can round-trip exactly.
    return bool(
        ipam.get("IPv4Address")
        and not any(value for key, value in ipam.items() if key != "IPv4Address")
        and not endpoint.get("Links") and not endpoint.get("DriverOpts")
        and not endpoint.get("GwPriority")
        and isinstance(endpoint.get("Aliases"), list)
        and all(isinstance(alias, str) and alias for alias in endpoint["Aliases"])
        and network.get("Driver") == "overlay" and network.get("Scope") == "swarm"
        and network.get("Attachable") is True and not network.get("Ingress")
        and network.get("Id") == endpoint.get("NetworkID")
    )


def managed_crontab(previous, manifest):
    """Replace only our exact, balanced block; preserve all unrelated entries."""
    start, end = "# BLOXODES_BOOT_RECOVERY_START", "# BLOXODES_BOOT_RECOVERY_END"

    def bounds(text):
        lines = text.splitlines(keepends=True)
        starts = [i for i, line in enumerate(lines) if line.rstrip("\r\n") == start]
        ends = [i for i, line in enumerate(lines) if line.rstrip("\r\n") == end]
        if not starts and not ends:
            return lines, len(lines), len(lines) - 1
        if len(starts) != 1 or len(ends) != 1 or starts[0] >= ends[0]:
            raise ValueError("malformed or duplicate recovery cron block")
        return lines, starts[0], ends[0]

    lines, first, last = bounds(manifest)
    if first == len(lines):
        raise ValueError("source recovery cron block missing")
    block = "".join(lines[first:last + 1])
    lines, first, last = bounds(previous)
    prefix = "".join(lines[:first])
    if prefix and not prefix.endswith("\n"):
        prefix += "\n"
    return prefix + block + "".join(lines[last + 1:])


class Recovery:
    def __init__(self, base, boot, dry_run=False, command=None):
        self.base, self.boot, self.dry_run = Path(base), boot, dry_run
        self.state_dir = self.base / "boot-recovery-state"
        self.deadline = float("inf")
        self.command = command or subprocess.run

    def docker(self, *args):
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise RuntimeError("recovery deadline reached")
        try:
            result = self.command(
                ["docker", "--host", "unix:///var/run/docker.sock", *args], capture_output=True, text=True,
                timeout=min(30, remaining), check=False,
            )
        except (subprocess.TimeoutExpired, OSError) as error:
            # Never log raw Compose output: resolved config can contain secrets.
            raise RuntimeError("Docker command unavailable or timed out") from error
        if result.returncode:
            raise RuntimeError("address already in use" if address_collision(
                result.stdout + result.stderr) else "Docker command failed")
        return result.stdout

    def inspect(self, ident):
        return json.loads(self.docker("container", "inspect", ident))[0]

    def network(self, name):
        return json.loads(self.docker("network", "inspect", name))[0]

    def dynamic(self, container, name):
        labels = container.get("Config", {}).get("Labels") or {}
        files = labels.get("com.docker.compose.project.config_files", "").split(",")
        directory = labels.get("com.docker.compose.project.working_dir", "")
        service = labels.get("com.docker.compose.service")
        project = labels.get("com.docker.compose.project")
        if not service or not project or not Path(directory).is_absolute():
            return False
        if not files or not all(Path(file).is_absolute() and Path(file).is_file() for file in files):
            return False
        args = ["compose", "--project-directory", directory, "--project-name", project]
        for file in files:
            args.extend(["--file", file])
        # An unset environment variable must not hide an intended static address.
        raw = json.loads(self.docker(*args, "config", "--no-interpolate", "--format", "json"))
        if not compose_dynamic(raw, service, name):
            return False
        resolved = json.loads(self.docker(*args, "config", "--format", "json"))
        return compose_dynamic(resolved, service, name)

    def journals(self, ident):
        if not re.fullmatch(r"[a-f0-9]{64}", ident):
            raise RuntimeError("invalid container ID")
        return sorted(self.state_dir.glob(ident + "-*.json"))

    def reconnect(self, container, record, path):
        ident, name, endpoint = container["Id"], record["network"], record["endpoint"]
        if record["container"] != ident or record["created"] != container["Created"]:
            raise RuntimeError("network journal identity mismatch")
        network = self.network(name)
        if not repairable_endpoint(endpoint, network) or not self.dynamic(container, name):
            raise RuntimeError("cannot prove dynamic Compose overlay endpoint")
        fresh = self.inspect(ident)
        if not candidate(fresh, self.boot):
            raise RuntimeError("container no longer eligible; retaining journal for review")
        current = fresh.get("NetworkSettings", {}).get("Networks", {}).get(name)
        aliases = endpoint["Aliases"]
        if current is not None:
            # A previous timed-out connect may already have succeeded.
            if not (current.get("IPAMConfig") or {}).get("IPv4Address"):
                if current.get("NetworkID") == network["Id"] and set(aliases).issubset(current.get("Aliases") or []):
                    if not self.dry_run:
                        path.unlink()
                    return True
            if current != endpoint:
                raise RuntimeError("endpoint changed since journal; refusing disconnect")
        LOG.info("%s reconnect %s on %s, aliases=%s", "would" if self.dry_run else "will",
                 ident[:12], name, json.dumps(aliases))
        if self.dry_run:
            return True
        if current is not None and self.deadline - time.monotonic() < DISCONNECT_RESERVE_SECONDS:
            raise RuntimeError("too close to deadline to disconnect safely")
        # Write-ahead journal keeps all aliases if disconnect/connect is interrupted.
        if not path.exists():
            temporary = path.with_suffix(".tmp")
            with temporary.open("w") as stream:
                json.dump(record, stream)
                stream.flush()
                os.fsync(stream.fileno())
            temporary.replace(path)
            directory_fd = os.open(self.state_dir, os.O_RDONLY)
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
        if current is not None:
            self.docker("network", "disconnect", name, ident)
        # Reconnect gets its own budget so a slow disconnect cannot strand the endpoint.
        self.deadline = max(self.deadline, time.monotonic() + RECONNECT_BUDGET_SECONDS)
        args = ["network", "connect"]
        for alias in aliases:
            args.extend(["--alias", alias])
        self.docker(*args, name, ident)
        connected = self.inspect(ident).get("NetworkSettings", {}).get("Networks", {}).get(name, {})
        if connected.get("NetworkID") != network["Id"] or not set(aliases).issubset(connected.get("Aliases") or []):
            raise RuntimeError("network alias readback failed; retaining journal")
        path.unlink()
        return True

    def repair(self, container):
        options = [(name, endpoint) for name, endpoint in
                   container.get("NetworkSettings", {}).get("Networks", {}).items()
                   if (endpoint.get("IPAMConfig") or {}).get("IPv4Address")]
        # A generic Docker error cannot identify which of several endpoints collided.
        if len(options) != 1:
            raise RuntimeError("expected exactly one remembered IPv4 endpoint")
        name, endpoint = options[0]
        record = {"container": container["Id"], "created": container["Created"],
                  "network": name, "endpoint": endpoint}
        path = self.state_dir / (container["Id"] + "-" + endpoint["NetworkID"] + ".json")
        return self.reconnect(container, record, path)

    def recover(self, container):
        ident = container["Id"]
        for path in self.journals(ident):
            self.reconnect(container, json.loads(path.read_text()), path)
        fresh = self.inspect(ident)
        if not candidate(fresh, self.boot):
            return
        LOG.info("%s start %s (%s)", "would" if self.dry_run else "will",
                 ident[:12], fresh.get("Name", ""))
        if self.dry_run:
            if address_collision(fresh["State"]["Error"]):
                self.repair(fresh)
            return
        try:
            self.docker("start", ident)
        except RuntimeError as error:
            if str(error) != "address already in use":
                raise
            self.repair(self.inspect(ident))
            fresh = self.inspect(ident)
            if not candidate(fresh, self.boot):
                return
            self.docker("start", ident)
        LOG.info("start accepted for %s; health remains Docker/application-owned", ident[:12])

    def scan(self):
        failed = False
        ids = self.docker("ps", "--all", "--quiet", "--no-trunc",
                          "--filter", "status=exited", "--filter", "status=created").split()
        for ident in ids:
            try:
                container = self.inspect(ident)
                if candidate(container, self.boot):
                    self.recover(container)
            except (RuntimeError, ValueError, KeyError, OSError) as error:
                LOG.warning("container %s deferred: %s", ident[:12], error)
                failed = True
        pending = list(self.state_dir.glob("*.json"))
        if pending and not self.dry_run:
            LOG.warning("%d pending network journal(s); retained for retry/operator review", len(pending))
        return failed or bool(pending)

    def run(self, ready_seconds, window_seconds, retry_seconds):
        self.deadline = time.monotonic() + ready_seconds
        while True:
            try:
                swarm = json.loads(self.docker("info", "--format", "{{json .Swarm}}"))
                if swarm.get("LocalNodeState") == "active" and swarm.get("NodeID") and not swarm.get("Error"):
                    break
            except (RuntimeError, ValueError):
                pass
            remaining = self.deadline - time.monotonic()
            if remaining <= 0 or self.dry_run:
                LOG.error("Docker/Swarm not ready within readiness window")
                return 1
            time.sleep(min(retry_seconds, remaining))
        self.deadline = time.monotonic() + window_seconds
        failed = False
        while True:
            try:
                failed = self.scan()
            except (RuntimeError, ValueError, OSError) as error:
                LOG.warning("scan deferred: %s", error)
                failed = True
            remaining = self.deadline - time.monotonic()
            if self.dry_run or remaining <= 0:
                break
            time.sleep(min(retry_seconds, remaining))
            # End on the last completed pass, not a guaranteed deadline error.
            if self.deadline - time.monotonic() <= 0:
                break
        LOG.info("recovery %s", "finished with unresolved failures" if failed else "finished")
        return 1 if failed else 0


def bounded_int(maximum):
    def parse(value):
        number = int(value)
        if not 1 <= number <= maximum:
            raise argparse.ArgumentTypeError("value outside allowed range")
        return number
    return parse


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="one read-only pass, stdout only")
    parser.add_argument("--base", type=Path, default=DEFAULT_BASE)
    # Cron starts @reboot before dockerd; the 2026-10-16 boot took ~3 minutes to start containers.
    parser.add_argument("--ready-seconds", type=bounded_int(900), default=600)
    parser.add_argument("--window-seconds", type=bounded_int(600), default=600)
    parser.add_argument("--retry-seconds", type=bounded_int(60), default=20)
    args = parser.parse_args()
    os.umask(0o077)
    LOG.setLevel(logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    LOG.addHandler(handler)
    lock = None
    if not args.dry_run:
        (args.base / "logs").mkdir(parents=True, exist_ok=True)
        lock = (args.base / "boot-recovery.lock").open("a")
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            LOG.info("recovery already running")
            return 0
        (args.base / "boot-recovery-state").mkdir(mode=0o700, exist_ok=True)
        file_handler = RotatingFileHandler(args.base / "logs/boot-recovery.log",
                                          maxBytes=1024 * 1024, backupCount=3)
        file_handler.setFormatter(handler.formatter)
        LOG.addHandler(file_handler)
    boot = next(int(line.split()[1]) for line in Path("/proc/stat").read_text().splitlines()
                if line.startswith("btime "))
    LOG.info("boot=%s dry_run=%s", dt.datetime.fromtimestamp(boot, dt.timezone.utc).isoformat(), args.dry_run)
    try:
        return Recovery(args.base, boot, args.dry_run).run(
            args.ready_seconds, args.window_seconds, args.retry_seconds)
    finally:
        if lock:
            lock.close()


if __name__ == "__main__":
    sys.exit(main())
