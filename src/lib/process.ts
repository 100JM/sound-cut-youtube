import { execFile, spawn } from "node:child_process";

export const EXTRACTION_TIMEOUT = 30 * 60 * 1000;
export function run(binary: string, args: string[], signal?: AbortSignal, timeout = EXTRACTION_TIMEOUT): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    const child = spawn(binary, args, { shell: false, windowsHide: true, detached: process.platform !== "win32" });
    let stdout = "", stderr = "";
    let processError: Error | undefined;
    let termination: Promise<void> | undefined;
    const stop = (reason: Error) => {
      if (termination) return;
      processError = reason;
      termination = new Promise<void>(done => {
        if (!child.pid) { done(); return; }
        if (process.platform === "win32") {
          execFile("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }, error => {
            if (error) child.kill();
            done();
          });
        } else {
          try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
          done();
        }
      });
    };
    const abort = () => stop(signal?.reason instanceof Error ? signal.reason : new DOMException("추출 요청이 취소되었습니다.", "AbortError"));
    const timer = setTimeout(() => stop(new DOMException("처리 시간이 초과되었습니다.", "TimeoutError")), timeout);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    child.stdout.on("data", chunk => { stdout = (stdout + chunk.toString()).slice(-2_000_000); });
    child.stderr.on("data", chunk => { stderr = (stderr + chunk.toString()).slice(-8000); });
    child.on("error", error => { processError = error; });
    child.on("close", async code => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      await termination;
      if (processError) reject(processError);
      else if (code === 0) resolve(stdout);
      else reject(new Error(stderr || "미디어 처리에 실패했습니다."));
    });
  });
}
