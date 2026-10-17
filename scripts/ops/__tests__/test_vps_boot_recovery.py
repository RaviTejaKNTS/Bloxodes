"""Dependency-free inspect fixtures and fake-Docker tests; never contact Docker."""

import copy
import json
from pathlib import Path
import runpy
import subprocess
import tempfile
import unittest
from unittest.mock import patch

MODULE = runpy.run_path(str(Path(__file__).resolve().parents[1] / "vps-boot-recovery.py"))
Recovery = MODULE["Recovery"]
candidate = MODULE["candidate"]
compose_dynamic = MODULE["compose_dynamic"]
repairable_endpoint = MODULE["repairable_endpoint"]
managed_crontab = MODULE["managed_crontab"]
BOOT = MODULE["timestamp"]("2026-10-16T21:43:00Z")
CID, NID = "c" * 64, "a" * 64
NETWORK = {"Id": NID, "Driver": "overlay", "Scope": "swarm", "Attachable": True, "Ingress": False}
ENDPOINT = {"NetworkID": NID, "IPAMConfig": {"IPv4Address": "10.0.1.12"},
            "Aliases": ["supabase-kong", "kong", "extra-alias"]}


def inspect_fixture():
    return {"Id": CID, "Name": "/supabase-kong", "Created": "2026-10-01T00:00:00Z",
            "State": {"Status": "exited", "Error": "failed to set up container networking: Address already in use",
                      "StartedAt": "2026-10-01T00:00:05Z", "FinishedAt": "2026-10-16T21:14:00Z"},
            "HostConfig": {"RestartPolicy": {"Name": "unless-stopped"}},
            "Config": {"Labels": {}}, "NetworkSettings": {"Networks": {"dokploy-network": copy.deepcopy(ENDPOINT)}}}


class DecisionTests(unittest.TestCase):
    def test_boot_start_failure_and_never_started_boot_failure(self):
        container = inspect_fixture()
        self.assertTrue(candidate(container, BOOT))
        container["State"].update(Status="created", StartedAt="0001-01-01T00:00:00Z", FinishedAt="0001-01-01T00:00:00Z")
        self.assertTrue(candidate(container, BOOT))
        container["State"]["Error"] = ""
        self.assertFalse(candidate(container, BOOT))

    def test_only_supported_policy_and_stopped_state(self):
        for policy in ("no", "on-failure", "", "always", "unless-stopped"):
            for state in ("running", "paused", "restarting", "dead", "exited", "created"):
                with self.subTest(policy=policy, state=state):
                    container = inspect_fixture()
                    container["HostConfig"]["RestartPolicy"]["Name"] = policy
                    container["State"]["Status"] = state
                    self.assertEqual(candidate(container, BOOT), policy in ("always", "unless-stopped") and state in ("exited", "created"))

    def test_skip_manual_stops_new_containers_and_post_boot_exits(self):
        for update in ({"Error": ""}, {"StartedAt": "2026-10-16T21:44:00Z", "FinishedAt": "2026-10-16T21:45:00Z"},
                       {"FinishedAt": "invalid"}):
            container = inspect_fixture()
            container["State"].update(update)
            self.assertFalse(candidate(container, BOOT))
        container = inspect_fixture()
        container["Created"] = "2026-10-16T21:44:00Z"
        self.assertFalse(candidate(container, BOOT))

    def test_unclean_shutdown_restore_stamps_finished_after_boot(self):
        container = inspect_fixture()
        container["State"]["FinishedAt"] = "2026-10-16T21:44:30Z"
        self.assertTrue(candidate(container, BOOT))

    def test_skip_swarm_tasks_and_explicit_opt_out(self):
        for labels in ({"com.docker.swarm.service.id": "web"}, {"com.bloxodes.boot-recovery.disabled": "true"}):
            container = inspect_fixture()
            container["Config"]["Labels"] = labels
            self.assertFalse(candidate(container, BOOT))

    def test_compose_requires_exact_network_and_no_pinned_address(self):
        config = {"services": {"kong": {"networks": {"proxy": None}}},
                  "networks": {"proxy": {"name": "dokploy-network"}}}
        self.assertTrue(compose_dynamic(config, "kong", "dokploy-network"))
        for entry in ({"ipv4_address": "10.0.1.12"}, {"ipv6_address": "fe80::1"},
                      {"ipv4_address": ""}, {"ipv4_address": "${STATIC_IP}"},
                      {"mac_address": "aa:bb:cc:dd:ee:ff"}, {"interface_name": "eth1"}, "invalid"):
            config["services"]["kong"]["networks"]["proxy"] = entry
            self.assertFalse(compose_dynamic(config, "kong", "dokploy-network"))
        self.assertFalse(compose_dynamic({}, "kong", "dokploy-network"))
        self.assertFalse(compose_dynamic(config, "other", "dokploy-network"))

    def test_only_known_attachable_overlay_endpoint_shapes(self):
        self.assertTrue(repairable_endpoint(ENDPOINT, NETWORK))
        for update in ({"DriverOpts": {"key": "value"}}, {"GwPriority": 1}, {"Aliases": None},
                       {"Links": ["other"]}, {"IPAMConfig": {"IPv4Address": "10.0.1.12", "IPv6Address": "::1"}}):
            self.assertFalse(repairable_endpoint({**ENDPOINT, **update}, NETWORK))
        for update in ({"Driver": "bridge"}, {"Ingress": True}, {"Attachable": False}, {"Id": "other"}):
            self.assertFalse(repairable_endpoint(ENDPOINT, {**NETWORK, **update}))


