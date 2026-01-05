import { useState, useRef, useCallback, useEffect } from 'react';
import Worker from '../worker?worker';

interface DebugLog {
    timestamp: number;
    message: string;
    data?: any;
    type: 'info' | 'error' | 'success';
}

interface AudioStats {
    sampleRate: number;
    channelCount: number;
    duration: number;
    peak?: number;
    gainApplied?: number;
}

interface TranscribeHook {
    isModelLoading: boolean;
    isModelLoaded: boolean;
    isRecording: boolean;
    isTranscribing: boolean;
    transcription: string;
    progress: number;
    error: string | null;
    logs: DebugLog[];
    audioStats: AudioStats | null;
    audioStream: MediaStream | null;
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    resetTranscription: () => void;
    clearLogs: () => void;
}

export function useTranscribe(): TranscribeHook {
    const [isModelLoading, setIsModelLoading] = useState(false);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcription, setTranscription] = useState('');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [logs, setLogs] = useState<DebugLog[]>([]);
    const [audioStats, setAudioStats] = useState<AudioStats | null>(null);
    const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

    const workerRef = useRef<Worker | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);

    // Buffer to hold audio samples until we have enough to send (approx 4 seconds)
    const audioBufferRef = useRef<Float32Array>(new Float32Array(0));
    const CHUNK_DURATION_SEC = 4;

    const addLog = useCallback((message: string, type: DebugLog['type'] = 'info', data?: any) => {
        const timestamp = Date.now();
        console.log(`[${type.toUpperCase()}] ${message}`, data || '');
        setLogs(prev => [...prev, { timestamp, message, type, data }].slice(-50));
    }, []);

    // Initialize Worker
    useEffect(() => {
        if (!workerRef.current) {
            addLog('Initializing worker thread...', 'info');
            workerRef.current = new Worker();

            workerRef.current.onmessage = (event) => {
                const { type, data } = event.data;

                switch (type) {
                    case 'download':
                        if (data.status === 'progress' && data.progress) {
                            setProgress(Math.round(data.progress));
                        }
                        break;
                    case 'ready':
                        addLog('Whisper model loaded and ready', 'success');
                        setIsModelLoading(false);
                        setIsModelLoaded(true);
                        setProgress(100);
                        break;
                    case 'complete':
                        addLog('Transcription completed', 'success', data);
                        setIsTranscribing(false);
                        if (data && typeof data === 'object' && data.text) {
                            setTranscription(data.text.trim());
                        } else if (Array.isArray(data)) {
                            const text = data.map((chunk: any) => chunk.text).join(' ');
                            setTranscription(text.trim());
                        }
                        break;
                    case 'error':
                        addLog('Worker reported error', 'error', data);
                        setIsModelLoading(false);
                        setIsTranscribing(false);
                        setError(typeof data === 'string' ? data : 'Worker error occurred');
                        break;
                }
            };

            setIsModelLoading(true);
            workerRef.current.postMessage({ type: 'configure' });
        }

        return () => {
            workerRef.current?.terminate();
            workerRef.current = null;
        };
    }, [addLog]);

    const normalizeAndSendAudio = useCallback(async (audioData: Float32Array) => {
        if (!workerRef.current || !isModelLoaded) {
            addLog('Cannot process: Worker not ready', 'error');
            return;
        }

        // Resample/Decimate to 16kHz if necessary
        // Since AudioContext typically runs at 44.1/48kHz, we need to convert.
        // We can do a quick offline render to do high quality resampling.

        try {
            const targetSampleRate = 16000;
            const estimatedDuration = audioData.length / (audioContextRef.current?.sampleRate || 48000);

            // Create offline context to resample
            const offlineCtx = new OfflineAudioContext(1, Math.ceil(estimatedDuration * targetSampleRate), targetSampleRate);
            const buffer = offlineCtx.createBuffer(1, audioData.length, audioContextRef.current?.sampleRate || 48000);
            buffer.copyToChannel(audioData, 0);

            const source = offlineCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(offlineCtx.destination);
            source.start();

            const resampledBuffer = await offlineCtx.startRendering();
            const resampledData = resampledBuffer.getChannelData(0);

            // Normalization
            let peak = 0;
            for (let i = 0; i < resampledData.length; i++) {
                const abs = Math.abs(resampledData[i]);
                if (abs > peak) peak = abs;
            }

            let gain = 1.0;
            if (peak > 0) {
                gain = 0.95 / peak;
            }

            const normalized = new Float32Array(resampledData.length);
            for (let i = 0; i < resampledData.length; i++) {
                normalized[i] = resampledData[i] * gain;
            }

            setIsTranscribing(true);
            addLog(`Sending chunk to worker: ${normalized.length} samples (${(normalized.length / 16000).toFixed(2)}s)`);

            workerRef.current.postMessage({
                type: 'transcribe',
                audio: normalized,
                language: 'english'
            });

        } catch (err) {
            console.error('Resampling/Sending error:', err);
            addLog('Error preparing audio chunk', 'error', err);
        }

    }, [isModelLoaded, addLog]);

    const startRecording = useCallback(async () => {
        setTranscription('');
        setError(null);
        audioBufferRef.current = new Float32Array(0); // Clear buffer

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            setAudioStream(stream);

            // Setup AudioContext
            // We use standard context, usually 44.1k or 48k
            const context = new AudioContext();
            audioContextRef.current = context;

            const source = context.createMediaStreamSource(stream);
            sourceRef.current = source;

            // ScriptNode for processing
            // bufferSize 4096 => ~85ms latency at 48k
            const scriptNode = context.createScriptProcessor(4096, 1, 1);
            scriptNodeRef.current = scriptNode;

            scriptNode.onaudioprocess = (audioProcessingEvent) => {
                const inputBuffer = audioProcessingEvent.inputBuffer;
                const inputData = inputBuffer.getChannelData(0);

                // Append to buffer
                const newBuffer = new Float32Array(audioBufferRef.current.length + inputData.length);
                newBuffer.set(audioBufferRef.current);
                newBuffer.set(inputData, audioBufferRef.current.length);
                audioBufferRef.current = newBuffer;

                // Check if buffer is large enough for a chunk
                // sampleRate * CHUNK_DURATION
                const threshold = context.sampleRate * CHUNK_DURATION_SEC;
                if (audioBufferRef.current.length >= threshold) {
                    const chunkToSend = audioBufferRef.current;
                    audioBufferRef.current = new Float32Array(0); // Reset buffer
                    normalizeAndSendAudio(chunkToSend);
                }
            };

            source.connect(scriptNode);
            scriptNode.connect(context.destination); // Needed for Chrome to fire events

            addLog('Microphone access granted & streaming started', 'success');
            setIsRecording(true);

        } catch (err) {
            console.error('Error accessing microphone:', err);
            setError('Could not access microphone');
            addLog('Microphone access failed', 'error', err);
        }
    }, [normalizeAndSendAudio, addLog]);

    const stopRecording = useCallback(() => {
        if (mediaStreamRef.current) {
            // Process remaining buffer
            if (audioBufferRef.current.length > 0) {
                addLog('Flushing remaining audio buffer...', 'info');
                normalizeAndSendAudio(audioBufferRef.current);
                audioBufferRef.current = new Float32Array(0);
            }

            // Stop tracks
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
            setAudioStream(null);

            // Cleanup audio nodes
            scriptNodeRef.current?.disconnect();
            sourceRef.current?.disconnect();
            audioContextRef.current?.close();

            scriptNodeRef.current = null;
            sourceRef.current = null;
            audioContextRef.current = null;

            setIsRecording(false);
            addLog('Recording stopped', 'info');
        }
    }, [normalizeAndSendAudio, addLog]);

    const resetTranscription = useCallback(() => {
        setTranscription('');
        setError(null);
        setLogs([]);
        setAudioStats(null);
    }, []);

    return {
        isModelLoading,
        isModelLoaded,
        isRecording,
        isTranscribing,
        transcription,
        progress,
        error,
        logs,
        audioStats,
        audioStream,
        startRecording,
        stopRecording,
        resetTranscription,
        clearLogs: () => setLogs([])
    };
}
