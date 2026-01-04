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
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

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
                            setTranscription(prev => {
                                const space = prev ? ' ' : '';
                                return prev + space + data.text.trim();
                            });
                        } else if (Array.isArray(data)) {
                            const text = data.map((chunk: any) => chunk.text).join(' ');
                            setTranscription(prev => {
                                const space = prev ? ' ' : '';
                                return prev + space + text.trim();
                            });
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
            // Cleanup worker on unmount
            workerRef.current?.terminate();
            workerRef.current = null;
        };
    }, [addLog]);

    const normalizeAudio = (audioData: Float32Array): { normalizedData: Float32Array; peak: number; gain: number } => {
        let peak = 0;
        let sumSquared = 0;

        for (let i = 0; i < audioData.length; i++) {
            const abs = Math.abs(audioData[i]);
            if (abs > peak) peak = abs;
            sumSquared += audioData[i] * audioData[i];
        }

        const rms = Math.sqrt(sumSquared / audioData.length);

        const targetLevel = 0.95;
        let gain = 1.0;

        // Verify we have valid data
        if (!Number.isFinite(peak) || peak === 0) {
            addLog('Audio peak is zero or invalid.', 'error');
            return { normalizedData: audioData, peak, gain };
        }

        gain = targetLevel / peak;
        addLog(`Normalizing: Peak=${peak.toFixed(4)}, RMS=${rms.toFixed(4)} -> Gain=${gain.toFixed(2)}x`);

        // Apply gain
        const normalized = new Float32Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
            normalized[i] = audioData[i] * gain;
        }
        return { normalizedData: normalized, peak, gain };
    };

    const processAudio = useCallback(async (blob: Blob) => {
        if (!workerRef.current || !isModelLoaded) {
            addLog('Cannot process: Worker not ready', 'error');
            return;
        }

        addLog(`Processing blob: ${blob.size} bytes, ${blob.type}`);
        setIsTranscribing(true);

        try {
            // Force 16kHz sample rate for Whisper
            const audioContext = new AudioContext({ sampleRate: 16000 });
            const arrayBuffer = await blob.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            addLog(`Decoded: ${audioBuffer.duration.toFixed(2)}s @ ${audioBuffer.sampleRate}Hz, ${audioBuffer.numberOfChannels}ch`);

            if (audioBuffer.sampleRate !== 16000) {
                addLog(`Warning: Sample rate is ${audioBuffer.sampleRate}Hz, expected 16000Hz. This might fail.`, 'error');
            }

            const rawData = audioBuffer.getChannelData(0);

            // Update stats
            setAudioStats({
                sampleRate: audioBuffer.sampleRate,
                channelCount: audioBuffer.numberOfChannels,
                duration: audioBuffer.duration,
            });

            // Normalize
            const { normalizedData, peak, gain } = normalizeAudio(rawData);
            setAudioStats(prev => prev ? { ...prev, peak, gainApplied: gain } : null);

            addLog(`Sending ${normalizedData.length} samples to worker`, 'info');

            workerRef.current.postMessage({
                type: 'transcribe',
                audio: normalizedData,
                language: 'english'
            });

            audioContext.close();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            addLog('Audio processing failed', 'error', msg);
            console.error('Error processing audio:', err);
            setError('Failed to process audio data');
            setIsTranscribing(false);
        }
    }, [isModelLoaded, addLog]);

    const startRecording = useCallback(async () => {
        setError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setAudioStream(stream); // Expose stream for visualization
            addLog('Microphone access granted', 'success');

            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                addLog('Recording stopped. Finalizing Blob...', 'info');
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                processAudio(blob);

                // Stop tracks
                stream.getTracks().forEach(track => track.stop());
                setAudioStream(null);
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            addLog('MediaRecorder started', 'info');
        } catch (err) {
            console.error('Error accessing microphone:', err);
            setError('Could not access microphone');
            addLog('Microphone access failed', 'error', err);
        }
    }, [processAudio, addLog]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    }, []);

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
