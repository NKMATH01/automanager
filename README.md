<p align="center">
  <h1 align="center">오토매니저 (AutoManager)</h1>
  <p align="center">AI 에이전트 오케스트레이션 플랫폼</p>
</p>

<p align="center">
  <a href="#빠른-시작"><strong>빠른 시작</strong></a> &middot;
  <a href="#주요-기능"><strong>주요 기능</strong></a> &middot;
  <a href="#기술-스택"><strong>기술 스택</strong></a>
</p>

<br/>

## 오토매니저란?

# AI 에이전트 팀을 관리하는 오케스트레이션 플랫폼

**OpenClaw가 _직원_ 이라면, 오토매니저는 _회사_ 입니다**

오토매니저는 AI 에이전트 팀을 오케스트레이션하여 비즈니스를 운영하는 Node.js 서버와 React UI입니다. 에이전트를 등록하고, 목표를 할당하고, 하나의 대시보드에서 에이전트의 작업과 비용을 추적하세요.

작업 관리 도구처럼 보이지만, 내부에는 조직도, 예산, 거버넌스, 목표 정렬, 에이전트 조율 기능이 있습니다.

**풀 리퀘스트가 아닌 비즈니스 목표를 관리하세요.**

|        | 단계            | 예시                                                              |
| ------ | --------------- | ----------------------------------------------------------------- |
| **01** | 목표 정의        | _"AI 노트 앱을 만들어 MRR $1M 달성하기"_                            |
| **02** | 팀 구성          | CEO, CTO, 엔지니어, 디자이너, 마케터 — 어떤 봇이든, 어떤 제공자든.    |
| **03** | 승인 및 실행     | 전략을 검토하고, 예산을 설정하고, 시작하세요. 대시보드에서 모니터링.     |

<br/>

## 주요 기능

| 기능 | 설명 |
|------|------|
| **에이전트 통합** | Claude Code, Codex, Cursor, Gemini 등 모든 AI 에이전트 지원 |
| **하트비트** | 정해진 일정에 에이전트가 자동으로 작업 확인 및 수행 |
| **이슈/티켓** | 모든 대화 추적, 완전한 감사 로그 제공 |
| **목표 추적** | 회사 미션에서 세부 업무까지 계층적 추적 |
| **비용 통제** | 에이전트별 월 예산 설정 및 강제 실행 |
| **승인 프로세스** | 에이전트 작업 승인/거부 워크플로우 |
| **멀티 회사** | 단일 배포로 여러 회사 운영, 완벽한 데이터 분리 |
| **조직도** | 에이전트 구성원, 직책, 보고선 설정 |
| **플러그인** | 확장 가능한 플러그인 시스템 |
| **모바일 대응** | 어디서든 자율 비즈니스 관리 가능 |

## 빠른 시작

### 사전 요구 사항

- **Node.js** >= 20
- **pnpm** >= 9.15

### 설치 및 실행

```bash
# 1. 저장소 클론
git clone <repo-url> automanager
cd automanager

# 2. 의존성 설치
pnpm install

# 3. 개발 서버 실행
pnpm dev
```

API 서버가 `http://localhost:3100`에서 시작됩니다.
PostgreSQL은 임베디드 모드로 자동 생성됩니다.

### 주요 명령어

```bash
pnpm dev              # 전체 개발 (API + UI, 감시 모드)
pnpm dev:server       # 서버만 실행
pnpm dev:ui           # UI만 실행
pnpm build            # 전체 빌드
pnpm typecheck        # 타입 검사
pnpm test:run         # 테스트 실행
pnpm db:generate      # DB 마이그레이션 생성
pnpm db:migrate       # DB 마이그레이션 실행
```

## 기술 스택

| 영역 | 기술 |
|------|------|
| **언어** | TypeScript |
| **백엔드** | Node.js |
| **프론트엔드** | React + Vite |
| **데이터베이스** | PostgreSQL (임베디드 또는 외부) |
| **ORM** | Drizzle ORM |
| **패키지 관리** | pnpm (모노레포) |

## 프로젝트 구조

```
automanager/
├── cli/              # CLI 도구
├── server/           # Node.js API 서버
├── ui/               # React 프론트엔드
├── packages/         # 공유 패키지
│   ├── db/           # 데이터베이스 (Drizzle ORM)
│   ├── shared/       # 공유 타입/유틸
│   ├── adapters/     # 에이전트 어댑터
│   └── plugins/      # 플러그인 시스템
├── skills/           # 에이전트 스킬 라이브러리
├── docker/           # Docker 설정
└── tests/            # 테스트
```

## 원본 프로젝트

이 프로젝트는 [Paperclip](https://github.com/paperclipai/paperclip) (MIT License)을 기반으로 한 한글 버전입니다.

## 라이선스

MIT License
