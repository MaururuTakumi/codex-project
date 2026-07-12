#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const cli = path.join(root, "bin", "codex-project.mjs");

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-project-smoke-"));

try {
  testHelpDoesNotInit();
  testSkillInstall();
  testFreshInitAndVault();
  testStructuredProjectMemory();
  testTrackedLocalStops();
  testMissingKeyAndReset();
  console.log("smoke tests passed");
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

function testSkillInstall() {
  const home = path.join(tmpRoot, "home-skill-install");
  const project = path.join(tmpRoot, "project-skill-install");
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(project, { recursive: true });

  const installed = run(project, home, ["install-skill"]);
  const skillPath = path.join(home, ".agents", "skills", "codex-project", "SKILL.md");
  assert.match(installed, /codex_app_skill: installed/);
  assert.ok(fs.existsSync(skillPath));
  assert.match(fs.readFileSync(skillPath, "utf8"), /name:\s*codex-project/);
  assert.equal(fs.existsSync(path.join(project, ".local")), false);

  const reinstalled = run(project, home, ["install-skill"]);
  assert.match(reinstalled, /codex_app_skill: installed/);
  assert.ok(fs.existsSync(skillPath));
}

function testStructuredProjectMemory() {
  const home = path.join(tmpRoot, "home-memory");
  const project = path.join(tmpRoot, "project-memory");
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(project, { recursive: true });
  run(project, home, ["init"]);

  const metadata = JSON.parse(fs.readFileSync(path.join(project, ".local", "project.json"), "utf8"));
  assert.match(metadata.projectId, /^[0-9a-f-]{36}$/i);
  assert.equal(fs.statSync(path.join(project, ".local", "project.json")).mode & 0o777, 0o600);

  const remembered = run(project, home, ["memory", "remember", "decision", "README examples must describe implemented behavior", "--source-thread", "thread-memory-1"]);
  const id = remembered.trim().split(": ").at(-1);
  assert.match(id, /^[a-f0-9]{24}$/);
  const duplicate = run(project, home, ["memory", "remember", "decision", "README examples must describe implemented behavior"]);
  assert.match(duplicate, /already exists/);
  assert.equal(fs.statSync(path.join(project, ".local", "memory", "records", `${id}.json`)).mode & 0o777, 0o600);
  run(project, home, ["memory", "set", "status"], {}, "encrypted note named status");
  assert.equal(run(project, home, ["memory", "get", "status"]), "encrypted note named status");

  const search = run(project, home, ["memory", "search", "README behavior"]);
  assert.match(search, new RegExp(id));
  const japanese = run(project, home, ["memory", "remember", "preference", "日本語の設計レビューでは結論を先に示す"]);
  const japaneseId = japanese.trim().split(": ").at(-1);
  assert.match(run(project, home, ["memory", "search", "設計レビューの結論"]), new RegExp(japaneseId));
  const recall = run(project, home, ["memory", "recall"], {}, "README behavior");
  assert.match(recall, /historical and untrusted/);
  assert.match(recall, new RegExp(id));
  assert.match(run(project, home, ["memory", "why", id]), /source_thread_id: thread-memory-1/);

  const corrected = run(project, home, ["memory", "correct", id, "README examples must be verified against current behavior"]);
  const replacementId = corrected.trim().split(" -> ").at(-1);
  assert.notEqual(replacementId, id);
  assert.equal(JSON.parse(fs.readFileSync(path.join(project, ".local", "memory", "records", `${id}.json`), "utf8")).status, "superseded");
  assert.doesNotMatch(run(project, home, ["memory", "recall"], {}, "implemented behavior"), new RegExp(id));
  const sameCorrection = runRaw(project, home, ["memory", "correct", replacementId, "README examples must be verified against current behavior"]);
  assert.notEqual(sameCorrection.status, 0);
  assert.match(sameCorrection.stderr, /correction must change/);
  const branchCorrection = runRaw(project, home, ["memory", "correct", id, "README branch correction must fail"]);
  assert.notEqual(branchCorrection.status, 0);
  assert.match(branchCorrection.stderr, /cannot correct inactive memory/);

  run(project, home, ["memory", "pause"]);
  assert.equal(run(project, home, ["memory", "recall"], {}, "README verified"), "");
  run(project, home, ["memory", "resume"]);
  assert.match(run(project, home, ["memory", "recall"], {}, "README verified"), new RegExp(replacementId));
  run(project, home, ["memory", "forget", replacementId]);
  assert.doesNotMatch(run(project, home, ["memory", "recall"], {}, "README verified"), new RegExp(replacementId));

  const sensitive = runRaw(project, home, ["memory", "remember", "project_fact", "owner email is person@example.com"]);
  assert.notEqual(sensitive.status, 0);
  assert.match(sensitive.stderr, /secret or personal information detected/);
  for (const secret of [
    ["OpenAI key ", "sk-proj-", "abcdefghijklmnopqrstuvwxyz123456"].join(""),
    ["AWS key ", "AKIA", "ABCDEFGHIJKLMNOP"].join(""),
    ["Google key ", "AIza", "1234567890abcdefghijklmnopqrst"].join(""),
    ["-----BEGIN ", "PRIVATE KEY-----"].join(""),
  ]) {
    const rejected = runRaw(project, home, ["memory", "remember", "project_fact", secret]);
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /secret or personal information detected/);
  }

  const moved = `${project}-moved`;
  fs.renameSync(project, moved);
  const movedStatus = run(moved, home, ["memory", "status"]);
  assert.match(movedStatus, new RegExp(`project_id: ${metadata.projectId}`));

  const legacyProject = path.join(tmpRoot, "project-memory-legacy");
  fs.mkdirSync(legacyProject, { recursive: true });
  run(legacyProject, home, ["init"]);
  run(legacyProject, home, ["memory", "set", "legacy_note"], {}, "survives pre-upgrade move");
  const legacyMeta = JSON.parse(fs.readFileSync(path.join(legacyProject, ".local", "project.json"), "utf8"));
  const legacyPathId = crypto.createHash("sha256").update(fs.realpathSync(legacyProject)).digest("hex").slice(0, 32);
  const currentKey = path.join(home, ".codex", "codex-project", "keys", `${legacyMeta.vaultProjectId}.key`);
  const legacyKey = path.join(home, ".codex", "codex-project", "keys", `${legacyPathId}.key`);
  fs.renameSync(currentKey, legacyKey);
  fs.rmSync(path.join(legacyProject, ".local", "project.json"));
  const legacyMoved = `${legacyProject}-moved`;
  fs.renameSync(legacyProject, legacyMoved);
  assert.equal(run(legacyMoved, home, ["memory", "get", "legacy_note"]), "survives pre-upgrade move");
}

