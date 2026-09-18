import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseInput } from "@/lib/input";
import { run } from "@/lib/process";

export const runtime = "nodejs";
export const maxDuration = 300;
let busy = false;

function binary(name: string, env?: string) {
  if (env) return env;
  const local = path.join(process.cwd(), ".tools", name + (process.platform === "win32" ? ".exe" : ""));
  return existsSync(local) ? local : name;
}

export async function POST(request: Request) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  let input;
  try {
    const text = await request.text();
    if (text.length > 4096) throw new Error("입력값이 너무 깁니다.");
    input = parseInput(JSON.parse(text));
  } catch (error) { return Response.json({ error: error instanceof SyntaxError ? "입력값을 확인해 주세요." : (error as Error).message }, { status: 400 }); }
  if (busy) return Response.json({ error: "다른 추출 작업이 진행 중입니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  busy = true;
  let directory: string | undefined;
  try {
    const ytdlp = binary("yt-dlp", process.env.YTDLP_PATH);
    const ffmpeg = binary("ffmpeg", process.env.FFMPEG_PATH);
    const deno = binary("deno", process.env.DENO_PATH);
    const jsRuntime = process.env.DENO_PATH || existsSync(deno) || Number(process.versions.node.split(".")[0]) < 22 ? `deno:${deno}` : `node:${process.execPath}`;
    await run(ffmpeg, ["-version"], request.signal, 10_000);
    directory = await mkdtemp(path.join(tmpdir(), "cut-youtube-"));
    const metadata = JSON.parse(await run(ytdlp, ["--ignore-config", "--no-playlist", "--js-runtimes", jsRuntime, "--dump-single-json", "--skip-download", "--", input.url], request.signal, 45_000));
    if (metadata.is_live || !Number.isFinite(metadata.duration)) throw new Error("실시간 방송은 지원하지 않습니다.");
    if (input.end > metadata.duration) return Response.json({ error: `종료 시간이 영상 길이(${Math.floor(metadata.duration)}초)를 초과합니다.` }, { status: 400 });
    const common = ["--ignore-config", "--no-playlist", "--js-runtimes", jsRuntime, "--socket-timeout", "20", "--retries", "2", "--ffmpeg-location", ffmpeg];
    try {
      await run(ytdlp, [...common, "-f", "bestaudio/best", "--download-sections", `*${input.start}-${input.end}`, "--force-keyframes-at-cuts", "-x", "--audio-format", "mp3", "--audio-quality", "192K", "-o", path.join(directory, "clip.%(ext)s"), "--", input.url], request.signal);
    } catch (error) {
      if (request.signal.aborted || !/\b403\b|Forbidden/i.test((error as Error).message)) throw error;
      // FFmpeg's remote downloader can be rejected even when yt-dlp's native
      // downloader works. Refresh the source URL and trim a local audio file.
      console.info("Section download rejected (403); retrying with native audio download.");
      await run(ytdlp, [...common, "--downloader", "native", "--abort-on-unavailable-fragments", "--max-filesize", "250M", "-f", "bestaudio[protocol=https]/bestaudio[protocol=http]", "-o", path.join(directory, "source.%(ext)s"), "--", input.url], request.signal);
      const source = (await readdir(directory)).find(name => /^source\.(?!.*\.(?:part|ytdl)$)[a-z0-9]+$/i.test(name));
      if (!source) throw new Error("원본 오디오를 다운로드하지 못했습니다. 파일 크기 제한은 250MB입니다.");
      await run(ffmpeg, ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-ss", String(input.start), "-i", path.join(directory, source), "-t", String(input.end - input.start), "-vn", "-c:a", "libmp3lame", "-b:a", "192k", path.join(directory, "clip.mp3")], request.signal);
    }
    const audio = await readFile(path.join(directory, "clip.mp3"));
    const title = String(metadata.title || "youtube").replace(/[\x00-\x1f<>:"/\\|?*]/g, "_").slice(0, 100);
    const filename = `${title}_${input.start}-${input.end}.mp3`;
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Content-Disposition": `attachment; filename="clip.mp3"; filename*=UTF-8''${encodeURIComponent(filename)}`, "Cache-Control": "no-store" } });
  } catch (error) {
    const message = (error as Error).message || "";
    if (request.signal.aborted || (error as Error).name === "AbortError") {
      return Response.json({ error: "추출 요청이 취소되었습니다." }, { status: 499 });
    }
    const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
    const forbidden = /\b403\b|Forbidden/i.test(message);
    console.error("Extraction failed:", message.replace(/https?:\/\/\S+/g, "[media URL removed]").replace(/\S*[?&](?:sig|lsig|spc|expire|mm)=\S*/g, "[media parameters removed]").slice(-1000));
    return Response.json({ error: missing ? "추출 도구가 설치되지 않았습니다. 터미널에서 npm run setup:tools를 실행해 주세요." : forbidden ? "유튜브가 오디오 다운로드를 거부했습니다(403). 대체 다운로드도 실패했습니다. yt-dlp를 업데이트한 뒤 다시 시도해 주세요." : /실시간|250MB/.test(message) ? message : "영상을 추출하지 못했습니다. 공개 영상인지 확인하고 다시 시도해 주세요. 유튜브 접근 제한 또는 처리 시간 초과가 원인일 수 있습니다." }, { status: missing ? 503 : 502 });
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => {});
    busy = false;
  }
}
