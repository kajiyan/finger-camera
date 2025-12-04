import {
  HandLandmarker,
  FilesetResolver,
  HandLandmarkerResult,
} from '@mediapipe/tasks-vision';

// Hand landmark indices
export const HAND_LANDMARKS = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_FINGER_MCP: 5,
  INDEX_FINGER_PIP: 6,
  INDEX_FINGER_DIP: 7,
  INDEX_FINGER_TIP: 8,
  MIDDLE_FINGER_MCP: 9,
  MIDDLE_FINGER_PIP: 10,
  MIDDLE_FINGER_DIP: 11,
  MIDDLE_FINGER_TIP: 12,
  RING_FINGER_MCP: 13,
  RING_FINGER_PIP: 14,
  RING_FINGER_DIP: 15,
  RING_FINGER_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

export interface Point2D {
  x: number;
  y: number;
}

export interface HandTrackingResult {
  rightIndexFingerTip: Point2D | null;
  leftIndexFingerTip: Point2D | null;
  allHands: HandLandmarkerResult | null;
  isNewFrame: boolean;
}

export class HandTracker {
  private handLandmarker: HandLandmarker | null = null;
  private lastVideoTime = -1;
  private lastResult: HandTrackingResult = {
    rightIndexFingerTip: null,
    leftIndexFingerTip: null,
    allHands: null,
    isNewFrame: false,
  };

  async initialize(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  }

  detect(video: HTMLVideoElement, timestamp: number): HandTrackingResult {
    // Return cached result if video frame hasn't changed (prevents flickering)
    if (!this.handLandmarker || video.currentTime === this.lastVideoTime) {
      return { ...this.lastResult, isNewFrame: false };
    }

    this.lastVideoTime = video.currentTime;

    const result: HandTrackingResult = {
      rightIndexFingerTip: null,
      leftIndexFingerTip: null,
      allHands: null,
      isNewFrame: true,
    };

    const detectionResult = this.handLandmarker.detectForVideo(video, timestamp);
    result.allHands = detectionResult;

    if (!detectionResult.landmarks || detectionResult.landmarks.length === 0) {
      this.lastResult = result;
      return result;
    }

    // Process each detected hand
    for (let i = 0; i < detectionResult.landmarks.length; i++) {
      const landmarks = detectionResult.landmarks[i];
      const handedness = detectionResult.handednesses[i];

      if (!landmarks || !handedness || handedness.length === 0) continue;

      // Get index finger tip position (normalized 0-1)
      const indexFingerTip = landmarks[HAND_LANDMARKS.INDEX_FINGER_TIP];
      const point: Point2D = {
        x: indexFingerTip.x,
        y: indexFingerTip.y,
      };

      // MediaPipe labels hands by anatomical handedness (your actual left/right hand)
      // "Right" = user's anatomical right hand (appears on left side of mirrored screen)
      // "Left" = user's anatomical left hand (appears on right side of mirrored screen)
      const handLabel = handedness[0].categoryName;

      // Debug logging
      console.log(`Hand detected: MediaPipe label="${handLabel}" (user's ${handLabel.toLowerCase()} hand), fingerPos=(${point.x.toFixed(3)}, ${point.y.toFixed(3)})`);

      if (handLabel === 'Right') {
        // User's anatomical RIGHT hand
        result.rightIndexFingerTip = point;
      } else if (handLabel === 'Left') {
        // User's anatomical LEFT hand
        result.leftIndexFingerTip = point;
      }
    }

    this.lastResult = result;
    return result;
  }

  destroy(): void {
    if (this.handLandmarker) {
      this.handLandmarker.close();
      this.handLandmarker = null;
    }
  }
}
