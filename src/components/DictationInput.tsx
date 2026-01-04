import { forwardRef } from 'react';
import { Mic } from 'lucide-react';

interface DictationInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isRecording?: boolean;
  onRecord?: () => void;
}

export const DictationInput = forwardRef<HTMLTextAreaElement, DictationInputProps>(
  ({ value, onChange, placeholder = "Dictate and format text here...", disabled, isRecording, onRecord }, ref) => {
    return (
      <div className="relative group">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 blur-xl -z-10" />

        <div className="relative glass-panel-glow rounded-xl overflow-hidden">
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 dot-pattern opacity-30 pointer-events-none" />

          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full min-h-[200px] md:min-h-[280px] p-5 md:p-6 bg-transparent text-foreground placeholder:text-muted-foreground font-mono text-sm md:text-base resize-none focus:outline-none relative z-10 leading-relaxed"
            style={{ caretColor: 'hsl(var(--primary))' }}
          />

          {/* Microphone indicator */}
          <div className="absolute bottom-4 right-4 z-20">
            <button
              onClick={onRecord}
              disabled={disabled && !isRecording}
              className={`p-2.5 rounded-lg border backdrop-blur-sm transition-all duration-300 cursor-pointer group/mic ${isRecording
                  ? 'bg-red-500/20 border-red-500/50 text-red-500 animate-pulse'
                  : 'bg-navy-700/60 border-border/50 hover:bg-navy-600/60 hover:border-primary/30 text-muted-foreground hover:text-primary'
                }`}
              type="button"
            >
              <Mic className={`w-4 h-4 transition-colors ${isRecording ? 'text-red-500' : 'group-hover/mic:text-primary'}`} />
            </button>
          </div>

          {/* Subtle gradient border effect */}
          <div className="absolute inset-0 rounded-xl pointer-events-none border border-transparent bg-gradient-to-br from-primary/10 via-transparent to-primary/5 opacity-50" style={{ mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', maskComposite: 'exclude', padding: '1px' }} />
        </div>
      </div>
    );
  }
);

DictationInput.displayName = 'DictationInput';
