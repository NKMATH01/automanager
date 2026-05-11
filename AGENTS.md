# AGENTS.md

이 저장소에서 작업하는 사람 및 AI 기여자를 위한 가이드입니다.

## 1. 목적

오토매니저는 AI 에이전트 회사를 위한 컨트롤 플레인입니다.
현재 구현 대상은 V1이며, `doc/SPEC-implementation.md`에 정의되어 있습니다.

## 2. 먼저 읽기

변경하기 전에 다음 순서로 읽으세요:

1. `doc/GOAL.md`
2. `doc/PRODUCT.md`
3. `doc/SPEC-implementation.md`
4. `doc/DEVELOPING.md`
5. `doc/DATABASE.md`

## 3. 저장소 구조

- `server/`: Express REST API 및 오케스트레이션 서비스
- `ui/`: React + Vite 보드 UI
- `packages/db/`: Drizzle 스키마, 마이그레이션, DB 클라이언트
- `packages/shared/`: 공유 타입, 상수, 유효성 검사기, API 경로 상수
- `packages/adapters/`: 에이전트 어댑터 구현 (Claude, Codex, Cursor 등)
- `packages/adapter-utils/`: 공유 어댑터 유틸리티
- `packages/plugins/`: 플러그인 시스템 패키지
- `doc/`: 운영 및 제품 문서

## 4. 개발 환경 설정 (자동 DB)

`DATABASE_URL`을 설정하지 않으면 임베디드 PGlite를 사용합니다.

```sh
pnpm install
pnpm dev
```

시작 항목:

- API: `http://localhost:3100`
- UI: `http://localhost:3100` (개발 미들웨어 모드에서 API 서버가 제공)

빠른 확인:

```sh
curl http://localhost:3100/api/health
curl http://localhost:3100/api/companies
```

로컬 개발 DB 초기화:

```sh
rm -rf data/pglite
pnpm dev
```

## 5. 핵심 엔지니어링 규칙

1. 변경사항은 회사 범위로 유지하세요.
모든 도메인 엔티티는 회사에 범위가 지정되어야 하며, 라우트/서비스에서 회사 경계를 강제해야 합니다.

2. 계약을 동기화하세요.
스키마/API 동작을 변경하면 영향받는 모든 레이어를 업데이트하세요:
- `packages/db` 스키마 및 내보내기
- `packages/shared` 타입/상수/유효성 검사기
- `server` 라우트/서비스
- `ui` API 클라이언트 및 페이지

3. 컨트롤 플레인 불변성을 유지하세요.
- 단일 담당자 작업 모델
- 원자적 이슈 체크아웃 시맨틱
- 관리 작업에 대한 승인 게이트
- 예산 하드스톱 자동 일시정지 동작
- 변경 작업에 대한 활동 로깅

4. 요청받지 않는 한 전략 문서를 통째로 교체하지 마세요.
추가 업데이트를 선호합니다.

5. 계획 문서는 날짜를 기입하고 중앙 집중화하세요.
새 계획 문서는 `doc/plans/`에 속하며 `YYYY-MM-DD-slug.md` 파일명을 사용해야 합니다.

## 6. 데이터베이스 변경 워크플로우

데이터 모델 변경 시:

1. `packages/db/src/schema/*.ts` 편집
2. 새 테이블이 `packages/db/src/schema/index.ts`에서 내보내기되는지 확인
3. 마이그레이션 생성:

```sh
pnpm db:generate
```

4. 컴파일 검증:

```sh
pnpm -r typecheck
```

## 7. 핸드오프 전 검증

완료를 선언하기 전에 전체 검사를 실행하세요:

```sh
pnpm -r typecheck
pnpm test:run
pnpm build
```

실행할 수 없는 항목이 있으면 무엇을 실행하지 못했는지와 이유를 명시적으로 보고하세요.

## 8. API 및 인증 요구사항

- 기본 경로: `/api`
- 보드 접근은 전체 제어 운영자 컨텍스트로 처리됨
- 에이전트 접근은 베어러 API 키(`agent_api_keys`) 사용, 저장 시 해시됨
- 에이전트 키는 다른 회사에 접근할 수 없어야 함

엔드포인트 추가 시:
- 회사 접근 검사 적용
- 액터 권한 강제 (보드 vs 에이전트)
- 변경 작업에 활동 로그 항목 작성
- 일관된 HTTP 오류 반환 (`400/401/403/404/409/422/500`)

## 9. UI 요구사항

- 라우트와 내비게이션을 사용 가능한 API 표면과 정렬하세요
- 회사 범위 페이지에 회사 선택 컨텍스트를 사용하세요
- 실패를 명확하게 표시하세요; API 오류를 조용히 무시하지 마세요

## 10. 완료 정의

다음 모든 조건이 참일 때 변경이 완료됩니다:

1. 동작이 `doc/SPEC-implementation.md`와 일치
2. 타입체크, 테스트, 빌드 통과
3. 계약이 db/shared/server/ui 간 동기화됨
4. 동작이나 명령어 변경 시 문서 업데이트됨
