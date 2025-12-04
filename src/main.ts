import './style.css';
import { HandTracker, Point2D, HAND_LANDMARKS } from './hand-tracker';

// Configuration
const CONFIG = {
  // Smoothing factor for finger position (0-1, higher = more smoothing)
  smoothingFactor: 0.5,
  // Whether to show debug overlay
  showDebug: true,
  // Canvas size
  canvasWidth: 960,
  canvasHeight: 720,
};

// State
let handTracker: HandTracker;
let video: HTMLVideoElement;
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let debugCanvas: HTMLCanvasElement;
let debugCtx: CanvasRenderingContext2D;

// Smoothed finger position (normalized 0-1)
let smoothedFingerPos: Point2D | null = null;

// Initialize application
async function init(): Promise<void> {
  setupDOM();
  await setupCamera();
  await setupHandTracker();
  startRenderLoop();
}

function setupDOM(): void {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = `
    <div class="container">
      <h1>Finger Camera</h1>
      <p class="description">右手の人差し指の先端が画面中央に固定されます</p>
      <div class="canvas-container">
        <canvas id="output-canvas"></canvas>
        <canvas id="debug-canvas"></canvas>
      </div>
      <div class="controls">
        <label>
          <input type="checkbox" id="debug-toggle" checked>
          デバッグ表示
        </label>
        <label>
          スムージング: <span id="smoothing-value">0.50</span>
          <input type="range" id="smoothing-slider" min="0.05" max="1.0" step="0.01" value="0.5">
        </label>
      </div>
      <div id="status">初期化中...</div>
    </div>
    <video id="video" autoplay playsinline style="display: none;"></video>
  `;

  canvas = document.getElementById('output-canvas') as HTMLCanvasElement;
  ctx = canvas.getContext('2d')!;
  canvas.width = CONFIG.canvasWidth;
  canvas.height = CONFIG.canvasHeight;

  debugCanvas = document.getElementById('debug-canvas') as HTMLCanvasElement;
  debugCtx = debugCanvas.getContext('2d')!;
  debugCanvas.width = CONFIG.canvasWidth;
  debugCanvas.height = CONFIG.canvasHeight;

  video = document.getElementById('video') as HTMLVideoElement;

  // Setup controls
  const debugToggle = document.getElementById('debug-toggle') as HTMLInputElement;
  debugToggle.addEventListener('change', (e) => {
    CONFIG.showDebug = (e.target as HTMLInputElement).checked;
    debugCanvas.style.display = CONFIG.showDebug ? 'block' : 'none';
  });

  const smoothingSlider = document.getElementById('smoothing-slider') as HTMLInputElement;
  const smoothingValue = document.getElementById('smoothing-value') as HTMLSpanElement;
  smoothingSlider.addEventListener('input', (e) => {
    CONFIG.smoothingFactor = parseFloat((e.target as HTMLInputElement).value);
    smoothingValue.textContent = CONFIG.smoothingFactor.toFixed(2);
  });
}

async function setupCamera(): Promise<void> {
  updateStatus('カメラを起動中...');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      },
      audio: false,
    });

    video.srcObject = stream;

    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        resolve();
      };
    });

    updateStatus('カメラ起動完了');
  } catch (error) {
    updateStatus('カメラの起動に失敗しました: ' + (error as Error).message);
    throw error;
  }
}

async function setupHandTracker(): Promise<void> {
  updateStatus('手検出モデルを読み込み中...');

  handTracker = new HandTracker();
  await handTracker.initialize();

  updateStatus('準備完了！');
}