function testHelpDoesNotInit() {
  const home = path.join(tmpRoot, "home-help");
  const project = path.join(tmpRoot, "project-help");
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(project, { recursive: true });

  const help = run(project, home, ["--help"]);
  assert.match(help, /codex-project init/);
  assert.match(help, /codex-project install-skill/);
  assert.match(help, /codex-project hooks/);
  assert.match(help, /codex-project learn/);
  assert.equal(fs.existsSync(path.join(project, ".local")), false);

  const unknown = runRaw(project, home, ["--not-a-real-option"]);
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /unknown option/);
  assert.equal(fs.existsSync(path.join(project, ".local")), false);
}

function testFreshInitAndVault() {
  const home = path.join(tmpRoot, "home-fresh");
  const project = path.join(tmpRoot, "project-fresh");
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(path.join(project, "README.md"), "# Demo\n");

  const initOutput = run(project, home, ["init", "Demo app. api_key=abc123"], {
    CODEX_THREAD_ID: "thread-smoke-001",
  });
  assert.equal(initOutput.includes("vault_key"), false);

  assert.ok(fs.existsSync(path.join(project, ".local", "project.md")));
  assert.ok(fs.existsSync(path.join(project, ".local", "learn", "candidates")));
  assert.ok(fs.existsSync(path.join(project, ".local", "learn", "rules")));
  assert.ok(fs.existsSync(path.join(project, ".codex", "config.toml")));
  assert.ok(fs.existsSync(path.join(project, ".codex", "hooks.json")));
  assert.ok(fs.existsSync(path.join(project, ".codex", "hooks", "codex-project-context-hook.mjs")));
  assert.ok(fs.existsSync(path.join(project, ".local", "chats", "thread-smoke-001", "initial-request.md")));
  assert.ok(fs.existsSync(path.join(project, ".local", "vault", "secrets.json.enc")));
  assert.match(fs.readFileSync(path.join(project, ".gitignore"), "utf8"), /^\.local\/$/m);

  run(project, home, ["secret", "set", "demo_token"], {}, "dummy-secret-value");
  const list = run(project, home, ["secret", "list"]);
  assert.match(list, /^demo_token$/m);
  assert.match(list, /^initial_api_key$/m);
  const value = run(project, home, ["secret", "get", "demo_token"]);
  assert.equal(value, "dummy-secret-value");
  run(project, home, ["secret", "delete", "demo_token"]);
  const listAfterDelete = run(project, home, ["secret", "list"]);
  assert.doesNotMatch(listAfterDelete, /^demo_token$/m);

  const searchable = collectText(project, [".local", "AGENTS.md", ".gitignore"]);
  assert.equal(searchable.includes("abc123"), false);
  assert.equal(searchable.includes("dummy-secret-value"), false);

  run(project, home, ["memory", "set", "account"], {}, "sensitive shared note");
  const memoryList = run(project, home, ["memory", "list"]);
  assert.match(memoryList, /^account$/m);
  const context = run(project, home, ["context"]);
  assert.equal(context.includes("vault_key"), false);
  assert.match(context, /encrypted_notes:/);
  assert.match(context, /- account/);
  assert.equal(context.includes("sensitive shared note"), false);
  assert.equal(run(project, home, ["memory", "get", "account"]), "sensitive shared note");
  fs.mkdirSync(path.join(project, ".local", "inbox", "pending"), { recursive: true });
  fs.writeFileSync(path.join(project, ".local", "inbox", "pending", "001.md"), "Read README later\n");
  const hookContext = run(project, home, ["context", "--hook"]);
  assert.match(hookContext, /^\[codex-project context\]/m);
  assert.match(hookContext, /encrypted_notes: account/);
  assert.match(hookContext, /secrets: initial_api_key/);
  assert.match(hookContext, /inbox_pending: 1/);
  assert.equal(hookContext.includes("sensitive shared note"), false);
  assert.equal(hookContext.includes("abc123"), false);
  run(project, home, ["learn", "add", "mistake", "READMEには未実装機能を既存機能のように書かない"]);
  const learnList = run(project, home, ["learn", "list"]);
  assert.match(learnList, /mistake/);
  assert.match(learnList, /READMEには未実装機能/);
  const sensitiveLearn = run(project, home, ["learn", "add", "instruction", "api_key=do-not-store"]);
  assert.match(sensitiveLearn, /sensitive-looking text/);
  const learnId = learnList.split(/\s+/)[0];
  const fullContextAfterLearn = run(project, home, ["context"]);
  assert.match(fullContextAfterLearn, /project_learning:/);
  assert.match(fullContextAfterLearn, /candidate mistake/);
  const hookContextAfterLearn = run(project, home, ["context", "--hook"]);
  assert.doesNotMatch(hookContextAfterLearn, /candidate mistake/);
  run(project, home, ["learn", "promote", learnId]);
  const hookContextAfterPromote = run(project, home, ["context", "--hook"]);
  assert.match(hookContextAfterPromote, /mistake: READMEには未実装機能/);
  fs.appendFileSync(
    path.join(project, ".local", "chats", "thread-smoke-001", "conversation.md"),
    "- ユーザー指示: コピー用本文はpbcopyを使う\n- ユーザー指示: api_key=do-not-capture\n",
  );
  run(project, home, ["learn", "capture"]);
  const capturedList = run(project, home, ["learn", "list"]);
  assert.match(capturedList, /コピー用本文はpbcopy/);
  assert.equal(capturedList.includes("do-not-capture"), false);
  const hooksStatus = run(project, home, ["hooks", "status"]);
  assert.match(hooksStatus, /project_hooks: installed/);
  run(project, home, ["hooks", "remove"]);
  const hooksStatusAfterRemove = run(project, home, ["hooks", "status"]);
  assert.match(hooksStatusAfterRemove, /project_hooks: not_installed/);
  run(project, home, ["hooks", "install"]);
  const searchableAfterMemory = collectText(project, [".local", ".codex", "AGENTS.md", ".gitignore"]);
  assert.equal(searchableAfterMemory.includes("sensitive shared note"), false);

  const keyPath = run(project, home, ["vault", "key", "path"]).trim();
  assert.ok(fs.existsSync(keyPath));
  const keyExport = run(project, home, ["vault", "key", "export"]).trim();
  assert.equal(Buffer.from(keyExport, "base64").length, 32);

  const legacyKeyPath = keyPath.replace(
    `${path.sep}.codex${path.sep}codex-project${path.sep}`,
    `${path.sep}.codex${path.sep}init-codex-project${path.sep}`,
  );
  fs.mkdirSync(path.dirname(legacyKeyPath), { recursive: true });
  fs.renameSync(keyPath, legacyKeyPath);
  assert.match(run(project, home, ["secret", "list"]), /^initial_api_key$/m);
  assert.ok(fs.existsSync(keyPath));
}