class FakeDocker:
    def __init__(self, directory):
        self.container = inspect_fixture()
        self.calls, self.start_failures, self.connect_failures = [], 1, 0
        self.compose = {"services": {"kong": {"networks": {"proxy": None}}},
                        "networks": {"proxy": {"name": "dokploy-network"}}}
        self.raw_compose = None
        compose_file = Path(directory) / "docker-compose.yml"
        compose_file.write_text("services: {}")
        self.container["Config"]["Labels"] = {
            "com.docker.compose.project": "supabase", "com.docker.compose.service": "kong",
            "com.docker.compose.project.working_dir": directory,
            "com.docker.compose.project.config_files": str(compose_file)}

    def __call__(self, command, **kwargs):
        assert command[:3] == ["docker", "--host", "unix:///var/run/docker.sock"]
        assert 0 < kwargs["timeout"] <= 30
        args = command[3:]
        self.calls.append(args)
        output, code = "", 0
        if args[0] == "info":
            output = json.dumps({"LocalNodeState": "active", "NodeID": "node", "Error": ""})
        elif args[0] == "ps":
            output = CID if self.container["State"]["Status"] in ("exited", "created") else ""
        elif args[:2] == ["container", "inspect"]:
            output = json.dumps([self.container])
        elif args[:2] == ["network", "inspect"]:
            output = json.dumps([NETWORK])
        elif args[0] == "compose":
            output = json.dumps(self.raw_compose if "--no-interpolate" in args and self.raw_compose is not None else self.compose)
        elif args[0] == "start":
            if self.start_failures:
                self.start_failures -= 1
                output, code = "failed to set up container networking: Address already in use", 1
            else:
                self.container["State"].update(Status="running", Error="", StartedAt="2026-10-16T21:44:00Z")
        elif args[:2] == ["network", "disconnect"]:
            del self.container["NetworkSettings"]["Networks"]["dokploy-network"]
        elif args[:2] == ["network", "connect"]:
            if self.connect_failures:
                self.connect_failures -= 1
                output, code = "network unavailable", 1
            else:
                aliases = [args[i + 1] for i, arg in enumerate(args) if arg == "--alias"]
                self.container["NetworkSettings"]["Networks"]["dokploy-network"] = {
                    "NetworkID": NID, "IPAMConfig": None, "Aliases": aliases}
        else:
            raise AssertionError("unexpected Docker call: " + repr(args))
        return subprocess.CompletedProcess(command, code, output, "")

    def mutations(self):
        return [call for call in self.calls if call[0] == "start" or call[:2] in
                (["network", "connect"], ["network", "disconnect"])]