function startRenderLoop(): void {
  let frameCount = 0;

  function render(): void {
    const timestamp = performance.now();
    frameCount++;

    // Detect hands
    const result = handTracker.detect(video, timestamp);

    // Update smoothed finger position (only on new frames with detection)
    if (result.isNewFrame && result.rightIndexFingerTip) {
      if (smoothedFingerPos === null) {
        smoothedFingerPos = { ...result.rightIndexFingerTip };
      } else {
        // Apply exponential smoothing (low-pass filter)
        smoothedFingerPos.x += (result.rightIndexFingerTip.x - smoothedFingerPos.x) * CONFIG.smoothingFactor;
        smoothedFingerPos.y += (result.rightIndexFingerTip.y - smoothedFingerPos.y) * CONFIG.smoothingFactor;
      }

      // Debug log every 30 frames
      if (frameCount % 30 === 0) {
        console.log(`[Frame ${frameCount}] rightIndexFingerTip: (${result.rightIndexFingerTip.x.toFixed(3)}, ${result.rightIndexFingerTip.y.toFixed(3)})`);
        console.log(`[Frame ${frameCount}] smoothedFingerPos: (${smoothedFingerPos.x.toFixed(3)}, ${smoothedFingerPos.y.toFixed(3)})`);
      }
    }

    // Render main canvas
    renderMainCanvas();

    // Render debug canvas (only on new frames to prevent flickering)
    if (CONFIG.showDebug && result.isNewFrame) {
      renderDebugCanvas(result.allHands, result.rightIndexFingerTip);
    }

    // Update status (only on new frames)
    if (result.isNewFrame) {
      if (result.rightIndexFingerTip) {
        updateStatus(`追跡中 - 指位置: (${(result.rightIndexFingerTip.x * 100).toFixed(1)}%, ${(result.rightIndexFingerTip.y * 100).toFixed(1)}%)`);
      } else if (result.leftIndexFingerTip) {
        updateStatus(`左手検出中 - 右手を使ってください`);
      } else {
        updateStatus('右手の人差し指を画面に向けてください');
      }
    }

    requestAnimationFrame(render);
  }

  render();
}

function renderMainCanvas(): void {
  ctx.save();

  // Clear canvas
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (smoothedFingerPos) {
    // Calculate offset to center the finger position
    // Finger position is normalized (0-1), convert to canvas coordinates
    const fingerY = smoothedFingerPos.y * canvas.height;

    // Calculate how much we need to shift the video
    // to place the finger at the center of the canvas
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // After mirroring (translate + scale -1), a point at normalized x appears at:
    // canvas_x = canvas.width * (1 - x) - offsetX
    // We want canvas_x = centerX when x = smoothedFingerPos.x
    // So: centerX = canvas.width * (1 - smoothedFingerPos.x) - offsetX
    // offsetX = canvas.width * (1 - smoothedFingerPos.x) - centerX
    const mirroredFingerX = (1 - smoothedFingerPos.x) * canvas.width;
    const offsetX = mirroredFingerX - centerX;
    const offsetY = centerY - fingerY;

    // Debug logging (throttled)
    if (Math.random() < 0.03) {
      console.log(`[renderMainCanvas] fingerPos: (${smoothedFingerPos.x.toFixed(3)}, ${smoothedFingerPos.y.toFixed(3)})`);
      console.log(`[renderMainCanvas] mirroredFingerX: ${mirroredFingerX.toFixed(1)}, centerX: ${centerX.toFixed(1)}`);
      console.log(`[renderMainCanvas] offset: (${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`);
    }

    // Draw video with offset (mirrored horizontally for natural interaction)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    // Apply the offset - shift the video so the finger ends up at center
    ctx.translate(offsetX, offsetY);

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  } else {
    // No finger detected - just show mirrored video
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }

  ctx.restore();

  // Draw center crosshair (always at screen center)
  drawCrosshair(ctx, canvas.width / 2, canvas.height / 2, '#00ff00', 30);
}

