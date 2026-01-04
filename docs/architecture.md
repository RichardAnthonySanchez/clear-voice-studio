# Architecture Documentation

## System Overview

Clear Voice Studio is a privacy-first, browser-based voice transcription and refinement application. It leverages WebAssembly and Web Workers to run the Whisper speech-to-text model entirely within the user's browser, ensuring that audio data never leaves the device.

## High-Level Architecture

The application follows a unidirectional data flow, orchestrated by React hooks interacting with a dedicated Web Worker for heavy ML processing.

```mermaid
graph TD
    User[User] -->|Voice Input| Mic[Microphone Stream]
    
    subgraph "Main Thread (UI Layer)"
        Mic -->|MediaStream| Visualizer[Audio Visualizer]
        Mic -->|MediaRecorder| Recorder[Recorder Service]
        Recorder -->|Audio Blob| Hook[useTranscribe Hook]
        
        Hook -->|Audio Data| Normalizer[Audio Normalizer]
        Normalizer -->|Float32Array| WorkerInterface[Worker Interface]
        
        Correction[Correction Engine] -->|Refined Text| UI[Output Display]
    end
    
    subgraph "Background Thread (Web Worker)"
        WorkerInterface -->|postMessage| WorkerScript[worker.ts]
        WorkerScript -->|Pipeline| OnnxRuntime[ONNX Runtime / Transformers.js]
        OnnxRuntime -->|Inference| WhisperModel[Whisper Tiny.en]
        WhisperModel -->|Raw Text| WorkerScript
    end
    
    WorkerScript -->|postMessage| Hook
    Hook -->|Transcription| UI
    UI -->|Trigger| Correction
```

## Component Structure

Key React components and their responsibilities:

```mermaid
classDiagram
    class Index {
        +render()
    }
    class DictationProcessor {
        -state: input, result
        +handleRecord()
        +processText()
    }
    class useTranscribe {
        +startRecording()
        +normalizeAudio()
        +postToWorker()
    }
    class AudioVisualizer {
        +drawWaveform()
    }
    class DebugPanel {
        +showLogs()
        +showAudioStats()
    }

    Index --> DictationProcessor
    DictationProcessor --> useTranscribe
    DictationProcessor --> AudioVisualizer
    DictationProcessor --> DebugPanel
    DictationProcessor --> DictationInput
    DictationProcessor --> OutputDisplay
```

## Data Flow Details

### 1. Audio Capture & Normalization
- **Capture**: `MediaRecorder` captures audio chunks from the user's microphone in `audio/webm` format.
- **Decoding**: The blob is decoded into an `AudioBuffer` using the Web Audio API at a forced sample rate of 16kHz (required by Whisper).
- **Normalization**: The `useTranscribe` hook calculates the Peak and RMS amplitude. If the audio is outside the target range, gain is applied to normalize the signal to ~0.95 Peak.

### 2. Transcription (Web Worker)
- **Offloading**: Normalized `Float32Array` audio data is sent to `worker.ts` via `postMessage`.
- **Inference**: The worker uses `@xenova/transformers` to run the quantized `Xenova/whisper-tiny.en` model.
- **Result**: The text is returned to the main thread and appended to the transcription state.

### 3. Text Refinement
- **Engine**: A rule-based `correctionEngine.ts` processes the raw transcription.
- **Operations**:
  - Fixes casing and sentence boundaries.
  - Removes filler words (um, uh).
  - Normalizes spacing and punctuation.
  - Expands common contractions (e.g., from "gonna" to "going to").

## File Structure

- `src/components/`: UI components (Inputs, Visualizers, Debug Panels).
- `src/hooks/`: Custom hooks logic (`useTranscribe`).
- `src/lib/`: Pure utility functions (`correctionEngine`).
- `src/worker.ts`: The background script for ML inference.
