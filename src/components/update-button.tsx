"use client";
import { useEffect, useState } from "react";
type UpdateState = { currentVersion: string; status: string; message: string; version?: string; percent?: number };
declare global { interface Window { soundcutUpdates?: {
  getState(): Promise<UpdateState>; check(): Promise<UpdateState>; install(): Promise<UpdateState>;
  subscribe(callback: (state: UpdateState) => void): () => void;
} } }
export default function UpdateButton({ busy }: { busy: boolean }) {
  const [state, setState] = useState<UpdateState>();
  useEffect(() => {
    const bridge = window.soundcutUpdates;
    if (!bridge) return;
    let disposed = false;
    const update = (value: UpdateState) => { if (!disposed) setState(value); };
    const unsubscribe = bridge.subscribe(update);
    void bridge.getState().then(update).catch(() => {});
    return () => { disposed = true; unsubscribe(); };
  }, []);
  if (!state) return null;
  const working = ['checking', 'downloading', 'installing'].includes(state.status);
  async function act() {
    try {
      if (state?.status === 'ready') {
        if (!window.confirm('업데이트를 설치하고 다시 시작할까요? 현재 화면의 입력값과 추출 결과는 초기화됩니다.')) return;
        setState(await window.soundcutUpdates!.install());
      } else setState(await window.soundcutUpdates!.check());
    } catch { setState(previous => previous && { ...previous, message: '업데이트 요청에 실패했습니다. 다시 시도해 주세요.' }); }
  }
  return <div className="update-panel">
    <div><span>앱 버전 {state.currentVersion}</span><button type="button" disabled={working || state.status === 'disabled' || (busy && state.status === 'ready')} onClick={act}>
      {state.status === 'ready' ? '업데이트하고 다시 시작' : state.status === 'downloading' ? `다운로드 ${state.percent || 0}%` : state.status === 'checking' ? '확인 중…' : state.status === 'installing' ? '설치 준비 중…' : '업데이트 확인'}
    </button></div>
    <p role="status">{busy && state.status === 'ready' ? '추출을 완료하거나 취소한 뒤 업데이트할 수 있습니다.' : state.message}</p>
    {state.status === 'downloading' && <progress aria-label="업데이트 다운로드" max="100" value={state.percent || 0} />}
  </div>;
}
