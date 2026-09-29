import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { run, EXTRACTION_TIMEOUT } from "../src/lib/process";

test("extraction budget is thirty minutes", () => assert.equal(EXTRACTION_TIMEOUT, 1_800_000));
test("timeout is distinguishable from cancellation", async () => {
  await assert.rejects(run(process.execPath, ["-e", "setInterval(()=>{},1000)"], undefined, 200), { name: "TimeoutError" });
});
test("cancellation stops the process tree and permits a subsequent run", { timeout: 15000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "soundcut-process-test-"));
  const marker = path.join(directory, "child.pid");
  const abort = new AbortController();
  const task = run(process.execPath, ["-e", `const {spawn}=require('node:child_process'); const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'}); require('node:fs').writeFileSync(${JSON.stringify(marker)},String(child.pid)); setInterval(()=>{},1000);`], abort.signal);
  const rejected = assert.rejects(task, { name: "AbortError" });
  try {
    let pid = 0;
    for (let i = 0; i < 100; i++) {
      try { pid = Number(await readFile(marker, "utf8")); break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    assert.ok(pid, "child must start before cancellation");
    abort.abort();
    await rejected;
    assert.throws(() => process.kill(pid, 0), "descendant must no longer be running");
    assert.equal(await run(process.execPath, ["-e", "process.stdout.write('ready')"]), "ready");
  } finally { abort.abort(); await rejected; await rm(directory, { recursive: true, force: true }); }
});