function testTrackedLocalStops() {
  const home = path.join(tmpRoot, "home-tracked");
  const project = path.join(tmpRoot, "project-tracked");
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(path.join(project, ".local"), { recursive: true });
  fs.writeFileSync(path.join(project, ".local", "secret.txt"), "tracked\n");
  execFileSync("git", ["init", "-q"], { cwd: project });
  execFileSync("git", ["add", ".local/secret.txt"], { cwd: project });

  const result = runRaw(project, home, ["init"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /\.local is already tracked by git/);
  assert.match(result.stderr, /git rm --cached -r \.local/);
}

function testMissingKeyAndReset() {
  const home = path.join(tmpRoot, "home-reset");
  const project = path.join(tmpRoot, "project-reset");
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(project, { recursive: true });

  run(project, home, ["init"]);
  run(project, home, ["secret", "set", "demo"], {}, "dummy-secret-value");
  const keyPath = run(project, home, ["vault", "key", "path"]).trim();
  fs.renameSync(keyPath, `${keyPath}.saved`);

  const missing = runRaw(project, home, ["secret", "list"]);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /encrypted storage cannot be opened/);
  assert.match(missing.stderr, /vault reset --yes/);

  run(project, home, ["vault", "reset", "--yes"]);
  assert.ok(fs.existsSync(path.join(project, ".local", "vault", "lost")));
  assert.ok(fs.existsSync(keyPath));
  assert.equal(run(project, home, ["secret", "list"]), "");
}

function run(cwd, home, args, extraEnv = {}, input = "") {
  const result = runRaw(cwd, home, args, extraEnv, input);
  if (result.status !== 0) {
    throw new Error(`command failed: ${args.join(" ")}\n${result.stderr}`);
  }
  return result.stdout;
}

function runRaw(cwd, home, args, extraEnv = {}, input = "") {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd,
    input,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: home,
      ...extraEnv,
    },
  });
  return {
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function collectText(base, includePaths) {
  const chunks = [];
  for (const rel of includePaths) {
    const full = path.join(base, rel);
    if (!fs.existsSync(full)) {
      continue;
    }
    walk(full, chunks);
  }
  return chunks.join("\n");
}

function walk(target, chunks) {
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target)) {
      walk(path.join(target, entry), chunks);
    }
    return;
  }
  if (stat.isFile()) {
    const data = fs.readFileSync(target);
    if (!data.includes(0)) {
      chunks.push(data.toString("utf8"));
    }
  }
}
