"use client";
import { useEffect, useRef, useState } from "react";
import { seconds } from "@/lib/input";

type Player = { destroy(): void; getDuration(): number; getCurrentTime(): number; seekTo(time: number, allow: boolean): void; playVideo(): void; pauseVideo(): void };
type YouTube = { Player: new (element: HTMLElement, options: { videoId: string; playerVars: Record<string, string | number>; events: { onReady(): void; onError(): void } }) => Player };
declare global { interface Window { YT?: YouTube; onYouTubeIframeAPIReady?: () => void } }
let api: Promise<YouTube> | undefined;
function loadAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!api) api = new Promise<YouTube>((resolve, reject) => {
    const script = document.createElement("script");
    const timer = setTimeout(() => { script.remove(); api = undefined; reject(new Error("timeout")); }, 15000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); resolve(window.YT!); };
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => { clearTimeout(timer); script.remove(); api = undefined; reject(new Error("network")); };
    document.head.appendChild(script);
  });
  return api;
}
export function formatTime(value: number) {
  const tenths = Math.round(Math.max(0, value) * 10);
  const total = Math.floor(tenths / 10);
  const hours = Math.floor(total / 3600);
  return `${hours ? `${hours}:` : ""}${String(Math.floor(total / 60) % 60).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}${tenths % 10 ? `.${tenths % 10}` : ""}`;
}
function numeric(value: string) { try { return seconds(value); } catch { return 0; } }

export default function VideoEditor({ videoId, start, end, disabled, onStart, onEnd, onDuration }: {
  videoId: string; start: string; end: string; disabled: boolean; onStart(value: string): void; onEnd(value: string): void; onDuration(value: number): void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const latest = useRef({ start, end, onEnd, onDuration });
  latest.current = { start, end, onEnd, onDuration };
  const previewing = useRef(false);
  const [length, setLength] = useState(0);
  const [current, setCurrent] = useState(0);
  const [message, setMessage] = useState("영상을 불러오고 있어요…");
  useEffect(() => {
    let disposed = false, ready = false, initialized = false;
    const host = document.createElement("div");
    container.current!.appendChild(host);
    const timer = setInterval(() => {
      if (!ready || !player.current) return;
      const duration = player.current.getDuration();
      if (Number.isFinite(duration) && duration > 0) {
        setLength(duration);
        latest.current.onDuration(duration);
        if (!initialized) {
          initialized = true;
          if (numeric(latest.current.end) > duration) latest.current.onEnd(formatTime(Math.floor(duration * 10) / 10));
          setMessage("");
        }
      }
      const time = player.current.getCurrentTime();
      setCurrent(time || 0);
      if (previewing.current && time >= numeric(latest.current.end)) { player.current.pauseVideo(); previewing.current = false; }
    }, 200);
    const timeout = setTimeout(() => { if (!initialized) setMessage("영상의 재생 버튼을 눌러 길이를 불러와 주세요. 표시되지 않으면 시간 직접 입력을 이용해 주세요."); }, 18000);
    loadAPI().then(YT => {
      if (disposed) return;
      player.current = new YT.Player(host, { videoId,
        playerVars: { origin: window.location.origin, playsinline: 1, rel: 0 },
        events: {
          onReady: () => { ready = true; },
          onError: () => { if (!disposed) { setMessage("이 영상은 미리보기를 재생할 수 없어요. 시간 직접 입력은 계속 사용할 수 있어요."); clearTimeout(timeout); } },
        },
      });
    }).catch(() => { if (!disposed) { clearTimeout(timeout); setMessage("영상 플레이어를 불러오지 못했어요. 인터넷 연결을 확인하거나 시간을 직접 입력해 주세요."); } });
    return () => { disposed = true; clearInterval(timer); clearTimeout(timeout); player.current?.destroy(); player.current = null; host.remove(); };
  }, [videoId]);
  const from = Math.min(length, numeric(start)), to = Math.min(length, numeric(end));
  let valid = false;
  try { const a = seconds(start), b = seconds(end); valid = b > a && b - a <= 1800 && b <= length; } catch {}
  const seek = (value: number) => { previewing.current = false; player.current?.seekTo(value, true); setCurrent(value); };
  return <section className="video-editor" aria-label="영상 미리보기 및 구간 선택">
    <div className="video-frame" ref={container} />
    {message && <p className="hint" role="status">{message}</p>}
    {length > 0 && <>
      <div className="timeline-heading"><strong>영상 구간 선택</strong><span>{formatTime(current)} / {formatTime(length)}</span></div>
      <label className="seek-label">재생 위치<input aria-label="재생 위치" type="range" min="0" max={length} step="0.1" value={Math.min(current, length)} disabled={disabled} onChange={e => seek(Number(e.target.value))} /></label>
      <div className="selection-track" aria-hidden="true"><span style={{ left: `${from / length * 100}%`, width: `${Math.max(0, to - from) / length * 100}%` }} /></div>
      <label className="clip-slider">시작 <input aria-label="시작 지점" type="range" min="0" max={length} step="0.1" value={from} disabled={disabled} onChange={e => { const value = Math.max(0, Math.min(Number(e.target.value), Math.floor(length * 10) / 10 - 0.1)); onStart(formatTime(value)); seek(value); }} /><output>{start}</output></label>
      <label className="clip-slider">종료 <input aria-label="종료 지점" type="range" min="0" max={length} step="0.1" value={to} disabled={disabled} onChange={e => { const value = Math.min(length, Math.max(Number(e.target.value), from + 0.1)); onEnd(formatTime(Math.floor(value * 10) / 10)); seek(value); }} /><output>{end}</output></label>
      <button className="preview-button" type="button" disabled={disabled || !valid} onClick={() => { player.current?.seekTo(from, true); previewing.current = true; player.current?.playVideo(); }}>▶ 선택 구간 미리 재생</button>
      <p className="hint">슬라이더를 움직이거나 아래에 시간을 입력하세요. 최대 30분까지 선택할 수 있어요.</p>
      {!valid && <p className="error">영상 길이 안에서 시작보다 늦은 종료 지점을 선택해 주세요. 최대 구간은 30분입니다.</p>}
    </>}
  </section>;
}
