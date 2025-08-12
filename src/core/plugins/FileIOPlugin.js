/**
 * FileIOPlugin - 파일 I/O 시스템 플러그인
 * 
 * 주요 특징:
 * - GLBMeshManager와 명령 시스템 통합
 * - 이벤트 기반 파일 로드/저장
 * - 진행률 추적 및 오류 처리
 * - 실행 취소/다시 실행 지원
 */

import * as THREE from 'three';
import { BasePlugin } from '../BasePlugin.js';
import { GLBMeshManagerModern } from '../../utils/GLBMeshManager.Modern.js';
import { eventBus, EventTypes } from '../EventBus.js';

export class FileIOPlugin extends BasePlugin {
  constructor() {
    super('FileIOPlugin');
    this.glbManager = null;
    this.loadOperations = new Map(); // 진행 중인 로드 작업 추적
    this.saveOperations = new Map(); // 진행 중인 저장 작업 추적
    this.commandFactories = new Map(); // 명령 팩토리들
  }

  async init(context) {
    await super.init(context);
    
    // GLBMeshManagerModern 초기화
    this.glbManager = new GLBMeshManagerModern({
      enableEvents: true,
      enableProgress: true,
      thumbnailSize: 128,
      maxConcurrentOperations: 3
    });
    
    // 명령 팩토리 등록
    this.registerCommandFactories();
    
    // 이벤트 리스너 등록
    this.registerEventListeners();
    
    console.log('✅ FileIOPlugin initialized with modern GLB manager');
  }

  /**
   * 명령 팩토리 등록
   */
  registerCommandFactories() {
    const commandSystem = this.getService('commandSystem');
    if (!commandSystem) return;

    // 파일 로드 명령
    this.commandFactories.set('loadFile', this.createLoadFileCommand.bind(this));
    this.commandFactories.set('loadLibraryMesh', this.createLoadLibraryMeshCommand.bind(this));
    this.commandFactories.set('loadCustomMesh', this.createLoadCustomMeshCommand.bind(this));
    
    // 파일 저장 명령
    this.commandFactories.set('saveFile', this.createSaveFileCommand.bind(this));
    this.commandFactories.set('exportMesh', this.createExportMeshCommand.bind(this));
    this.commandFactories.set('saveCustomMesh', this.createSaveCustomMeshCommand.bind(this));
    
    // 파일 관리 명령
    this.commandFactories.set('deleteCustomMesh', this.createDeleteCustomMeshCommand.bind(this));
    this.commandFactories.set('refreshLibrary', this.createRefreshLibraryCommand.bind(this));

    // 명령 시스템에 등록
    this.commandFactories.forEach((factory, commandId) => {
      commandSystem.registerCommandFactory(commandId, factory);
    });

    console.log('🔧 FileIO command factories registered:', Array.from(this.commandFactories.keys()));
  }

  /**
   * 이벤트 리스너 등록
   */
  registerEventListeners() {
    // 파일 드롭 이벤트
    this.addEventListener('file:drop', this.handleFileDrop.bind(this));
    
    // 라이브러리 요청 이벤트
    this.addEventListener('library:requestMeshes', this.handleLibraryRequest.bind(this));
    
    // 썸네일 생성 요청
    this.addEventListener('file:generateThumbnail', this.handleThumbnailRequest.bind(this));
    
    // 파일 상태 요청
    this.addEventListener('file:getStatus', this.handleStatusRequest.bind(this));
  }

  // ==================== 명령 팩토리들 ====================

