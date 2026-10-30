import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const installer = fs.readFileSync(new URL("../../ops/install-homelab-automation.sh", import.meta.url), "utf8");
const retained = ["bloxodes-article-discovery.service", "bloxodes-site-health.service", "bloxodes-article-discovery.timer", "bloxodes-site-health.timer"];
const retired = ["bloxodes-article-publication.timer", "bloxodes-article-writer.service", "bloxodes-article-publication.service", "bloxodes-article-audit.service"];

// Run only on GitHub's Linux runner. All host paths and service commands are
// redirected into a disposable fixture; no real systemd or checkout is touched.
for (const mode of ["success", "rollback", "absent"]) {
  test(`homelab activation retirement: ${mode}`, { skip: process.platform !== "linux" }, t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "homelab-retirement-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const sha = "a".repeat(40);
    const source = `${root}/source`;
    const runtime = `${root}/runtime`;
    const release = `${runtime}/releases/${sha}`;
    const units = `${root}/etc/systemd/system`;
    const runUnits = `${root}/run/systemd/system`;
    const state = `${root}/state`;
    const bin = `${root}/bin`;
    for (const dir of [bin, state, `${source}/tmp/article-writer`, `${release}/scripts/ops/systemd`, `${release}/tmp`, `${units}/timers.target.wants`, `${units}/multi-user.target.wants`, `${runUnits}/custom.target.wants`, `${root}/run/lock`, `${root}/etc/bloxodes`]) fs.mkdirSync(dir, { recursive: true });
    fs.symlinkSync(`${source}/tmp/article-writer`, `${release}/tmp/article-writer`);
    fs.writeFileSync(`${root}/etc/bloxodes/article-automation.env`, "");
    fs.writeFileSync(`${runtime}/prepared-sha`, sha);
    fs.writeFileSync(`${runtime}/package-receipt-${sha}.json`, "{}");
    fs.symlinkSync(`${root}/previous-release`, `${runtime}/current`);
    for (const unit of retained) {
      fs.writeFileSync(`${release}/scripts/ops/systemd/${unit}`, `new ${unit}\n`);
      // Exercise removal of an originally absent retained service on rollback.
      if (unit !== "bloxodes-site-health.service") fs.writeFileSync(`${units}/${unit}`, `old ${unit}\n`);
    }
    const discoveryTimer = retained[2];
    fs.symlinkSync(`${units}/${discoveryTimer}`, `${units}/timers.target.wants/${discoveryTimer}`);
    fs.writeFileSync(`${state}/${discoveryTimer}`, "active");
    const dropin = `${units}/bloxodes-article-writer.service.d`;
    if (mode !== "absent") {
      for (const unit of retired) fs.writeFileSync(`${units}/${unit}`, `old ${unit}\n`);
      fs.mkdirSync(dropin);
      fs.writeFileSync(`${dropin}/paused.conf`, "ConditionPathExists=/etc/bloxodes/article-writer.enabled\n");
      fs.symlinkSync(`${units}/${retired[0]}`, `${units}/timers.target.wants/${retired[0]}`);
      fs.symlinkSync(`${units}/${retired[1]}`, `${runUnits}/custom.target.wants/${retired[1]}`);
      fs.writeFileSync(`${state}/${retired[0]}`, "active");
    }
    const command = (name, body) => fs.writeFileSync(`${bin}/${name}`, `#!/usr/bin/env bash\nset -eu\n${body}\n`, { mode: 0o755 });
    command("hostname", "echo teja-homelab");
    command("git", 'case "$*" in *rev-parse*) echo "$TEST_SHA" ;; *status*) : ;; *) exit 1 ;; esac');
    command("cmp", 'if [[ "$FAIL_CMP" == 1 ]]; then exit 1; fi\nexec /usr/bin/cmp "$@"');
    command("systemctl", `printf '%s\\n' "$*" >> "$TEST_ROOT/systemctl.log"
case "$1" in
  show)
    case "$*" in
      *ActiveState*) echo inactive ;;
      *MainPID*) echo 0 ;;
      *LoadState*) if [[ -e "$TEST_ROOT/etc/systemd/system/$2" ]]; then echo loaded; else echo not-found; fi ;;
    esac ;;
  is-enabled) echo enabled ;;
  is-active) [[ -f "$TEST_ROOT/state/\${@: -1}" ]] ;;
  stop) shift; for unit in "$@"; do rm -f "$TEST_ROOT/state/$unit"; done ;;
  start) shift; for unit in "$@"; do touch "$TEST_ROOT/state/$unit"; done ;;
  disable) find "$TEST_ROOT/etc/systemd/system" "$TEST_ROOT/run/systemd/system" -mindepth 2 -type l -name "$2" -delete ;;
  daemon-reload) : ;;
  *) exit 1 ;;
esac`);
    let script = installer.replace('[[ "$EUID" == 0 &&', '[[ true &&');
    for (const [from, to] of [
      ["/srv/data/projects/Bloxodes", source],
      ["/srv/data/bloxodes-automation-runtime", runtime],
      ["/home/teja/.local/share/bloxodes-automation-runtime", `${root}/legacy`],
      ["/etc/systemd/system", units],
      ["/run/systemd/system", runUnits],
      ["/etc/bloxodes/article-automation.env", `${root}/etc/bloxodes/article-automation.env`],
      ["/run/lock/bloxodes-automation-install.lock", `${root}/run/lock/install.lock`],
    ]) script = script.replaceAll(from, to);
    const scriptPath = `${root}/install.sh`;
    fs.writeFileSync(scriptPath, script);
    const result = spawnSync("bash", [scriptPath, "--apply", sha], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, TEST_SHA: sha, TEST_ROOT: root, FAIL_CMP: mode === "rollback" ? "1" : "0" },
    });
    assert.equal(result.status, mode === "rollback" ? 1 : 0, result.stdout + result.stderr);
    assert.equal(fs.existsSync(`${source}/tmp/article-writer/writer.lock`), false);
    assert.equal(fs.existsSync(`${state}/${discoveryTimer}`), true);
    assert.equal(fs.readlinkSync(`${units}/timers.target.wants/${discoveryTimer}`), `${units}/${discoveryTimer}`);
    assert.equal(fs.existsSync(`${state}/bloxodes-site-health.timer`), false, "inactive retained timer must stay inactive");
    if (mode === "rollback") {
      assert.equal(fs.readlinkSync(`${runtime}/current`), `${root}/previous-release`);
      for (const unit of [...retired, ...retained.filter(unit => unit !== "bloxodes-site-health.service")]) assert.equal(fs.readFileSync(`${units}/${unit}`, "utf8"), `old ${unit}\n`);
      assert.equal(fs.existsSync(`${units}/bloxodes-site-health.service`), false);
      assert.equal(fs.existsSync(`${units}/bloxodes-site-health.service.absent`), false);
      assert.match(fs.readFileSync(`${dropin}/paused.conf`, "utf8"), /ConditionPathExists/);
      assert.equal(fs.existsSync(`${state}/${retired[0]}`), true);
      assert.equal(fs.readlinkSync(`${units}/timers.target.wants/${retired[0]}`), `${units}/${retired[0]}`);
      assert.equal(fs.readlinkSync(`${runUnits}/custom.target.wants/${retired[1]}`), `${units}/${retired[1]}`);
    } else {
      assert.equal(fs.readlinkSync(`${runtime}/current`), release);
      for (const unit of retained) assert.equal(fs.readFileSync(`${units}/${unit}`, "utf8"), `new ${unit}\n`);
      for (const unit of retired) {
        assert.equal(fs.existsSync(`${units}/${unit}`), false);
        assert.equal(fs.existsSync(`${state}/${unit}`), false);
      }
      assert.equal(fs.existsSync(dropin), false);
      assert.equal(fs.readdirSync(`${units}/timers.target.wants`).includes(retired[0]), false);
      assert.equal(fs.readdirSync(`${runUnits}/custom.target.wants`).includes(retired[1]), false);
    }
  });
}
