import { useState, useCallback, useRef, useEffect } from 'react';
import { pipeline } from '@huggingface/transformers';

export interface EmbeddingResult {
  text: string;
  embedding: number[];
}

type ExtractorPipeline = Awaited<ReturnType<typeof pipeline<'feature-extraction'>>>;

export function useEmbeddings() {
  const [isLoading, setIsLoading] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const extractorRef = useRef<ExtractorPipeline | null>(null);

  const loadModel = useCallback(async () => {
    if (extractorRef.current) {
      setIsModelLoaded(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    setLoadingProgress(0);

    try {
      const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        progress_callback: (progress: { progress?: number; status?: string }) => {
          if (progress.progress) {
            setLoadingProgress(Math.round(progress.progress));
          }
        }
      });
      extractorRef.current = extractor;
      setIsModelLoaded(true);
      setLoadingProgress(100);
    } catch (err) {
      console.error('Failed to load embedding model:', err);
      setError(err instanceof Error ? err.message : 'Failed to load model');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const computeEmbedding = useCallback(async (text: string): Promise<number[] | null> => {
    if (!extractorRef.current) {
      setError('Model not loaded');
      return null;
    }

    try {
      const output = await extractorRef.current(text, {
        pooling: 'mean',
        normalize: true
      });
      
      return Array.from((output as any).data as Float32Array);
    } catch (err) {
      console.error('Failed to compute embedding:', err);
      setError(err instanceof Error ? err.message : 'Failed to compute embedding');
      return null;
    }
  }, []);

  const computeEmbeddings = useCallback(async (texts: string[]): Promise<EmbeddingResult[]> => {
    if (!extractorRef.current) {
      setError('Model not loaded');
      return [];
    }

    const results: EmbeddingResult[] = [];

    for (const text of texts) {
      const embedding = await computeEmbedding(text);
      if (embedding) {
        results.push({ text, embedding });
      }
    }

    return results;
  }, [computeEmbedding]);

  useEffect(() => {
    loadModel();
  }, [loadModel]);

  return {
    isLoading,
    isModelLoaded,
    loadingProgress,
    error,
    loadModel,
    computeEmbedding,
    computeEmbeddings
  };
}
