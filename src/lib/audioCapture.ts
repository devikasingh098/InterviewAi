import { float32ToPcm16 } from "assemblyai/streaming";

export type MicCaptureOptions = {
  /** Pre-acquired stream (see `acquireMicStream`); acquired here when omitted. */
  stream?: MediaStream;
  /** Called with a chunk of Int16LE PCM16 audio at 16 kHz, ready to send upstream. */
  onPcm: (pcm: ArrayBuffer) => void;
  /** Called with the RMS level of the current chunk (0..~1), for the level meter. */
  onLevel: (rms: number) => void;
};

export type MicCaptureHandle = {
  stop: () => Promise<void>;
};

const TARGET_RATE = 16000;
const CHUNK_FRAMES = 4096;

type Resampler = { push: (chunk: Float32Array) => Float32Array };

/**
 * Stateful linear-interpolation resampler. Only used when the browser ignores
 * the `AudioContext({ sampleRate })` hint and delivers Float32 at a different
 * rate — without it, 48 kHz audio would be mislabeled as 16 kHz and garbled.
 */
function createResampler(fromRate: number, toRate: number): Resampler {
  const ratio = fromRate / toRate;
  let pos = 0;
  let prevSample = 0;
  return {
    push(input) {
      const out = new Float32Array(Math.max(0, Math.floor((input.length - pos) / ratio)));
      let outIndex = 0;
      let inputPosition = pos;
      while (outIndex < out.length) {
        const i0 = Math.floor(inputPosition);
        const frac = inputPosition - i0;
        const s0 = i0 >= 1 ? input[i0 - 1] : prevSample;
        const s1 = i0 < input.length ? input[i0] : s0;
        out[outIndex] = s0 + (s1 - s0) * frac;
        outIndex += 1;
        inputPosition += ratio;
      }
      prevSample = input[input.length - 1] ?? 0;
      pos = inputPosition - input.length;
      return out;
    },
  };
}

/**
 * Opens the microphone and streams PCM16 audio at 16 kHz to `onPcm`.
 * Audio is routed into a zero-gain node so the user doesn't hear themselves.
 */
/**
 * Acquires the microphone for a practice session. Kept separate from
 * `startMicCapture` so permission problems surface immediately — with precise
 * copy — before any network handshake is started.
 */
export async function acquireMicStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
}

export async function startMicCapture(options: MicCaptureOptions): Promise<MicCaptureHandle> {
  const stream = options.stream ?? (await acquireMicStream());

  const AudioContextCtor: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  const audioContext = new AudioContextCtor({ sampleRate: TARGET_RATE });
  await audioContext.resume();

  const resample =
    audioContext.sampleRate !== TARGET_RATE
      ? createResampler(audioContext.sampleRate, TARGET_RATE)
      : null;

  const source = audioContext.createMediaStreamSource(stream);
  // ScriptProcessor is deprecated but universally supported. At 16 kHz these
  // frames are ~256 ms each, so it fires a few times per second — cheap enough.
  const processor = audioContext.createScriptProcessor(CHUNK_FRAMES, 1, 1);
  const silentGain = audioContext.createGain();
  silentGain.gain.value = 0;

  processor.onaudioprocess = (event) => {
    const channel = event.inputBuffer.getChannelData(0);

    let sum = 0;
    for (let i = 0; i < channel.length; i++) {
      sum += channel[i] * channel[i];
    }
    options.onLevel(Math.sqrt(sum / channel.length));

    const atTargetRate = resample ? resample.push(channel) : channel;
    options.onPcm(float32ToPcm16(atTargetRate));
  };

  source.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(audioContext.destination);

  return {
    stop: async () => {
      try {
        processor.disconnect();
      } catch {
        // noop
      }
      try {
        source.disconnect();
      } catch {
        // noop
      }
      try {
        silentGain.disconnect();
      } catch {
        // noop
      }
      for (const track of stream.getTracks()) {
        track.stop();
      }
      try {
        await audioContext.close();
      } catch {
        // noop
      }
    },
  };
}