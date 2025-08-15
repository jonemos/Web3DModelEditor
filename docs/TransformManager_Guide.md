# 입력 시스템 및 TransformManager 가이드

새로운 입력 시스템은 키보드 단축키와 마우스 컨트롤을 별도의 클래스로 분리하여 체계적으로 관리합니다.

## 아키텍처 개요

```
EditorControls
├── InputManager           (입력 이벤트 중앙 관리)
├── KeyboardController     (키보드 단축키 전담)
├── MouseController        (마우스 입력 전담)
├── CameraController       (카메라 제어)
├── ObjectSelector         (오브젝트 선택)
└── TransformManager       (변형 및 기즈모 제어)
```

## 주요 특징

- **분리된 책임**: 각 컨트롤러가 명확한 역할 담당
- **중앙 집중식 입력 관리**: InputManager가 모든 입력 이벤트 라우팅
- **확장 가능한 구조**: 새로운 기능 추가가 매우 쉬움
- **충돌 없는 키 매핑**: KeyboardController가 키 충돌 방지
- **메모리 최적화**: 체계적인 정리 시스템

## 입력 시스템

### InputManager
모든 키보드, 마우스, 휠 이벤트를 중앙에서 관리하고 적절한 컨트롤러로 라우팅합니다.

```javascript
// InputManager 직접 사용 (일반적으로 필요 없음)
const inputManager = new InputManager();
inputManager.setupMouseEvents(canvas);
inputManager.registerKeyHandler('default', keyHandler);
```

### KeyboardController  
키보드 단축키를 카테고리별로 체계적으로 관리합니다.

```javascript
// KeyboardController 직접 접근
const keyboardController = editorControls.keyboardController;

// 키 매핑 정보 조회
const mappings = keyboardController.getKeyMappings();
console.log(mappings);

// 키 충돌 확인
const conflicts = keyboardController.checkKeyConflicts();

// 도움말 텍스트 생성
const helpText = keyboardController.generateHelpText();
console.log(helpText);
```

### MouseController
마우스 입력을 세분화하여 처리합니다.

```javascript
// MouseController 직접 접근
const mouseController = editorControls.mouseController;

// 드래그 임계값 설정
mouseController.setDragThreshold(10);

// 마우스 상태 조회
const mouseState = mouseController.getMouseState();
console.log(mouseState);
```

## 기본 사용법

```javascript
// EditorControls를 통한 통합 사용
const editorControls = new EditorControls(scene, camera, renderer, editorStore);

// Transform 기능
editorControls.setTransformMode('rotate');
editorControls.toggleGridSnap();
editorControls.duplicateSelectedObjects();

// 입력 시스템 제어
editorControls.keyboardController.setEnabled(false);  // 키보드 비활성화
editorControls.inputManager.setEnabled(true);         // 전체 입력 활성화
```

## 키보드 단축키

### Transform 모드
- **W**: 이동 모드
- **E**: 회전 모드  
- **R**: 크기 모드

### 좌표계 및 스냅
- **Q**: 좌표계 전환 (World ↔ Local)
- **X**: 그리드 스냅 토글
- **V**: 자석 기능 토글
- **C**: 자석 레이 표시 토글

### 선택 및 오브젝트 조작
- **Ctrl+A**: 전체 선택
- **ESC**: 모든 선택 해제
- **Delete/Backspace**: 선택된 오브젝트 삭제
- **Ctrl+D**: 오브젝트 복제
- **Ctrl+G**: 오브젝트 그룹화
- **Ctrl+Shift+G**: 그룹 해제

### 뷰포트 제어
- **F**: 선택된 오브젝트로 포커스
- **Numpad5**: 투영 모드 전환
- **Numpad1**: 정면 뷰
- **Numpad3**: 측면 뷰
- **Numpad7**: 상단 뷰
- **Numpad0**: 카메라 리셋

### 시스템
- **Ctrl+Z**: 실행 취소
- **Ctrl+Shift+Z**: 다시 실행
- **Ctrl+S**: 저장

## 마우스 컨트롤

### 기본 마우스 동작
- **왼쪽 클릭**: 오브젝트 선택
- **왼쪽 드래그**: 드래그 선택 (다중 선택)
- **중간 드래그**: 팬 (이동)
- **Alt + 중간 드래그**: 궤도 회전
- **휠**: 줌 인/아웃
- **오른쪽 클릭**: 컨텍스트 메뉴

### 다중 선택
- **Ctrl + 클릭**: 추가 선택
- **Shift + 클릭**: 범위 선택
- **드래그 박스**: 영역 내 모든 오브젝트 선택

## 커스터마이징

### 새로운 키보드 단축키 추가

```javascript
// 커스텀 키 등록
keyboardController.registerCustomKey(
  'KeyT',           // 키 코드
  'Toggle Tool',    // 액션 이름
  '도구 토글',       // 설명
  () => {          // 액션 함수
    console.log('도구 토글됨');
  },
  'custom',        // 카테고리
  false            // Ctrl 키 필요 여부
);
```

### 새로운 마우스 핸들러 추가

```javascript
// 커스텀 마우스 핸들러
mouseController.onRightClick((mouseInfo) => {
  console.log('오른쪽 클릭:', mouseInfo.position);
});

mouseController.onHover((hoverInfo) => {
  console.log('마우스 호버:', hoverInfo.position);
});
```

### Transform 액션 커스터마이징

```javascript
// Transform 액션 재정의
keyboardController.registerTransformActions({
  setMode: (mode) => {
    console.log(`Transform 모드 변경: ${mode}`);
    transformManager.setTransformMode(mode);
  },
  toggleSnap: () => {
    console.log('스냅 토글');
    transformManager.toggleGridSnap();
  }
});
```

## 디버깅 및 모니터링

### 입력 상태 모니터링

```javascript
// 현재 입력 상태 확인
const inputState = inputManager.getInputState();
console.log('입력 상태:', inputState);

// 현재 눌린 키들
const pressedKeys = inputManager.pressedKeys;
console.log('눌린 키들:', Array.from(pressedKeys));

// 조합키 상태
const modifiers = inputManager.getModifierKeys();
console.log('조합키:', modifiers);
```

### Transform 상태 모니터링

```javascript
// Transform 상태 확인
const transformState = transformManager.getState();
console.log('Transform 상태:', transformState);

// 실시간 상태 변경 모니터링
transformManager.logStateChange = (property, oldValue, newValue) => {
  console.log(`[Transform] ${property}: ${oldValue} → ${newValue}`);
};
```

## 성능 최적화

### 입력 이벤트 최적화
- 불필요한 핸들러 제거: `removeHandler()` 사용
- 입력 비활성화: `setEnabled(false)` 사용
- 드래그 임계값 조정: `setDragThreshold()` 사용

### 메모리 관리
```javascript
// 정리 시 자동으로 모든 리스너 제거
editorControls.dispose();

// 개별 컨트롤러 정리도 가능
inputManager.dispose();
keyboardController.dispose();
mouseController.dispose();
```

## 에러 처리

모든 입력 핸들러는 try-catch로 보호되어 있어 개별 핸들러의 오류가 전체 시스템을 중단시키지 않습니다.

```javascript
// 에러 발생 시 콘솔에 자동 로깅
// Error in keyboard handler: [에러 메시지]
// Error in mouse handler for mousedown: [에러 메시지]
```

이러한 구조로 입력 시스템이 매우 안정적이고 확장 가능하게 설계되었습니다.
