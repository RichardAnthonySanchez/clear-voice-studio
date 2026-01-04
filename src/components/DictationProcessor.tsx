import { useState, useCallback, useEffect } from 'react';
import { Eraser, Zap, StopCircle } from 'lucide-react';
import { DictationInput } from './DictationInput';
import { OutputDisplay } from './OutputDisplay';
import { ModelStatus } from './ModelStatus';
import { useTranscribe } from '@/hooks/useTranscribe';
import { applyCorrections, type CorrectionResult } from '@/lib/correctionEngine';

export function DictationProcessor() {
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const {
    isModelLoading,
    isModelLoaded,
    progress: loadingProgress,
    error: modelError,
    isRecording,
    isTranscribing,
    transcription,
    startRecording,
    stopRecording,
    resetTranscription
  } = useTranscribe();

  // Sync transcription to input text
  useEffect(() => {
    if (transcription) {
      setInputText(transcription);
    }
  }, [transcription]);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const processText = useCallback(() => {
    if (!inputText.trim()) return;

    setIsProcessing(true);

    try {
      // Direct rule-based correction without embeddings
      const correctionResult = applyCorrections(inputText);
      setResult(correctionResult);
    } catch (err) {
      console.error('Processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [inputText]);

  const handleClear = () => {
    setInputText('');
    setResult(null);
    resetTranscription();
  };

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
      <div className="space-y-3">
        <div className="flex justify-between items-center pl-1">
          <label className="text-sm font-medium text-foreground/80">Raw Dictation</label>
          {isTranscribing && (
            <span className="text-xs text-primary animate-pulse">Transcribing...</span>
          )}
        </div>
        <DictationInput
          value={inputText}
          onChange={setInputText}
          disabled={isProcessing}
          isRecording={isRecording}
          onRecord={toggleRecording}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={processText}
          disabled={!inputText.trim() || isProcessing}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-sm bg-gradient-to-r from-primary to-cyan-soft text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed btn-glow transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Zap className="w-4 h-4" />
          Refine Text
        </button>

        <button
          onClick={handleClear}
          disabled={!inputText && !result}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-sm bg-navy-700/60 text-foreground/80 hover:text-foreground border border-border/50 hover:border-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          <Eraser className="w-4 h-4" />
          Clear
        </button>
      </div>

      {/* Output Section */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground/80 pl-1">Refined Output</label>
        <OutputDisplay result={result} isProcessing={isProcessing} />
      </div>

      {/* Info Footer */}
      <div className="text-center pt-4">
        <p className="text-xs text-muted-foreground/60">
          Powered by Xenova Whisper • 100% browser-based • No data leaves your device
        </p>
      </div>
    </div>
  );
}
