# GLBMeshManager 클래스 가이드

## 개요

`GLBMeshManager`는 Web3DModelEditor에서 GLB 메쉬의 로드, 저장, 썸네일 생성, 변환 등을 통합 관리하는 클래스입니다. 라이브러리 메쉬와 커스텀 메쉬 관련 모든 기능을 하나의 클래스에서 제공합니다.

## 주요 기능

### 1. 라이브러리 메쉬 관리
- 미리 정의된 GLB 메쉬 파일들을 자동으로 검색하고 로드
- 썸네일 자동 생성
- 파일 존재 여부 확인

### 2. 커스텀 메쉬 관리
- 3D 오브젝트를 GLB 형식으로 변환
- 로컬 스토리지에 저장/로드
- 썸네일 자동 생성
- 메쉬 삭제

### 3. 썸네일 생성
- GLB URL로부터 썸네일 생성
- 3D 오브젝트로부터 썸네일 생성
- 통일된 렌더링 설정

### 4. 데이터 변환
- ArrayBuffer, Uint8Array, Array 등 다양한 형식의 GLB 데이터 처리
- Blob URL 생성
- GLB 모델 로드

## 사용법

### 기본 사용법

```javascript
import { getGLBMeshManager } from '../utils/GLBMeshManager';

// 싱글톤 인스턴스 가져오기
const glbMeshManager = getGLBMeshManager();
```

### 라이브러리 메쉬 로드

```javascript
// 라이브러리 메쉬 목록 로드
const libraryMeshes = await glbMeshManager.loadLibraryMeshes();

// 각 메쉬의 썸네일 생성
for (const mesh of libraryMeshes) {
  try {
    const thumbnail = await glbMeshManager.generateThumbnailFromURL(mesh.glbUrl);
    mesh.thumbnail = thumbnail;
  } catch (error) {
    console.error('썸네일 생성 실패:', error);
  }
}
```

### 커스텀 메쉬 추가

```javascript
// 3D 오브젝트를 커스텀 메쉬로 추가
const meshData = await glbMeshManager.addCustomMesh(threeObject, '메쉬 이름');

// 결과: 
// {
//   id: 'custom_1234567890',
//   name: '메쉬 이름',
//   fileName: 'custom_1234567890.glb',
//   thumbnail: 'data:image/png;base64,...',
//   type: 'custom',
//   glbData: [ArrayBuffer],
//   createdAt: 1234567890
// }
```

### 커스텀 메쉬 관리

```javascript
// 저장된 커스텀 메쉬 목록 가져오기
const customMeshes = glbMeshManager.getCustomMeshes();

// 커스텀 메쉬 삭제
const updatedMeshes = glbMeshManager.deleteCustomMesh('custom_1234567890');
```

### GLB 데이터 변환

```javascript
// GLB 데이터를 Blob URL로 변환
const blobUrl = glbMeshManager.createBlobURL(glbData);

// GLB 모델 로드
const model = await glbMeshManager.loadGLBModel(blobUrl);
```

### 썸네일 생성

```javascript
// URL로부터 썸네일 생성
const thumbnail1 = await glbMeshManager.generateThumbnailFromURL('/path/to/model.glb');

// 3D 오브젝트로부터 썸네일 생성
const thumbnail2 = glbMeshManager.generateThumbnailFromObject(threeObject, 128);
```

## 지원하는 GLB 데이터 형식

GLBMeshManager는 다음과 같은 다양한 GLB 데이터 형식을 지원합니다:

- `ArrayBuffer`: 표준 바이너리 데이터
- `Uint8Array`: 타입 배열
- `Array`: 일반 배열 (숫자 배열)
- `Buffer` 객체: Node.js Buffer 형식

## 라이브러리 메쉬 파일 구조

기본적으로 다음 경로의 GLB 파일들을 자동으로 감지합니다:

```
public/library/mesh/
├── 111.glb
├── 222.glb
├── SM_MERGED_BP_C_GY_Floor_C_1.glb
├── SM_MERGED_BP_GY_Ceil_C_1.glb
├── SM_MERGED_BP_GY_Pillar_C_1.glb
├── SM_MERGED_BP_GY_Wall_C_1.glb
└── SM_MERGED_StaticMeshActor_0.glb
```

## 메모리 관리

```javascript
// 리소스 정리 (앱 종료 시)
import { disposeGLBMeshManager } from '../utils/GLBMeshManager';

disposeGLBMeshManager();
```

## 이벤트 시스템

커스텀 메쉬가 추가될 때 자동으로 이벤트를 발생시킵니다:

```javascript
// 이벤트 리스너 등록
window.addEventListener('customMeshAdded', (event) => {
  console.log('새 커스텀 메쉬 추가됨:', event.detail);
});

// 이벤트 발생 (GLBMeshManager 내부에서 자동 호출)
window.dispatchEvent(new CustomEvent('customMeshAdded', { detail: meshData }));
```

## 오류 처리

모든 메서드는 적절한 오류 처리를 포함하고 있으며, 실패 시 콘솔에 상세한 오류 정보를 출력합니다:

```javascript
try {
  const meshData = await glbMeshManager.addCustomMesh(object, name);
} catch (error) {
  console.error('메쉬 추가 실패:', error);
  // 사용자에게 오류 메시지 표시
}
```

## 성능 고려사항

- 썸네일 생성은 비동기로 처리되어 UI 블로킹을 방지합니다
- 싱글톤 패턴으로 메모리 사용량을 최적화합니다
- Blob URL은 사용 후 자동으로 해제됩니다
- 썸네일 렌더러는 재사용되어 성능을 향상시킵니다

## 마이그레이션 가이드

기존 `MeshLibraryManager`와 `thumbnailGenerator`에서 마이그레이션하는 방법:

### Before (기존 코드)

```javascript
import { MeshLibraryManager } from '../utils/meshLibraryManager';
import { generateThumbnail } from '../utils/thumbnailGenerator';

const meshLibraryManager = new MeshLibraryManager();
const thumbnail = await generateThumbnail(glbUrl);
const meshData = await meshLibraryManager.addMeshToLibrary(object, name);
```

### After (새로운 코드)

```javascript
import { getGLBMeshManager } from '../utils/GLBMeshManager';

const glbMeshManager = getGLBMeshManager();
const thumbnail = await glbMeshManager.generateThumbnailFromURL(glbUrl);
const meshData = await glbMeshManager.addCustomMesh(object, name);
```

이제 모든 GLB 메쉬 관련 기능이 하나의 통합된 클래스에서 관리됩니다!
