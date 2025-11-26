/* gestures.js */

// 1. ジェスチャー検知用コンポーネント (シーンに追加)
AFRAME.registerComponent('gesture-detector', {
  schema: {
    element: { default: '' }
  },

  init: function() {
    this.targetElement = this.data.element && document.querySelector(this.data.element);
    if (!this.targetElement) {
      this.targetElement = this.el;
    }

    this.internalState = {
      previousState: null
    };

    this.emitGestureEvent = this.emitGestureEvent.bind(this);

    this.targetElement.addEventListener('touchstart', this.emitGestureEvent);
    this.targetElement.addEventListener('touchend', this.emitGestureEvent);
    this.targetElement.addEventListener('touchmove', this.emitGestureEvent);
  },

  remove: function() {
    this.targetElement.removeEventListener('touchstart', this.emitGestureEvent);
    this.targetElement.removeEventListener('touchend', this.emitGestureEvent);
    this.targetElement.removeEventListener('touchmove', this.emitGestureEvent);
  },

  emitGestureEvent: function(event) {
    const currentState = this.getTouchState(event);
    const previousState = this.internalState.previousState;
    const gestureEvent = {
      detail: {
        event: event,
        currentState: currentState,
        previousState: previousState
      }
    };

    if (currentState.touchCount === 1) {
      this.el.emit('onefingermove', gestureEvent.detail);
    } else if (currentState.touchCount === 2) {
      // ピンチ操作の計算（距離の変化）
      const spreadChange = currentState.spread - previousState.spread;
      gestureEvent.detail.spreadChange = spreadChange;
      this.el.emit('twofingermove', gestureEvent.detail);
    }

    this.internalState.previousState = currentState;
  },

  getTouchState: function(event) {
    if (event.touches.length === 0) {
      return null;
    }
    // 2本指の距離（Spread）を計算
    let spread = 0;
    if (event.touches.length === 2) {
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      spread = Math.sqrt(
        Math.pow(touch1.clientX - touch2.clientX, 2) +
        Math.pow(touch1.clientY - touch2.clientY, 2)
      );
    }
    return {
      touchCount: event.touches.length,
      screenPosition: {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
      },
      spread: spread
    };
  }
});

// 2. 個別オブジェクト操作用コンポーネント (各モデルに追加)
AFRAME.registerComponent('gesture-handler', {
  schema: {
    enabled: { default: true },
    rotationFactor: { default: 5 },
    minScale: { default: 0.1 },
    maxScale: { default: 8 }
  },

  init: function() {
    this.handleScale = this.handleScale.bind(this);
    this.handleDrag = this.handleDrag.bind(this);
    this.isVisible = false;
    this.initialScale = this.el.object3D.scale.clone();
    this.scaleFactor = 1;

    // シーンからのイベントをリッスン
    this.el.sceneEl.addEventListener('twofingermove', this.handleScale);
    this.el.sceneEl.addEventListener('onefingermove', this.handleDrag);
    
    // オブジェクトがタップされているか判定するための状態管理
    this.isSelected = false;
    this.el.addEventListener('mousedown', () => { this.isSelected = true; });
    this.el.sceneEl.addEventListener('mouseup', () => { this.isSelected = false; });
    // タッチデバイス用
    this.el.addEventListener('touchstart', () => { this.isSelected = true; });
    this.el.sceneEl.addEventListener('touchend', () => { this.isSelected = false; });
  },

  remove: function() {
    this.el.sceneEl.removeEventListener('twofingermove', this.handleScale);
    this.el.sceneEl.removeEventListener('onefingermove', this.handleDrag);
  },

  handleScale: function(event) {
    if (this.isVisible || this.isSelected) { // 選択中または可視状態なら拡縮
      this.scaleFactor *= (1 + event.detail.spreadChange / event.detail.currentState.spread);
      this.scaleFactor = Math.min(Math.max(this.scaleFactor, this.data.minScale), this.data.maxScale);
      this.el.object3D.scale.x = this.scaleFactor * this.initialScale.x;
      this.el.object3D.scale.y = this.scaleFactor * this.initialScale.y;
      this.el.object3D.scale.z = this.scaleFactor * this.initialScale.z;
    }
  },

  handleDrag: function(event) {
    if (this.isSelected) {
        // 現在のスクリーン座標と前の座標の差分を取得して移動させる簡易実装
        // 本格的なARではRaycasterと平面交差を使いますが、ここでは相対移動で実装します
        const currentPosition = this.el.object3D.position;
        
        // 簡易的な移動係数
        const dx = event.detail.currentState.screenPosition.x - event.detail.previousState.screenPosition.x;
        const dy = event.detail.currentState.screenPosition.y - event.detail.previousState.screenPosition.y;

        // カメラの向きに合わせて移動させるのが理想ですが、ここではX/Z平面で移動させます
        // 係数 0.005 は感度調整用
        this.el.object3D.position.x += dx * 0.005;
        this.el.object3D.position.z += dy * 0.005; 
    }
  }
});
