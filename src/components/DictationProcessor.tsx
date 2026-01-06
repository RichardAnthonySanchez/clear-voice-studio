import { useState, useCallback, useEffect } from 'react';
import { DictationInput } from './DictationInput';
import { ModelStatus } from './ModelStatus';
import { AudioVisualizer } from './AudioVisualizer';
import { DebugPanel } from './DebugPanel';
import { useTranscribe } from '@/hooks/useTranscribe';

export function DictationProcessor() {
  const [inputText, setInputText] = useState('');


  const {
    isModelLoading,
    isModelLoaded,
    progress: loadingProgress,
    error: modelError,
    isRecording,
    isTranscribing,
    transcription,
    logs,
    audioStats,
    audioStream,
    startRecording,
    stopRecording,
    resetTranscription
  } = useTranscribe();

  // Sync transcription to input text
  useEffect(() => {
    if (transcription) {
      setInputText(prev => {
        const trimmed = prev.trim();
        return trimmed ? `${trimmed} ${transcription}` : transcription;
      });
    }
  }, [transcription]);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);



  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-3 mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          <span className="text-foreground">Voice</span>
          <span className="text-primary text-glow">Refine</span>
        </h1>
        <p className="text-muted-foreground text-sm md:text-base max-w-lg mx-auto">
          Transform raw dictation into polished, readable text using Xenova Whisper & Rule-Based Logic
        </p>
      </div>

      {/* Model Status */}
      <div className="flex justify-center">
        <ModelStatus
          isLoading={isModelLoading || isTranscribing}
          isLoaded={isModelLoaded}
          progress={loadingProgress}
          error={modelError}
        />
      </div>

      {/* Input Section */}
      <div className="space-y-3 relative">
        <div className="flex justify-between items-center pl-1 h-6">
          <label className="text-sm font-medium text-foreground/80">Transcription</label>
          <div className="flex items-center gap-4">
            {isRecording && (
              <AudioVisualizer stream={audioStream} isRecording={isRecording} width={100} height={30} />
            )}
            {isTranscribing && (
              <span className="text-xs text-primary animate-pulse font-medium">Transcribing...</span>
            )}
          </div>
        </div>
        <DictationInput
          value={inputText}
          onChange={setInputText}
          disabled={false}
          isRecording={isRecording}
          onRecord={toggleRecording}
        />
      </div>



      {/* Debug Panel */}
      <DebugPanel
        logs={logs}
        audioStats={audioStats}
        modelState={{ isLoading: isModelLoading, isLoaded: isModelLoaded, isTranscribing }}
      />

      {/* Info Footer */}
      <div className="text-center pt-4">
        <p className="text-xs text-muted-foreground/60">
          Powered by Xenova Whisper • 100% browser-based • No data leaves your device
        </p>
      </div>
    </div>
  );
}
