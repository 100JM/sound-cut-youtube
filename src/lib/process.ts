import { spawn } from "node:child_process";

export function run(binary: string, args: string[], signal?: AbortSignal, timeout = 240_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { shell: false, windowsHide: true, signal, timeout });
    let stdout = "", stderr = "";
    let processError: Error | undefined;
    child.stdout.on("data", (chunk) => { stdout = (stdout + chunk.toString()).slice(-2_000_000); });
    child.stderr.on("data", (chunk) => { stderr = (stderr + chunk.toString()).slice(-8000); });
    // Wait for close before the caller removes temporary files or releases its lock.
    child.on("error", (error) => { processError = error; });
    child.on("close", (code) => processError ? reject(processError) : code === 0 ? resolve(stdout) : reject(new Error(stderr || "미디어 처리 시간이 초과되었거나 작업이 중단되었습니다.")));
  });
}
