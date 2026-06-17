/**
 * Body-language analyzer — interview-evaluator vocabulary.
 *
 * Four signals an interviewer actually cares about:
 *   - Engagement: eye gaze toward the camera (looking at the interviewer)
 *   - Warmth:     genuine smile + relaxed brows (approachable demeanor)
 *   - Composure:  upright posture + shoulders level + nose centered
 *   - Energy:     subtle natural head movement (animated, not frozen)
 *
 * Runs entirely in the browser via MediaPipe Tasks Vision (~50ms/frame).
 */
import {
  FilesetResolver,
  FaceLandmarker,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

export async function createBodyLanguageAnalyzer() {
  let faceLandmarker = null;
  let poseLandmarker = null;
  let timer = null;
  let videoEl = null;
  let prevNose = null;

  const samples = {
    engagement: [],  // 0..1
    warmth: [],
    composure: [],
    energy: [],
  };

  try {
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" },
      runningMode: "VIDEO",
      outputFaceBlendshapes: true,
      numFaces: 1,
    });
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: POSE_MODEL, delegate: "GPU" },
      runningMode: "VIDEO",
      numPoses: 1,
    });
  } catch (e) {
    console.warn("MediaPipe init failed; body-language disabled:", e);
  }

  function clamp01(x) { return Math.max(0, Math.min(1, x)); }

  function sampleOnce() {
    if (!videoEl || videoEl.readyState < 2) return;
    const ts = performance.now();

    let smile = 0;
    let browFurrow = 0;
    let gazeOff = 0;

    try {
      if (faceLandmarker) {
        const fr = faceLandmarker.detectForVideo(videoEl, ts);
        const bs = fr?.faceBlendshapes?.[0]?.categories || [];
        const find = (n) => bs.find((c) => c.categoryName === n)?.score || 0;

        // Gaze off-axis (lower is better engagement)
        gazeOff =
          find("eyeLookOutLeft") + find("eyeLookInLeft") +
          find("eyeLookOutRight") + find("eyeLookInRight") +
          find("eyeLookDownLeft") + find("eyeLookDownRight") +
          find("eyeLookUpLeft") + find("eyeLookUpRight");

        smile = (find("mouthSmileLeft") + find("mouthSmileRight")) / 2;
        browFurrow = (find("browDownLeft") + find("browDownRight")) / 2;

        // Engagement: low gaze-off → high engagement
        const engagement = clamp01(1 - gazeOff / 1.6);
        samples.engagement.push(engagement);

        // Warmth: smile, penalized by furrowed brow
        const warmth = clamp01(smile * 1.4 - browFurrow * 0.8);
        samples.warmth.push(warmth);
      }
    } catch {}

    try {
      if (poseLandmarker) {
        const pr = poseLandmarker.detectForVideo(videoEl, ts);
        const lm = pr?.landmarks?.[0] || [];
        const lShoulder = lm[11], rShoulder = lm[12], nose = lm[0];
        if (lShoulder && rShoulder && nose) {
          // Composure: shoulders level + nose roughly above shoulder midpoint
          const dy = Math.abs(lShoulder.y - rShoulder.y);
          const midX = (lShoulder.x + rShoulder.x) / 2;
          const dx = Math.abs(nose.x - midX);
          const composure = clamp01(1 - (dy / 0.06) * 0.5 - (dx / 0.10) * 0.5);
          samples.composure.push(composure);

          // Energy: gentle head movement is good; frozen = low, jittery = low
          if (prevNose) {
            const d = Math.hypot(nose.x - prevNose.x, nose.y - prevNose.y);
            // sweet spot around 0.003..0.020 normalized units
            let energy;
            if (d < 0.001) energy = 0.2;             // frozen
            else if (d < 0.025) energy = clamp01(d / 0.012); // natural
            else energy = clamp01(1 - (d - 0.025) / 0.05);    // too jittery
            samples.energy.push(energy);
          }
          prevNose = { x: nose.x, y: nose.y };
        }
      }
    } catch {}
  }

  return {
    start(el) {
      videoEl = el;
      if (timer) return;
      timer = setInterval(sampleOnce, 500); // 2 fps
    },
    stop() {
      if (timer) { clearInterval(timer); timer = null; }
      const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
      return {
        engagement: Math.round(mean(samples.engagement) * 100),
        warmth:     Math.round(mean(samples.warmth)     * 100),
        composure:  Math.round(mean(samples.composure)  * 100),
        energy:     Math.round(mean(samples.energy)     * 100),
        samples: {
          engagement: samples.engagement.length,
          warmth:     samples.warmth.length,
          composure:  samples.composure.length,
          energy:     samples.energy.length,
        },
      };
    },
  };
}
