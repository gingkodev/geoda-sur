// Web Audio AnalyserNode bridge for the <audio> element.
// createMediaElementSource can only be called once per element,
// so we lazily init on first user gesture and reuse the same nodes.

let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;

const FFT_SIZE = 512;

export function getAnalyser(audioEl: HTMLAudioElement): AnalyserNode {
  if (analyser) return analyser;

  audioCtx = new AudioContext();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0.8;

  sourceNode = audioCtx.createMediaElementSource(audioEl);
  sourceNode.connect(analyser);
  analyser.connect(audioCtx.destination);

  return analyser;
}

export function ensureAudioContext(): void {
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}