  /**
   * 파일 로드 명령 생성
   */
  createLoadFileCommand(params) {
    const { file, targetScene, position = { x: 0, y: 0, z: 0 } } = params;
    
    return {
      id: `load_file_${Date.now()}`,
      type: 'loadFile',
      description: `파일 로드: ${file.name}`,
      
      execute: async (context) => {
        const operationId = `load_${Date.now()}`;
        this.loadOperations.set(operationId, { status: 'loading', progress: 0 });
        
        try {
          // 파일 로딩 시작 이벤트
          this.emit('file:loadStart', {
            operationId,
            fileName: file.name,
            fileSize: file.size
          });
          
          // 파일을 URL로 변환
          const fileUrl = URL.createObjectURL(file);
          
          // GLB 모델 로드
          const model = await this.glbManager.loadGLBModel(fileUrl);
          
          // 위치 설정
          model.position.set(position.x, position.y, position.z);
          
          // 씬에 추가
          if (targetScene) {
            targetScene.add(model);
          }
          
          // 로딩 완료
          this.loadOperations.set(operationId, { status: 'completed', model });
          
          // 성공 이벤트
          this.emit('file:loadComplete', {
            operationId,
            fileName: file.name,
            model,
            position
          });
          
          // URL 정리
          URL.revokeObjectURL(fileUrl);
          
          return { model, operationId };
          
        } catch (error) {
          this.loadOperations.set(operationId, { status: 'error', error });
          
          // 오류 이벤트
          this.emit('file:loadError', {
            operationId,
            fileName: file.name,
            error: error.message
          });
          
          throw error;
        }
      },
      
      undo: async (context) => {
        const { model } = context.result;
        if (model && model.parent) {
          model.parent.remove(model);
          
          this.emit('file:loadUndone', {
            fileName: file.name,
            model
          });
        }
      }
    };
  }

  /**
   * 라이브러리 메쉬 로드 명령 생성
   */
  createLoadLibraryMeshCommand(params) {
    const { meshId, targetScene, position = { x: 0, y: 0, z: 0 } } = params;
    
    return {
      id: `load_library_${meshId}_${Date.now()}`,
      type: 'loadLibraryMesh',
      description: `라이브러리 메쉬 로드: ${meshId}`,
      
      execute: async (context) => {
        try {
          // 라이브러리 메쉬 목록에서 찾기
          const libraryMeshes = await this.glbManager.loadLibraryMeshes();
          const meshInfo = libraryMeshes.find(mesh => mesh.id === meshId);
          
          if (!meshInfo) {
            throw new Error(`라이브러리 메쉬를 찾을 수 없습니다: ${meshId}`);
          }
          
          // GLB 모델 로드
          const model = await this.glbManager.loadGLBModel(meshInfo.glbUrl);
          
          // 위치 설정
          model.position.set(position.x, position.y, position.z);
          
          // 씬에 추가
          if (targetScene) {
            targetScene.add(model);
          }
          
          this.emit('library:meshLoaded', {
            meshId,
            meshInfo,
            model,
            position
          });
          
          return { model, meshInfo };
          
        } catch (error) {
          this.emit('library:meshLoadError', {
            meshId,
            error: error.message
          });
          
          throw error;
        }
      },
      
      undo: async (context) => {
        const { model } = context.result;
        if (model && model.parent) {
          model.parent.remove(model);
          
          this.emit('library:meshUnloaded', {
            meshId,
            model
          });
        }
      }
    };
  }

  /**
   * 커스텀 메쉬 로드 명령 생성
   */
  createLoadCustomMeshCommand(params) {
    const { meshId, targetScene, position = { x: 0, y: 0, z: 0 } } = params;
    
    return {
      id: `load_custom_${meshId}_${Date.now()}`,
      type: 'loadCustomMesh',
      description: `커스텀 메쉬 로드: ${meshId}`,
      
      execute: async (context) => {
        try {
          // 커스텀 메쉬 데이터 가져오기
          const customMeshes = this.glbManager.getCustomMeshes();
          const meshData = customMeshes.find(mesh => mesh.id === meshId);
          
          if (!meshData) {
            throw new Error(`커스텀 메쉬를 찾을 수 없습니다: ${meshId}`);
          }
          
          // GLB 데이터를 Blob URL로 변환
          const glbUrl = this.glbManager.createBlobURL(meshData.glbData);
          
          // GLB 모델 로드
          const model = await this.glbManager.loadGLBModel(glbUrl);
          
          // 위치 설정
          model.position.set(position.x, position.y, position.z);
          
          // 씬에 추가
          if (targetScene) {
            targetScene.add(model);
          }
          
          this.emit('custom:meshLoaded', {
            meshId,
            meshData,
            model,
            position
          });
          
          // URL 정리
          URL.revokeObjectURL(glbUrl);
          
          return { model, meshData };
          
        } catch (error) {
          this.emit('custom:meshLoadError', {
            meshId,
            error: error.message
          });
          
          throw error;
        }
      },
      
      undo: async (context) => {
        const { model } = context.result;
        if (model && model.parent) {
          model.parent.remove(model);
          
          this.emit('custom:meshUnloaded', {
            meshId,
            model
          });
        }
      }
    };
  }

