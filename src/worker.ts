
import { pipeline, env } from '@xenova/transformers';

// Skip local checks for browser environment to avoid 404s on local file access for models
env.allowLocalModels = false;
env.useBrowserCache = true;

class PipelineSingleton {
    static instance: any = null;
    static model_id = 'Xenova/whisper-tiny.en';

    static async getInstance(progress_callback: Function | null = null) {
        if (this.instance === null) {
            this.instance = await pipeline('automatic-speech-recognition', this.model_id, {
                quantized: true,
                progress_callback,
            });
        }
        return this.instance;
    }
}

// Listen for messages from the main thread
self.addEventListener('message', async (event: MessageEvent) => {
    const { type, audio, language } = event.data;
    console.log('[Worker] Received message:', type);

    if (type === 'configure') {
        try {
            console.log('[Worker] Loading model pipeline...');
            // Pre-load the model
            await PipelineSingleton.getInstance((data: any) => {
                self.postMessage({
                    type: 'download',
                    data
                });
            });
            console.log('[Worker] Model loaded successfully');
            self.postMessage({ type: 'ready' });
        } catch (error) {
            console.error('[Worker] Error loading model:', error);
            self.postMessage({ type: 'error', data: (error as Error).message });
        }
    } else if (type === 'transcribe') {
        if (!audio) {
            console.error('[Worker] No audio data provided');
            self.postMessage({ type: 'error', data: 'No audio data provided' });
            return;
        }

        try {
            console.log('[Worker] Starting transcription via pipeline...');
            const transcriber = await PipelineSingleton.getInstance();

            const output = await transcriber(audio, {
                language: language || 'english',
                chunk_length_s: 30,
                stride_length_s: 5,
                task: 'transcribe',
                return_timestamps: true,
            });

            console.log('[Worker] Transcription output:', output);

            self.postMessage({
                type: 'complete',
                data: output
            });
        } catch (error) {
            console.error('[Worker] Transcription error:', error);
            self.postMessage({ type: 'error', data: (error as Error).message });
        }
    }
});
