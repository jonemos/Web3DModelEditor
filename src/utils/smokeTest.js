// 간단 스모크 테스트: 초기화/설정변경/모델 로드 시 적용 여부 점검
// 사용법: 앱 구동 후 개발자 콘솔에서 window.runSmokeTest()
import * as THREE from 'three'

export function runSmokeTest(editorControls, store) {
  const log = (ok, msg) => console[ok ? 'log' : 'error'](`[SMOKE] ${ok ? 'OK' : 'FAIL'} - ${msg}`)
  try {
    if (!editorControls || !store) {
      log(false, 'editorControls 또는 store 미존재');
      return false;
    }
    const s = store.getState();

    // 1) 초기 적용: update 호출이 에러 없이 동작하는지
    try {
      editorControls.applyInitialViewState?.();
      log(true, '초기 상태 적용 호출 완료');
    } catch (e) {
      log(false, `초기 상태 적용 실패: ${e?.message}`);
      return false;
    }

    // 2) 설정 변경 → 적용 확인 (와이어프레임 플립)
    const beforeWire = !!s.isWireframe;
    store.getState().toggleWireframe();
    try { editorControls.updateWireframe?.(); } catch {}
    const afterWire = !!store.getState().isWireframe;
    const flipped = beforeWire !== afterWire;
    log(flipped, '와이어프레임 토글 및 적용');

    // 3) 모델 로드 시 적용: 가짜 Mesh 추가하여 머티리얼 확인
  const mat = new THREE.MeshStandardMaterial();
  const geo = new THREE.BoxGeometry(1,1,1);
  const mesh = new THREE.Mesh(geo, mat);
    try {
      editorControls.scene.add(mesh);
      const okWire = mesh.material.wireframe === afterWire;
      log(okWire, '신규 Mesh 와이어프레임 자동 적용');
    } catch (e) {
      log(false, `신규 Mesh 추가/검증 실패: ${e?.message}`);
      return false;
    } finally {
      try { editorControls.scene.remove(mesh); geo.dispose(); mat.dispose(); } catch {}
    }

    return true;
  } catch (e) {
    log(false, `스모크 테스트 예외: ${e?.message}`);
    return false;
  }
}
