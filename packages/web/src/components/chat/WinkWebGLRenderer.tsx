import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

export interface WinkWebGLRendererHandle {
  getVideo: () => HTMLVideoElement | null;
  play: () => Promise<void>;
  pause: () => void;
  load: () => void;
}

interface WinkWebGLRendererProps {
  src: string;
  volume: number; // 0.0 to 1.0
  muted: boolean;
  onLoadedMetadata?: () => void;
  onCanPlay?: () => void;
  onPlaying?: () => void;
  onEnded?: () => void;
  onStalled?: () => void;
  onError?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const VERTEX_SHADER_SRC = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

const FRAGMENT_SHADER_SRC = `
precision mediump float;
uniform sampler2D u_video;
varying vec2 v_texCoord;
void main() {
  // Top half: RGB color (y from 0.0 to 0.5)
  vec2 rgbCoord = vec2(v_texCoord.x, v_texCoord.y * 0.5);
  // Bottom half: Grayscale alpha mask (y from 0.5 to 1.0)
  vec2 alphaCoord = vec2(v_texCoord.x, 0.5 + v_texCoord.y * 0.5);
  vec4 color = texture2D(u_video, rgbCoord);
  float alpha = texture2D(u_video, alphaCoord).r;
  gl_FragColor = vec4(color.rgb, alpha);
}
`;

export const WinkWebGLRenderer = forwardRef<WinkWebGLRendererHandle, WinkWebGLRendererProps>(function WinkWebGLRenderer(
  {
    src,
    volume,
    muted,
    onLoadedMetadata,
    onCanPlay,
    onPlaying,
    onEnded,
    onStalled,
    onError,
    className,
    style,
  },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const rvfcIdRef = useRef<number | null>(null);

  useImperativeHandle(ref, () => ({
    getVideo: () => videoRef.current,
    play: async () => {
      if (videoRef.current) {
        return videoRef.current.play();
      }
    },
    pause: () => {
      videoRef.current?.pause();
    },
    load: () => {
      videoRef.current?.load();
    },
  }));

  // Sync volume and mute state
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.volume = Math.min(1, Math.max(0, volume));
      video.muted = muted;
    }
  }, [volume, muted]);

  // Setup WebGL canvas and render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: false,
        antialias: true,
      });
    } catch {
      gl = null;
    }

    if (!gl) {
      // 2D fallback for environments without WebGL
      let active = true;
      const ctx = canvas.getContext('2d');
      const render2d = () => {
        if (!active || !video || !ctx) return;
        if (video.readyState >= 2) {
          const w = canvas.width || 1920;
          const h = canvas.height || 1080;
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight / 2, 0, 0, w, h);
        }
        animationFrameIdRef.current = requestAnimationFrame(render2d);
      };
      render2d();
      return () => {
        active = false;
        if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      };
    }

    // Helper: compile shader
    function compileShader(type: number, source: string): WebGLShader | null {
      if (!gl) return null;
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn('[WinkWebGL] Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const fs = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('[WinkWebGL] Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Quad geometry: full clip space [-1, 1], texCoords [0, 1] (flipped Y for WebGL texture)
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
      ]),
      gl.STATIC_DRAW
    );

    const aPosLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        0, 1,
        1, 1,
        0, 0,
        0, 0,
        1, 1,
        1, 0,
      ]),
      gl.STATIC_DRAW
    );

    const aTexLoc = gl.getAttribLocation(program, 'a_texCoord');
    gl.enableVertexAttribArray(aTexLoc);
    gl.vertexAttribPointer(aTexLoc, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Enable blending for true transparent overlay
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let active = true;

    const render = () => {
      if (!active || !video || !gl) return;

      if (video.readyState >= 2) {
        // Set internal canvas resolution to match single frame (1920x1080)
        const frameW = video.videoWidth || 1920;
        const frameH = (video.videoHeight ? video.videoHeight / 2 : 1080);
        if (canvas.width !== frameW || canvas.height !== frameH) {
          canvas.width = frameW;
          canvas.height = frameH;
          gl.viewport(0, 0, frameW, frameH);
        }

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      // Schedule next frame
      if (typeof (video as any).requestVideoFrameCallback === 'function') {
        rvfcIdRef.current = (video as any).requestVideoFrameCallback(render);
      } else {
        animationFrameIdRef.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      active = false;
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (rvfcIdRef.current && typeof (video as any).cancelVideoFrameCallback === 'function') {
        (video as any).cancelVideoFrameCallback(rvfcIdRef.current);
      }
      try {
        if (texture) gl?.deleteTexture(texture);
        if (positionBuffer) gl?.deleteBuffer(positionBuffer);
        if (texCoordBuffer) gl?.deleteBuffer(texCoordBuffer);
        if (program) gl?.deleteProgram(program);
        if (vs) gl?.deleteShader(vs);
        if (fs) gl?.deleteShader(fs);
      } catch {
        // Context cleanup
      }
    };
  }, [src]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Hidden audio/video engine providing hardware decoding & synchronized audio */}
      <video
        ref={videoRef}
        src={src}
        autoPlay
        playsInline
        crossOrigin="anonymous"
        onLoadedMetadata={onLoadedMetadata}
        onCanPlay={onCanPlay}
        onPlaying={onPlaying}
        onEnded={onEnded}
        onStalled={onStalled}
        onError={onError}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
      {/* Visible GPU-composited canvas delivering true alpha transparency on Safari */}
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        className={className}
        style={{
          backgroundColor: 'transparent',
          ...style,
        }}
      />
    </div>
  );
});
