import { Copy, Check, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { CorrectionResult } from '@/lib/correctionEngine';

interface OutputDisplayProps {
  result: CorrectionResult | null;
  isProcessing: boolean;
}

export function OutputDisplay({ result, isProcessing }: OutputDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (result?.corrected) {
      await navigator.clipboard.writeText(result.corrected);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative group">
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/10 to-transparent opacity-50 blur-xl -z-10" />
      
      <div className="glass-panel rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 bg-navy-800/30">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground/90">Corrected Output</span>
          </div>
          
          {result?.corrected && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-navy-700/60 hover:bg-navy-600/60 border border-border/50 hover:border-primary/30 transition-all duration-200 text-muted-foreground hover:text-foreground"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-primary" />
                  <span className="text-primary">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-5 md:p-6 min-h-[160px] md:min-h-[200px] relative">
          <div className="absolute inset-0 dot-pattern opacity-20 pointer-events-none" />
          
          {isProcessing ? (
            <div className="flex items-center justify-center h-full min-h-[120px]">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                <span className="text-sm text-muted-foreground">Processing...</span>
              </div>
            </div>
          ) : result?.corrected ? (
            <div className="animate-fade-in">
              <p className="font-mono text-sm md:text-base text-foreground leading-relaxed whitespace-pre-wrap">
                {result.corrected}
              </p>
              
              {result.changes.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/30">
                  <p className="text-xs text-muted-foreground mb-2">
                    {result.changes.length} correction{result.changes.length !== 1 ? 's' : ''} applied
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(new Set(result.changes.map(c => c.type))).map(type => (
                      <span
                        key={type}
                        className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary/80 border border-primary/20"
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full min-h-[120px]">
              <p className="text-sm text-muted-foreground/60 italic">
                Corrected text will appear here...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
