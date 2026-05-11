# 기여 가이드

기여에 관심을 가져주셔서 감사합니다!

작은 수정이든 큰 변경이든 모두 환영합니다.

## 개발 환경 설정

```bash
# 저장소 클론
git clone <repo-url> automanager
cd automanager

# 의존성 설치
pnpm install

# 개발 서버 실행
pnpm dev
```

## 코드 스타일

- TypeScript 사용
- `pnpm typecheck`로 타입 검사 통과 필수
- `pnpm test:run`으로 테스트 통과 필수

## 한글화 가이드

이 프로젝트는 Paperclip의 한글 버전입니다. 코드 기여 시 다음을 준수해주세요:

### 한글로 작성하는 것
- UI에 표시되는 모든 텍스트 (버튼, 라벨, 메시지 등)
- 에러 메시지 (사용자에게 보이는 것)
- CLI 출력 메시지
- 문서 (README, 주석 등)

### 영문으로 유지하는 것
- 변수명, 함수명, 클래스명
- API 엔드포인트 경로
- DB 스키마 (컬럼명, 테이블명)
- 패키지명, import 경로
- CSS 클래스명

## 라이선스

이 프로젝트에 기여하면 MIT 라이선스에 따라 배포됩니다.