class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.fake = FakeDocker(self.temporary.name)
        self.recovery = Recovery(self.base, BOOT, command=self.fake)
        self.recovery.state_dir.mkdir()

    def test_collision_reconnect_preserves_every_alias_without_ip(self):
        self.assertFalse(self.recovery.scan())
        mutations = self.fake.mutations()
        self.assertEqual([call[:2] for call in mutations], [["start", CID], ["network", "disconnect"],
                                                         ["network", "connect"], ["start", CID]])
        self.assertNotIn("--ip", mutations[2])
        self.assertEqual(mutations[2][2:-2], ["--alias", "supabase-kong", "--alias", "kong", "--alias", "extra-alias"])
        self.assertEqual(list(self.recovery.state_dir.iterdir()), [])
        self.assertFalse(self.recovery.scan())
        self.assertEqual(self.fake.mutations(), mutations)

    def test_plain_start_recovers_timeout_without_network_changes(self):
        self.fake.container["State"]["Error"] = "attaching to network failed: context deadline exceeded"
        self.fake.start_failures = 0
        self.assertFalse(self.recovery.scan())
        self.assertEqual(self.fake.mutations(), [["start", CID]])

    def test_dry_run_makes_no_mutations_or_files(self):
        self.recovery.dry_run = True
        before = sorted(self.base.rglob("*"))
        self.assertFalse(self.recovery.scan())
        self.assertEqual(self.fake.mutations(), [])
        self.assertEqual(sorted(self.base.rglob("*")), before)

    def test_pinned_or_unreadable_compose_refuses_disconnect(self):
        for unreadable in (False, True):
            with self.subTest(unreadable=unreadable):
                self.fake.calls.clear()
                self.fake.start_failures = 1
                self.fake.compose["services"]["kong"]["networks"]["proxy"] = {"ipv4_address": "10.0.1.12"}
                if unreadable:
                    self.fake.container["Config"]["Labels"]["com.docker.compose.project.config_files"] = "/missing.yml"
                self.assertTrue(self.recovery.scan())
                self.assertEqual(self.fake.mutations(), [["start", CID]])

    def test_interrupted_connect_retains_alias_journal_and_resumes_next_invocation(self):
        self.fake.connect_failures = 1
        self.assertTrue(self.recovery.scan())
        self.assertEqual(len(list(self.recovery.state_dir.glob("*.json"))), 1)
        another = Recovery(self.base, BOOT, command=self.fake)
        self.assertFalse(another.scan())
        self.assertEqual(list(self.recovery.state_dir.iterdir()), [])
        self.assertEqual(sum(call[:2] == ["network", "disconnect"] for call in self.fake.calls), 1)
        self.assertEqual(self.fake.container["NetworkSettings"]["Networks"]["dokploy-network"]["Aliases"], ENDPOINT["Aliases"])

    def test_successful_connect_after_client_timeout_is_read_back_without_disconnect(self):
        self.fake.connect_failures = 1
        self.assertTrue(self.recovery.scan())
        self.fake.container["NetworkSettings"]["Networks"]["dokploy-network"] = {
            "NetworkID": NID, "IPAMConfig": None, "Aliases": ENDPOINT["Aliases"]}
        self.assertFalse(self.recovery.scan())
        self.assertEqual(sum(call[:2] == ["network", "disconnect"] for call in self.fake.calls), 1)

    def test_stop_between_selection_and_action_is_respected(self):
        selected = copy.deepcopy(self.fake.container)
        self.fake.container["State"].update(Error="", FinishedAt="2026-10-16T21:44:00Z")
        self.recovery.recover(selected)
        self.assertEqual(self.fake.mutations(), [])

    def test_multiple_dynamic_overlays_refuses_ambiguous_repair(self):
        self.fake.container["NetworkSettings"]["Networks"]["other"] = copy.deepcopy(ENDPOINT)
        self.fake.compose["networks"]["other"] = {"name": "other"}
        self.fake.compose["services"]["kong"]["networks"]["other"] = None
        self.assertTrue(self.recovery.scan())
        self.assertEqual(self.fake.mutations(), [["start", CID]])

    def test_other_pinned_endpoint_also_refuses_ambiguous_repair(self):
        self.fake.container["NetworkSettings"]["Networks"]["private"] = copy.deepcopy(ENDPOINT)
        self.fake.compose["services"]["kong"]["networks"]["private"] = {"ipv4_address": "172.18.0.10"}
        self.assertTrue(self.recovery.scan())
        self.assertEqual(self.fake.mutations(), [["start", CID]])

    def test_host_port_address_conflict_never_reconnects_overlay(self):
        original = self.fake
        def bind_failure(command, **kwargs):
            if command[3] == "start":
                original.calls.append(command[3:])
                return subprocess.CompletedProcess(command, 1, "failed to set up container networking: bind: address already in use", "")
            return original(command, **kwargs)
        self.recovery.command = bind_failure
        self.assertTrue(self.recovery.scan())
        self.assertEqual(self.fake.mutations(), [["start", CID]])

    def test_unset_environment_variable_cannot_hide_compose_ip_pin(self):
        self.fake.raw_compose = copy.deepcopy(self.fake.compose)
        self.fake.raw_compose["services"]["kong"]["networks"]["proxy"] = {"ipv4_address": "${STATIC_IP}"}
        self.assertTrue(self.recovery.scan())
        self.assertEqual(self.fake.mutations(), [["start", CID]])

    def test_retry_window_keeps_scanning_and_stays_bounded(self):
        self.fake.start_failures = 0
        clock = [0.0]
        def sleep(seconds):
            clock[0] += seconds
        with patch("time.monotonic", side_effect=lambda: clock[0]), patch("time.sleep", side_effect=sleep):
            self.assertEqual(self.recovery.run(2, 5, 1), 0)
        self.assertEqual(clock[0], 5)
        self.assertEqual(sum(call[0] == "ps" for call in self.fake.calls), 5)

    def test_slow_disconnect_at_deadline_still_reconnects(self):
        clock = [0.0]
        real = self.fake.__call__
        def slow(command, **kwargs):
            result = real(command, **kwargs)
            if command[3:5] == ["network", "disconnect"]:
                clock[0] += 200  # disconnect overruns the whole remaining window
            return result
        self.recovery.command = slow
        self.recovery.deadline = 100.0
        with patch("time.monotonic", side_effect=lambda: clock[0]):
            self.assertFalse(self.recovery.scan())
        calls = [call[:2] for call in self.fake.mutations()]
        self.assertEqual(calls, [["start", CID], ["network", "disconnect"], ["network", "connect"], ["start", CID]])
        self.assertIn("kong", self.fake.container["NetworkSettings"]["Networks"]["dokploy-network"]["Aliases"])

    def test_no_disconnect_without_reserved_time(self):
        clock = [0.0]
        self.recovery.deadline = 30.0
        with patch("time.monotonic", side_effect=lambda: clock[0]):
            self.assertTrue(self.recovery.scan())
        self.assertNotIn(["network", "disconnect"], [call[:2] for call in self.fake.mutations()])
        self.assertIn("dokploy-network", self.fake.container["NetworkSettings"]["Networks"])
        self.assertEqual(list(self.recovery.state_dir.iterdir()), [])

    def test_changed_endpoint_or_running_state_keeps_journal_without_mutation(self):
        self.fake.connect_failures = 1
        self.assertTrue(self.recovery.scan())
        record_path = next(self.recovery.state_dir.glob("*.json"))
        record = json.loads(record_path.read_text())
        for change in ("endpoint", "running"):
            with self.subTest(change=change):
                self.fake.calls.clear()
                self.fake.container["State"]["Status"] = "exited" if change == "endpoint" else "running"
                self.fake.container["NetworkSettings"]["Networks"]["dokploy-network"] = {
                    **copy.deepcopy(ENDPOINT), "Aliases": ["changed"]}
                with self.assertRaises(RuntimeError):
                    self.recovery.reconnect(self.fake.container, record, record_path)
                self.assertEqual(self.fake.mutations(), [])
                self.assertTrue(record_path.exists())

    def test_docker_timeout_is_sanitized_and_readiness_is_bounded(self):
        def timeout(*args, **kwargs):
            raise subprocess.TimeoutExpired("secret-config", 30, output="secret-value")
        recovery = Recovery(self.base, BOOT, command=timeout)
        with self.assertRaisesRegex(RuntimeError, "Docker command unavailable or timed out"):
            recovery.docker("info")
        clock = [0.0]
        def sleep(seconds):
            clock[0] += seconds
        with patch("time.monotonic", side_effect=lambda: clock[0]), patch("time.sleep", side_effect=sleep):
            self.assertEqual(recovery.run(2, 5, 1), 1)
        self.assertEqual(clock[0], 2)


class CronTests(unittest.TestCase):
    block = "# BLOXODES_BOOT_RECOVERY_START\n@reboot new-command\n# BLOXODES_BOOT_RECOVERY_END\n"

    def test_append_replace_preserve_and_repeat(self):
        previous = "MAILTO=owner\n# unrelated\n* * * * * other-job\n"
        updated = managed_crontab(previous, self.block)
        self.assertEqual(updated, previous + self.block)
        self.assertEqual(managed_crontab(updated, self.block), updated)
        old = self.block.replace("new-command", "old-command")
        self.assertEqual(managed_crontab(previous + old + "@reboot other\n", self.block),
                         previous + self.block + "@reboot other\n")
        self.assertEqual(managed_crontab("", self.block), self.block)

    def test_malformed_duplicate_or_missing_source_blocks_fail_closed(self):
        for previous in ("# BLOXODES_BOOT_RECOVERY_START\n", "# BLOXODES_BOOT_RECOVERY_END\n", self.block * 2):
            with self.assertRaises(ValueError):
                managed_crontab(previous, self.block)
        with self.assertRaises(ValueError):
            managed_crontab("", "# no block\n")


if __name__ == "__main__":
    unittest.main()