  /**
   * 파일 저장 명령 생성
   */
  createSaveFileCommand(params) {
    const { objects, fileName, options = {} } = params;
    
    return {
      id: `save_file_${Date.now()}`,
      type: 'saveFile',
      description: `파일 저장: ${fileName}`,
      
      execute: async (context) => {
        try {
          this.emit('file:saveStart', {
            fileName,
            objectCount: Array.isArray(objects) ? objects.length : 1
          });
          
          // 단일 객체를 배열로 변환
          const objectsToSave = Array.isArray(objects) ? objects : [objects];
          
          // 모든 객체를 하나의 그룹으로 결합
          const group = new THREE.Group();
          objectsToSave.forEach(obj => {
            if (obj.clone) {
              group.add(obj.clone());
            }
          });
          
          // GLB로 익스포트
          const glbData = await this.glbManager.exportObjectToGLB(group, options);
          
          // 파일 다운로드
          const blob = new Blob([glbData], { type: 'model/gltf-binary' });
          const url = URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName.endsWith('.glb') ? fileName : `${fileName}.glb`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          URL.revokeObjectURL(url);
          
          this.emit('file:saveComplete', {
            fileName,
            objectCount: objectsToSave.length,
            fileSize: glbData.byteLength
          });
          
          return { fileName, fileSize: glbData.byteLength };
          
        } catch (error) {
          this.emit('file:saveError', {
            fileName,
            error: error.message
          });
          
          throw error;
        }
      }
    };
  }

  /**
   * 커스텀 메쉬 저장 명령 생성
   */
  createSaveCustomMeshCommand(params) {
    const { object, name, options = {} } = params;
    
    return {
      id: `save_custom_${Date.now()}`,
      type: 'saveCustomMesh',
      description: `커스텀 메쉬 저장: ${name}`,
      
      execute: async (context) => {
        try {
          const meshData = await this.glbManager.addCustomMesh(object, name, options);
          
          this.emit('custom:meshSaved', {
            meshData,
            name
          });
          
          return { meshData };
          
        } catch (error) {
          this.emit('custom:meshSaveError', {
            name,
            error: error.message
          });
          
          throw error;
        }
      },
      
      undo: async (context) => {
        const { meshData } = context.result;
        if (meshData && meshData.id) {
          this.glbManager.deleteCustomMesh(meshData.id);
          
          this.emit('custom:meshDeleted', {
            meshId: meshData.id
          });
        }
      }
    };
  }

  /**
   * 커스텀 메쉬 삭제 명령 생성
   */
  createDeleteCustomMeshCommand(params) {
    const { meshId } = params;
    
    return {
      id: `delete_custom_${meshId}_${Date.now()}`,
      type: 'deleteCustomMesh',
      description: `커스텀 메쉬 삭제: ${meshId}`,
      
      execute: async (context) => {
        try {
          // 삭제 전 백업
          const customMeshes = this.glbManager.getCustomMeshes();
          const meshData = customMeshes.find(mesh => mesh.id === meshId);
          
          if (!meshData) {
            throw new Error(`커스텀 메쉬를 찾을 수 없습니다: ${meshId}`);
          }
          
          // 삭제 실행
          const updatedMeshes = this.glbManager.deleteCustomMesh(meshId);
          
          this.emit('custom:meshDeleted', {
            meshId,
            deletedMesh: meshData
          });
          
          return { deletedMesh: meshData, updatedMeshes };
          
        } catch (error) {
          this.emit('custom:meshDeleteError', {
            meshId,
            error: error.message
          });
          
          throw error;
        }
      },
      
      undo: async (context) => {
        const { deletedMesh } = context.result;
        if (deletedMesh) {
          this.glbManager.saveCustomMesh(deletedMesh);
          
          this.emit('custom:meshRestored', {
            meshId: deletedMesh.id,
            meshData: deletedMesh
          });
        }
      }
    };
  }

