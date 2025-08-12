# 라이브러리 메쉬 추가 방법

이 폴더에 GLB 형식의 3D 모델 파일을 추가하면 라이브러리 패널에서 사용할 수 있습니다.

## 지원되는 파일 형식
- .glb (GLTF Binary format)

## 현재 설정된 파일 목록
라이브러리 패널에서 다음 파일들을 자동으로 로드합니다:
- 111.glb → "메쉬 111"로 표시
- 222.glb → "메쉬 222"로 표시

## 파일 추가 방법
1. GLB 파일을 이 폴더(`public/library/mesh/`)에 복사
2. 파일명을 `111.glb` 또는 `222.glb`로 변경 (또는 LibraryPanel.jsx에서 파일 목록 수정)
3. 에디터를 새로고침하면 라이브러리 패널에 자동으로 표시됩니다

## 추가 파일을 원하는 경우
`src/components/editor/panels/LibraryPanel.jsx` 파일의 `meshFiles` 배열에 새로운 파일 정보를 추가하세요:

```javascript
const meshFiles = [
  { filename: '111.glb', name: '메쉬 111' },
  { filename: '222.glb', name: '메쉬 222' },
  { filename: 'your-model.glb', name: '사용자 모델' }, // 새로운 파일 추가
];
```

## GLB 파일 생성 방법
- Blender에서 Export → glTF 2.0 (.glb) 선택
- 3ds Max에서 babylon.js exporter 사용
- Maya에서 FBX → glTF 변환 도구 사용
- Online converters (FBX to GLB, OBJ to GLB 등)

## 주의사항
- 파일 크기는 가급적 10MB 이하로 유지
- 텍스처가 포함된 경우 GLB 형식 사용 권장
- 모델의 스케일은 자동으로 조정됩니다
