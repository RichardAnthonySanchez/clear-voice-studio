import { useRef, useEffect } from 'react';

interface AudioVisualizerProps {
    stream: MediaStream | null;
    isRecording: boolean;
    width?: number;
    height?: number;
    barColor?: string;
    backgroundColor?: string;
}

export function AudioVisualizer({
    stream,
    isRecording,
    width = 300,
    height = 50,
    barColor = 'rgb(6, 182, 212)', // Primary cyan
    backgroundColor = 'transparent'
}: AudioVisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();
    const analyserRef = useRef<AnalyserNode>();
    const sourceRef = useRef<MediaStreamAudioSourceNode>();
    const contextRef = useRef<AudioContext>();

    useEffect(() => {
        if (!stream || !isRecording || !canvasRef.current) {
            if (contextRef.current && contextRef.current.state !== 'closed') {
                contextRef.current.close();
            }
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            // Clear canvas
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Setup Audio Context
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        contextRef.current = audioContext;

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64; // Low resolution for simple bars
        analyserRef.current = analyser;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        sourceRef.current = source;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const barWidth = (width / bufferLength) * 2.5;

        const draw = () => {
            if (!isRecording) return;

            animationRef.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            ctx.fillStyle = backgroundColor;
            ctx.clearRect(0, 0, width, height);

            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * height;

                ctx.fillStyle = barColor;
                // Draw bars centered vertically
                const y = (height - barHeight) / 2;
                ctx.fillRect(x, y, barWidth, barHeight);

                x += barWidth + 1;
            }
        };

        draw();

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            if (sourceRef.current) sourceRef.current.disconnect();
            if (contextRef.current && contextRef.current.state !== 'closed') contextRef.current.close();
        };
    }, [stream, isRecording, width, height, barColor, backgroundColor]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="rounded-lg opacity-80"
        />
    );
}
