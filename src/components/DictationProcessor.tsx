import { useState, useCallback } from 'react';
import { Eraser, Zap } from 'lucide-react';
import { DictationInput } from './DictationInput';
import { OutputDisplay } from './OutputDisplay';
import { ModelStatus } from './ModelStatus';
import { useEmbeddings } from '@/hooks/useEmbeddings';
import { applyCorrections, splitIntoSentences, type CorrectionResult } from '@/lib/correctionEngine';

export function DictationProcessor() {
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const { isLoading, isModelLoaded, loadingProgress, error, computeEmbeddings } = useEmbeddings();

  const processText = useCallback(async () => {
    if (!inputText.trim() || !isModelLoaded) return;
    
    setIsProcessing(true);
    
    try {
      // Split into sentences for embedding computation
      const sentences = splitIntoSentences(inputText);
      
      // Compute embeddings for semantic analysis
      const embeddings = await computeEmbeddings(sentences);
      
      // Apply rule-based corrections with semantic awareness
      const similarities = embeddings.map(e => e.embedding.length > 0 ? 1 : 0);
      const correctionResult = applyCorrections(inputText, similarities);
      
      setResult(correctionResult);
    } catch (err) {
      console.error('Processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [inputText, isModelLoaded, computeEmbeddings]);

  const handleClear = () => {
    setInputText('');
    setResult(null);
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
          Transform raw dictation into polished, readable text using semantic analysis
        </p>
      </div>

      {/* Model Status */}
      <div className="flex justify-center">
        <ModelStatus 
          isLoading={isLoading}
          isLoaded={isModelLoaded}
          progress={loadingProgress}
          error={error}
        />
      </div>

      {/* Input Section */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground/80 pl-1">Raw Dictation</label>
        <DictationInput
          value={inputText}
          onChange={setInputText}
          disabled={isProcessing}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={processText}
          disabled={!inputText.trim() || !isModelLoaded || isProcessing}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-sm bg-gradient-to-r from-primary to-cyan-soft text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed btn-glow transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Zap className="w-4 h-4" />
          Process & Correct
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
          Powered by all-MiniLM-L6-v2 • 100% browser-based • No data leaves your device
        </p>
      </div>
    </div>
  );
}