  /**
   * 라이브러리 새로고침 명령 생성
   */
  createRefreshLibraryCommand(params) {
    return {
      id: `refresh_library_${Date.now()}`,
      type: 'refreshLibrary',
      description: '라이브러리 새로고침',
      
      execute: async (context) => {
        try {
          this.emit('library:refreshStart');
          
          const libraryMeshes = await this.glbManager.loadLibraryMeshes();
          
          this.emit('library:refreshComplete', {
            meshes: libraryMeshes,
            count: libraryMeshes.length
          });
          
          return { meshes: libraryMeshes };
          
        } catch (error) {
          this.emit('library:refreshError', {
            error: error.message
          });
          
          throw error;
        }
      }
    };
  }

  // ==================== 이벤트 핸들러들 ====================

  /**
   * 파일 드롭 처리
   */
  async handleFileDrop(event) {
    const { files, targetScene, position } = event.detail;
    
    for (const file of files) {
      if (file.name.toLowerCase().endsWith('.glb')) {
        try {
          const commandSystem = this.getService('commandSystem');
          if (commandSystem) {
            await commandSystem.executeCommand('loadFile', {
              file,
              targetScene,
              position
            });
          }
        } catch (error) {
          console.error('파일 드롭 처리 실패:', error);
        }
      }
    }
  }

  /**
   * 라이브러리 요청 처리
   */
  async handleLibraryRequest(event) {
    try {
      const libraryMeshes = await this.glbManager.loadLibraryMeshes();
      
      this.emit('library:meshesLoaded', {
        meshes: libraryMeshes,
        requestId: event.detail.requestId
      });
    } catch (error) {
      this.emit('library:meshesLoadError', {
        error: error.message,
        requestId: event.detail.requestId
      });
    }
  }

  /**
   * 썸네일 생성 요청 처리
   */
  async handleThumbnailRequest(event) {
    const { object, size, requestId } = event.detail;
    
    try {
      const thumbnail = this.glbManager.generateThumbnailFromObject(object, size);
      
      this.emit('file:thumbnailGenerated', {
        thumbnail,
        requestId
      });
    } catch (error) {
      this.emit('file:thumbnailError', {
        error: error.message,
        requestId
      });
    }
  }

  /**
   * 상태 요청 처리
   */
  handleStatusRequest(event) {
    const { requestId } = event.detail;
    
    const status = {
      loadOperations: Array.from(this.loadOperations.entries()),
      saveOperations: Array.from(this.saveOperations.entries()),
      customMeshesCount: this.glbManager.getCustomMeshes().length
    };
    
    this.emit('file:statusResponse', {
      status,
      requestId
    });
  }

  // ==================== 공개 API ====================

  /**
   * GLBMeshManager 인스턴스 반환
   */
  getGLBManager() {
    return this.glbManager;
  }

  /**
   * 진행 중인 작업 상태 반환
   */
  getOperationStatus() {
    return {
      loading: Array.from(this.loadOperations.entries()),
      saving: Array.from(this.saveOperations.entries())
    };
  }

  async destroy() {
    // GLBMeshManager 정리
    if (this.glbManager) {
      this.glbManager.dispose();
      this.glbManager = null;
    }
    
    // 진행 중인 작업 정리
    this.loadOperations.clear();
    this.saveOperations.clear();
    
    await super.destroy();
    console.log('🔌 FileIOPlugin destroyed');
  }
}

export default FileIOPlugin;
