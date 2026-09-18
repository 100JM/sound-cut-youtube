# Soundcut

유튜브 영상의 시작·종료 시간을 선택해 MP3를 다운로드하는 Next.js + TypeScript 앱입니다.

## 실행 (Windows)

Node.js 20.9 이상이 필요합니다.

```powershell
npm install
npm run setup:tools
npm run dev
```

http://127.0.0.1:3000 에서 사용합니다. 설치 스크립트는 yt-dlp 공식 GitHub 릴리스와 Gyan FFmpeg 빌드를 `.tools`에 내려받습니다. macOS/Linux에서는 yt-dlp, FFmpeg, ffprobe를 설치해 PATH에 추가하세요. 별도 경로는 `.env.example`을 참고해 `.env.local`에 지정할 수 있습니다.

## Docker (노트북)

Docker Desktop이 실행 중이어야 합니다. 이미지에 Next.js, yt-dlp, FFmpeg가 포함되며 이 노트북의 `127.0.0.1:3000`에만 열립니다.

```powershell
docker compose up --build -d
```

http://127.0.0.1:3000 에서 사용합니다. 중지와 삭제는 `docker compose down`입니다.

## 사용

1. 유튜브 공개 영상 주소를 입력합니다. Shorts와 youtu.be 주소도 지원합니다.
2. 시작·종료 시간을 초, `분:초`, `시:분:초`로 입력합니다.
3. 추출이 완료되면 오디오를 미리 듣고 MP3를 다운로드합니다.

최대 30분 구간을 192 kbps MP3로 변환합니다. 구간 다운로드가 403으로 거부되면 yt-dlp의 직접 다운로드 방식으로 원본 오디오(최대 250MB)를 받은 뒤 로컬에서 자르는 방식으로 한 번 재시도합니다. 이 경우 전체 오디오를 받으므로 시간이 더 걸릴 수 있으며, 유튜브 접근 차단 자체를 해결하지는 못합니다. 원본 음질보다 개선되지는 않습니다. 서버 임시 파일은 작업 종료 시 삭제됩니다. 화면의 파형은 장식이며 실제 오디오 파형이 아닙니다. 직접 제작했거나 다운로드 권한이 있는 영상에 사용하세요.

## 구조와 운영

- `src/app/page.tsx`: 입력, 취소, 미리 듣기, 다운로드
- `src/app/api/extract/route.ts`: 입력 검증 → 영상 정보 확인 → yt-dlp 구간 다운로드 및 FFmpeg 변환 → 파일 응답 → 임시 파일 정리
- `src/lib/input.ts`: 허용된 유튜브 주소 정규화, 시간 및 길이 검증

로컬 사용을 기본으로 하며 서버는 127.0.0.1에 바인딩됩니다. 프로세스별 동시 작업은 한 개입니다. 공개 서비스로 운영하려면 인증, 사용자별 요청 제한, 작업 큐 및 프로세스/디스크 자원 제한을 추가해야 합니다. 외부 실행 파일과 긴 처리 시간이 필요하므로 Node.js 서버/컨테이너에 배포하세요. 일반적인 서버리스 환경에는 적합하지 않습니다.

로그인·연령·지역 제한, 비공개 영상, 라이브 방송은 지원하지 않습니다. 유튜브의 봇 차단 등으로 공개 영상도 실패할 수 있습니다. 문제가 생기면 yt-dlp를 업데이트하세요. 유튜브 JavaScript 처리를 위해 설치 스크립트가 Deno도 `.tools`에 설치합니다. 별도 경로는 `DENO_PATH`로 지정할 수 있습니다. macOS/Linux에서는 Deno 2.3 이상 또는 Node.js 22 이상이 필요합니다. Next.js 실행에 필요한 Node.js 버전과 yt-dlp가 지원하는 버전은 다릅니다.

## 검증

```powershell
npm test
npm run typecheck
npm run build
```

참고: [Next.js 문서](https://nextjs.org/docs/app), [yt-dlp 문서](https://github.com/yt-dlp/yt-dlp), [FFmpeg Windows 빌드](https://www.gyan.dev/ffmpeg/builds/)
