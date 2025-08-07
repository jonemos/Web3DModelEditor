# Command Pattern Implementation for Undo/Redo

이 디렉토리에는 에디터의 Undo/Redo 기능을 구현하기 위한 커맨드 패턴이 포함되어 있습니다.

## 구조

### BaseCommand.js
- 모든 커맨드가 상속받아야 하는 기본 클래스
- `execute()`, `undo()`, `redo()` 메서드 정의
- 커맨드 병합 기능 지원

### CommandHistory.js
- 커맨드 히스토리를 관리하는 클래스
- Undo/Redo 스택 관리
- 최대 히스토리 개수 제한
- 상태 변경 리스너 지원

### ObjectCommands.js
- 객체 관련 커맨드들 구현
- `AddObjectCommand`: 객체 추가
- `RemoveObjectCommand`: 객체 삭제
- `TransformObjectCommand`: 객체 변형 (위치, 회전, 크기)
- `RenameObjectCommand`: 객체 이름 변경

## 사용법

### 1. 새 커맨드 생성
```javascript
import { AddObjectCommand } from './utils/commands';

const command = new AddObjectCommand(editorStore, objectData);
```

### 2. 커맨드 실행
```javascript
const { executeCommand } = useEditorStore();
executeCommand(command);
```

### 3. Undo/Redo
```javascript
const { undo, redo, historyState } = useEditorStore();

if (historyState.canUndo) {
  undo();
}

if (historyState.canRedo) {
  redo();
}
```

## 확장성

새로운 커맨드를 추가하려면:

1. `BaseCommand`를 상속받는 새 클래스 생성
2. `execute()`, `undo()` 메서드 구현
3. 필요시 `canMergeWith()`, `mergeWith()` 메서드 구현
4. `editorStore.js`에 새 커맨드 래퍼 액션 추가

## 키보드 단축키

- `Ctrl+Z`: Undo
- `Ctrl+Y` / `Ctrl+Shift+Z`: Redo

## 특징

- **자동 병합**: 연속적인 변형 커맨드는 자동으로 병합됨
- **메모리 효율성**: 최대 히스토리 개수 제한
- **에러 처리**: 커맨드 실행 실패 시 안전한 복구
- **상태 동기화**: UI 상태와 커맨드 히스토리 자동 동기화
