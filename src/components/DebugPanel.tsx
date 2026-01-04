import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Terminal, Activity, FileAudio, Cpu } from 'lucide-react';
import { ScrollArea } from '@radix-ui/react-scroll-area';

interface DebugLog {
    timestamp: number;
    message: string;
    data?: any;
    type: 'info' | 'error' | 'success';
}

interface DebugPanelProps {
    logs: DebugLog[];
    audioStats: {
        sampleRate: number;
        channelCount: number;
        duration: number;
        peak?: number;
        gainApplied?: number;
    } | null;
    modelState: {
        isLoading: boolean;
        isLoaded: boolean;
        isTranscribing: boolean;
    };
}

export function DebugPanel({ logs, audioStats, modelState }: DebugPanelProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="w-full max-w-4xl mx-auto mt-8 border border-border/50 rounded-xl overflow-hidden bg-black/40 backdrop-blur-sm">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 transition-colors"
            >
                <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
                    <Terminal className="w-4 h-4" />
                    <span>Debug Console</span>
                    {modelState.isTranscribing && (
                        <span className="flex h-2 w-2 relative ml-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                        </span>
                    )}
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {isOpen && (
                <div className="p-4 space-y-4 text-xs font-mono">

                    {/* Status Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Model State */}
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
                            <div className="flex items-center gap-2 text-primary font-bold">
                                <Cpu className="w-3 h-3" /> Model Status
                            </div>
                            <div className="space-y-1 text-muted-foreground">
                                <div className="flex justify-between">
                                    <span>Loaded:</span>
                                    <span className={modelState.isLoaded ? 'text-green-400' : 'text-yellow-400'}>
                                        {modelState.isLoaded ? 'YES' : 'NO'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Transcribing:</span>
                                    <span className={modelState.isTranscribing ? 'text-cyan-400 animate-pulse' : 'text-gray-400'}>
                                        {modelState.isTranscribing ? 'ACTIVE' : 'IDLE'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Audio Stats */}
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
                            <div className="flex items-center gap-2 text-purple-400 font-bold">
                                <FileAudio className="w-3 h-3" /> Last Audio
                            </div>
                            {audioStats ? (
                                <div className="space-y-1 text-muted-foreground">
                                    <div className="flex justify-between"><span>Rate:</span> <span>{audioStats.sampleRate}Hz</span></div>
                                    <div className="flex justify-between"><span>Chans:</span> <span>{audioStats.channelCount}</span></div>
                                    <div className="flex justify-between"><span>Dur:</span> <span>{audioStats.duration.toFixed(2)}s</span></div>
                                    <div className="flex justify-between"><span>Peak:</span> <span>{audioStats.peak?.toFixed(4) ?? 'N/A'}</span></div>
                                    <div className="flex justify-between"><span>Gain:</span> <span className="text-yellow-400">x{audioStats.gainApplied?.toFixed(2) ?? '1.0'}</span></div>
                                </div>
                            ) : (
                                <div className="text-gray-500 italic pt-2">No audio processed yet</div>
                            )}
                        </div>

                        {/* System Health / Info */}
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
                            <div className="flex items-center gap-2 text-green-400 font-bold">
                                <Activity className="w-3 h-3" /> System
                            </div>
                            <div className="space-y-1 text-muted-foreground">
                                <div className="flex justify-between"><span>Worker:</span> <span>Active</span></div>
                                <div className="flex justify-between"><span>Logs:</span> <span>{logs.length}</span></div>
                                <div className="flex justify-between"><span>Env:</span> <span>Browser</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Logs Stream */}
                    <div className="border border-white/10 rounded-lg bg-black/50 h-48 overflow-y-auto p-2 space-y-1">
                        {logs.length === 0 && <div className="text-gray-600 italic">Waiting for events...</div>}
                        {logs.map((log, i) => (
                            <div key={i} className="flex gap-2">
                                <span className="text-gray-500">[{new Date(log.timestamp).toLocaleTimeString().split(' ')[0]}]</span>
                                <span className={`
                     ${log.type === 'error' ? 'text-red-400' : ''}
                     ${log.type === 'success' ? 'text-green-400' : ''}
                     ${log.type === 'info' ? 'text-gray-300' : ''}
                   `}>
                                    {log.message}
                                </span>
                                {log.data && (
                                    <span className="text-gray-600 truncate max-w-[200px]" title={JSON.stringify(log.data)}>
                                        {typeof log.data === 'object' ? JSON.stringify(log.data) : String(log.data)}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>

                </div>
            )}
        </div>
    );
}
