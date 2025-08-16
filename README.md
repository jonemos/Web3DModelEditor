# ThirdPerson TreeJS Game - React Edition

React와 Vite로 구축된 3D 탐험 게임으로 PWA(Progressive Web App) 지원과 모바일 호환성을 제공합니다.

## 🎮 게임 특징

- **3인칭 시점**: 플레이어를 따라다니는 부드러운 카메라
- **실시간 3D 렌더링**: Three.js 기반의 고품질 3D 그래픽
- **인터랙티브 환경**: 수집 가능한 아이템과 탐험 요소
- **반응형 디자인**: 모바일과 데스크톱 모두 지원
- **PWA 지원**: 앱처럼 설치하고 오프라인에서도 플레이 가능
- **맵 에디터**: 실시간 3D 맵 제작 도구

## 🎯 게임 플레이

- **WASD**: 플레이어 이동
- **마우스**: 카메라 회전 및 줌
- **ESC**: 게임 일시정지
- **H**: 홈으로 돌아가기
- **마우스 클릭**: 아이템 수집

## 📁 프로젝트 구조

```
src/
├── main.jsx              # React 앱 진입점
├── App.jsx               # 메인 앱 컴포넌트
├── pages/                # 페이지 컴포넌트들
│   ├── HomePage.jsx      # 시작 페이지
│   ├── GamePage.jsx      # 게임 페이지
│   └── EditorPage.jsx    # 에디터 페이지
├── components/           # 재사용 가능한 컴포넌트들
│   ├── game/            # 게임 관련 컴포넌트
│   │   ├── GameCanvas.jsx # 3D 게임 캔버스
│   │   └── GameUI.jsx    # 게임 UI
│   └── editor/          # 에디터 관련 컴포넌트
│       ├── EditorCanvas.jsx # 3D 에디터 캔버스
│       ├── EditorUI.jsx    # 에디터 UI
│       └── SceneObjects.jsx # 씬 오브젝트 관리
└── store/               # 상태 관리
    ├── gameStore.js     # 게임 상태
    └── editorStore.js   # 에디터 상태
```

## 🚀 실행 방법

### 개발 환경 실행
```bash
# 의존성 설치
npm install

# 개발 서버 시작
npm run dev
```

### 프로덕션 빌드
```bash
# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
```

## 🛠️ 기술 스택

- **React 18**: 최신 React 컴포넌트 시스템
- **Vite 4**: 빠른 개발 서버와 번들링
- **Three.js r155**: 최신 3D 그래픽 라이브러리
- **React Three Fiber**: React와 Three.js의 완벽한 통합
- **React Three Drei**: 유용한 Three.js 헬퍼 컴포넌트
- **Zustand**: 경량 상태 관리 라이브러리
- **React Router**: SPA 라우팅
- **Vite PWA**: Progressive Web App 기능

## ⚙️ 주요 기능

### 게임 모드
- 3D 환경에서의 자유로운 탐험
- 플레이어 캐릭터 컨트롤 (WASD + 마우스)
- 수집 가능한 아이템들
- 동적 나무 생성 및 배치
- 실시간 카메라 컨트롤

### 에디터 모드
- 3D 맵 제작 도구
- 오브젝트 배치 및 변형 (이동, 회전, 크기 조절)
- GLTF/GLB 모델 업로드 및 배치
- 맵 저장/불러오기 기능
- 실시간 미리보기

## 🎨 커스터마이징

### 게임 설정 수정
- `src/store/gameStore.js`: 기본 게임 설정값 변경
- `src/components/game/GameCanvas.jsx`: 게임 오브젝트 및 로직 수정

### 에디터 설정
- `src/store/editorStore.js`: 에디터 기본 설정값 변경
- `src/components/editor/`: 에디터 UI 및 기능 커스터마이징

## 🔧 개발자 정보

### 디버깅
- 브라우저 개발자 도구의 콘솔에서 로그 확인
- React DevTools를 통한 컴포넌트 상태 확인
- 각 모듈별로 독립적인 디버깅 가능

### 성능 최적화
- React Three Fiber의 자동 최적화 활용
- Three.js 오브젝트 수 제한
- 텍스처 크기 최적화
- 불필요한 리렌더링 방지

## 📱 브라우저 호환성

- **Chrome** 90+
- **Firefox** 85+
- **Safari** 14+
- **Edge** 90+
- **Mobile Chrome** (Android)
- **Mobile Safari** (iOS)

## 🔮 향후 계획

- 멀티플레이어 기능 추가
- 더 다양한 게임 모드
- 고급 물리 엔진 통합
- VR/AR 지원
- 소셜 기능 (점수 공유 등)

## 📄 라이선스

MIT License

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

**즐거운 게임하세요! 🎮**

---

## 설정과 자동 저장 (Editor)

- 통합 설정 매니저: `src/utils/viewGizmoConfig.js`
    - 섹션: `viewGizmo`, `ui`, `editor`, `game`
    - 로컬 스토리지에 단일 키로 저장, 구버전 `viewGizmoConfig` 자동 마이그레이션
- Zustand에서 `startSettingsAutoPersist`로 자동 저장 연결
- 적용 타이밍: 초기화, 설정 변경, 모델 로드 후 자동 반영
- UI 섹션에는 뷰/기즈모 설정 팝오버 열림 상태(`isViewGizmoSettingsOpen`)도 저장

개발 중 빠른 확인을 위한 스모크 테스트 유틸: `src/utils/smokeTest.js`
- 브라우저 콘솔에서 실행 예: `runSmokeTest(window.__editorControls, useEditorStore)`