function renderDebugCanvas(
  allHands: ReturnType<typeof handTracker.detect>['allHands'],
  rightIndexFinger: Point2D | null
): void {
  debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);

  if (!allHands || !allHands.landmarks) return;

  // Draw all hand landmarks
  for (let i = 0; i < allHands.landmarks.length; i++) {
    const landmarks = allHands.landmarks[i];
    const handedness = allHands.handednesses[i];
    // MediaPipe "Right" = user's anatomical right hand
    const isRightHand = handedness[0]?.categoryName === 'Right';

    // Draw connections
    const connections = getHandConnections();
    debugCtx.strokeStyle = isRightHand ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 165, 0, 0.5)';
    debugCtx.lineWidth = 2;

    for (const [start, end] of connections) {
      const startPoint = landmarks[start];
      const endPoint = landmarks[end];

      // Mirror X coordinate for display
      const startX = (1 - startPoint.x) * debugCanvas.width;
      const startY = startPoint.y * debugCanvas.height;
      const endX = (1 - endPoint.x) * debugCanvas.width;
      const endY = endPoint.y * debugCanvas.height;

      debugCtx.beginPath();
      debugCtx.moveTo(startX, startY);
      debugCtx.lineTo(endX, endY);
      debugCtx.stroke();
    }

    // Draw landmarks
    for (let j = 0; j < landmarks.length; j++) {
      const landmark = landmarks[j];
      const x = (1 - landmark.x) * debugCanvas.width;
      const y = landmark.y * debugCanvas.height;

      // Highlight index finger tip
      const isIndexFingerTip = j === HAND_LANDMARKS.INDEX_FINGER_TIP;

      debugCtx.beginPath();
      debugCtx.arc(x, y, isIndexFingerTip ? 8 : 4, 0, Math.PI * 2);
      debugCtx.fillStyle = isIndexFingerTip
        ? (isRightHand ? '#00ff00' : '#ff8800')
        : (isRightHand ? 'rgba(0, 255, 0, 0.7)' : 'rgba(255, 165, 0, 0.7)');
      debugCtx.fill();
    }

    // Draw hand label
    const wrist = landmarks[HAND_LANDMARKS.WRIST];
    const labelX = (1 - wrist.x) * debugCanvas.width;
    const labelY = wrist.y * debugCanvas.height + 30;

    debugCtx.font = '14px sans-serif';
    debugCtx.fillStyle = isRightHand ? '#00ff00' : '#ff8800';
    debugCtx.fillText(isRightHand ? '右手' : '左手', labelX - 15, labelY);
  }

  // Draw current tracking target indicator
  if (rightIndexFinger) {
    const x = (1 - rightIndexFinger.x) * debugCanvas.width;
    const y = rightIndexFinger.y * debugCanvas.height;

    debugCtx.strokeStyle = '#00ffff';
    debugCtx.lineWidth = 2;
    debugCtx.setLineDash([5, 5]);
    debugCtx.beginPath();
    debugCtx.arc(x, y, 15, 0, Math.PI * 2);
    debugCtx.stroke();
    debugCtx.setLineDash([]);

    // Label
    debugCtx.font = '12px sans-serif';
    debugCtx.fillStyle = '#00ffff';
    debugCtx.fillText('追跡中', x - 20, y - 20);
  }
}

function drawCrosshair(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  size: number
): void {
  context.strokeStyle = color;
  context.lineWidth = 2;

  // Horizontal line
  context.beginPath();
  context.moveTo(x - size, y);
  context.lineTo(x + size, y);
  context.stroke();

  // Vertical line
  context.beginPath();
  context.moveTo(x, y - size);
  context.lineTo(x, y + size);
  context.stroke();

  // Center circle
  context.beginPath();
  context.arc(x, y, 5, 0, Math.PI * 2);
  context.stroke();
}

function getHandConnections(): [number, number][] {
  return [
    // Thumb
    [0, 1], [1, 2], [2, 3], [3, 4],
    // Index finger
    [0, 5], [5, 6], [6, 7], [7, 8],
    // Middle finger
    [0, 9], [9, 10], [10, 11], [11, 12],
    // Ring finger
    [0, 13], [13, 14], [14, 15], [15, 16],
    // Pinky
    [0, 17], [17, 18], [18, 19], [19, 20],
    // Palm
    [5, 9], [9, 13], [13, 17],
  ];
}

function updateStatus(message: string): void {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = message;
  }
}

// Start the application
init().catch(console.error);
