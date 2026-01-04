import { Brain, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

interface ModelStatusProps {
  isLoading: boolean;
  isLoaded: boolean;
  progress: number;
  error: string | null;
}

export function ModelStatus({ isLoading, isLoaded, progress, error }: ModelStatusProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-navy-800/40 border border-border/30 backdrop-blur-sm">
      <Brain className="w-4 h-4 text-primary" />

      {error ? (
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-destructive" />
          <span className="text-xs text-destructive">Model error</span>
        </div>
      ) : isLoading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
          <span className="text-xs text-muted-foreground">
            Loading model... {progress > 0 && `${progress}%`}
          </span>
          {progress > 0 && (
            <div className="w-16 h-1.5 rounded-full bg-navy-700 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-cyan-soft transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      ) : isLoaded ? (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          <span className="text-xs text-muted-foreground">Model ready</span>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">Model not loaded</span>
      )}
    </div>
  );
}
