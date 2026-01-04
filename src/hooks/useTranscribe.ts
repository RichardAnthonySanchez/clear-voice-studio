import { useState, useRef, useCallback, useEffect } from 'react';
import Worker from '../worker?worker';

interface WorkerProgress {
    status: string;
    name: string;
    file: string;
    progress: number;
    loaded: number;
    total: number;
}

interface TranscribeHook {
    isModelLoading: boolean;
    isModelLoaded: boolean;
    isRecording: boolean;
    isTranscribing: boolean;
    transcription: string;
    progress: number;
    error: string | null;
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    resetTranscription: () => void;
}

export function useTranscribe(): TranscribeHook {
    const [isModelLoading, setIsModelLoading] = useState(false);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcription, setTranscription] = useState('');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const workerRef = useRef<Worker | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    // Initialize Worker
    useEffect(() => {
        if (!workerRef.current) {
            console.log('Initializing worker...');
            workerRef.current = new Worker();

            workerRef.current.onmessage = (event) => {
                const { type, data } = event.data;
                console.log('Worker message:', type, data);

                switch (type) {
                    case 'download':
                        // data is { status, name, file, progress, loaded, total }
                        if (data.status === 'progress' && data.progress) {
                            // Approximate overall progress or just show the active file progress
                            setProgress(Math.round(data.progress));
                        }
                        break;
                    case 'ready':
                        console.log('Worker ready');
                        setIsModelLoading(false);
                        setIsModelLoaded(true);
                        setProgress(100);
                        break;
                    case 'complete':
                        console.log('Transcription complete:', data);
                        setIsTranscribing(false);
                        if (data && typeof data === 'object' && data.text) {
                            // If it's an object with text property (which it usually is)
                            setTranscription(prev => {
                                const space = prev ? ' ' : '';
                                return prev + space + data.text.trim();
                            });
                        } else if (Array.isArray(data)) {
                            // Sometimes it returns chunks
                            const text = data.map((chunk: any) => chunk.text).join(' ');
                            setTranscription(prev => {
                                const space = prev ? ' ' : '';
                                return prev + space + text.trim();
                            });
                        }
                        break;
                    case 'error':
                        console.error('Worker error:', data);
                        setIsModelLoading(false);
                        setIsTranscribing(false);
                        setError(typeof data === 'string' ? data : 'An unknown error occurred in the worker');
                        break;
                }
            };

            // Start loading model immediately
            setIsModelLoading(true);
            workerRef.current.postMessage({ type: 'configure' });
        }

        return () => {
            workerRef.current?.terminate();
            workerRef.current = null;
        };
    }, []);

    const processAudio = useCallback(async (blob: Blob) => {
        if (!workerRef.current || !isModelLoaded) {
            console.warn('Worker not ready or model not loaded');
            return;
        }

        console.log('Processing audio blob size:', blob.size);
        setIsTranscribing(true);

        try {
            // Convert Blob -> ArrayBuffer -> Float32Array
            const audioContext = new AudioContext({ sampleRate: 16000 });
            const arrayBuffer = await blob.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const audioData = audioBuffer.getChannelData(0);

            console.log('Audio decoded, sending to worker. Length:', audioData.length);

            workerRef.current.postMessage({
                type: 'transcribe',
                audio: audioData,
                language: 'english'
            });

            // Clean up
            audioContext.close();
        } catch (err) {
            console.error('Error processing audio:', err);
            setError('Failed to process audio data');
            setIsTranscribing(false);
        }
    }, [isModelLoaded]);

    const startRecording = useCallback(async () => {
        setError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Suggest audio/webm which is standard in Chrome/Firefox
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                console.log('Recording stopped, creating blob...');
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                processAudio(blob);

                // Stop all tracks to release microphone
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            console.log('Recording started');
        } catch (err) {
            console.error('Error accessing microphone:', err);
            setError('Could not access microphone. Please ensure permissions are granted.');
        }
    }, [processAudio]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    }, []);

    const resetTranscription = useCallback(() => {
        setTranscription('');
        setError(null);
    }, []);

    return {
        isModelLoading,
        isModelLoaded,
        isRecording,
        isTranscribing,
        transcription,
        progress,
        error,
        startRecording,
        stopRecording,
        resetTranscription
    };
}
