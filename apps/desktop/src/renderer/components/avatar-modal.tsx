import { useEffect, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Move, RotateCcw, Trash2, Upload, VideoOff, ZoomIn } from 'lucide-react';

import { useApiClient } from '../auth/use-auth.js';
import { AvatarImage } from './avatar-image.js';
import { Modal } from './modal.js';

interface AvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  hasAvatar: boolean;
  onAvatarUpdated: () => void;
}

export function AvatarModal({
  isOpen,
  onClose,
  userId,
  userName,
  hasAvatar,
  onAvatarUpdated,
}: AvatarModalProps): React.JSX.Element {
  const api = useApiClient();
  const [mode, setMode] = useState<'SELECT' | 'WEBCAM' | 'PREVIEW'>('SELECT');
  const [selectedImageData, setSelectedImageData] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Webcam state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopWebcam();
      setMode('SELECT');
      setSelectedImageData(null);
      setError(null);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    }
  }, [isOpen]);

  const stopWebcam = (): void => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startWebcam = async (): Promise<void> => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setMode('WEBCAM');
    } catch {
      setError('Não foi possível acessar a câmera. Verifique as permissões de vídeo.');
    }
  };

  const captureWebcam = (): void => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const video = videoRef.current;
    const size = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, 512, 512);

    const base64 = canvas.toDataURL('image/jpeg', 0.9);
    stopWebcam();
    setSelectedImageData(base64);
    setOffset({ x: 0, y: 0 });
    setZoom(1);
    setMode('PREVIEW');
  };

  const handleFileSelect = (file: File): void => {
    setError(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Formato não suportado. Por favor, envie uma imagem JPEG, PNG ou WebP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('A imagem ultrapassa o limite máximo de 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setSelectedImageData(dataUrl);
      setOffset({ x: 0, y: 0 });
      setZoom(1);
      setMode('PREVIEW');
    };
    reader.readAsDataURL(file);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    // Limit bounds proportional to zoom
    const maxBound = Math.max(80, 112 * (zoom - 0.5));
    setOffset({
      x: Math.max(-maxBound, Math.min(maxBound, newX)),
      y: Math.max(-maxBound, Math.min(maxBound, newY)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if not captured
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>): void => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((prev) => Math.max(1, Math.min(3, parseFloat((prev + delta).toFixed(2)))));
  };

  const handleResetPosition = (): void => {
    setOffset({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleUpload = async (): Promise<void> => {
    if (!selectedImageData) return;
    try {
      setLoading(true);
      setError(null);

      // Create cropped 1:1 image canvas with zoom and pan offset
      const img = new Image();
      img.src = selectedImageData;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Falha ao processar canvas');

      // The preview container size in DOM is 224px (w-56 h-56)
      const containerSize = 224;
      const minDimension = Math.min(img.width, img.height);
      const scaleFactor = minDimension / containerSize;

      const side = minDimension / zoom;
      
      // Calculate sx and sy taking panning offset into account
      const panXSource = (offset.x * scaleFactor) / zoom;
      const panYSource = (offset.y * scaleFactor) / zoom;

      let sx = (img.width - side) / 2 - panXSource;
      let sy = (img.height - side) / 2 - panYSource;

      // Bound within image limits
      sx = Math.max(0, Math.min(img.width - side, sx));
      sy = Math.max(0, Math.min(img.height - side, sy));

      ctx.drawImage(img, sx, sy, side, side, 0, 0, 512, 512);
      const finalBase64 = canvas.toDataURL('image/jpeg', 0.9);

      await api.uploadAvatar(userId, finalBase64, 'image/jpeg');
      onAvatarUpdated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar a foto de perfil.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (): Promise<void> => {
    if (!confirm('Deseja realmente remover a foto de perfil?')) return;
    try {
      setLoading(true);
      setError(null);
      await api.removeAvatar(userId);
      onAvatarUpdated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao remover a foto de perfil.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        stopWebcam();
        onClose();
      }}
      title={`Foto de Perfil — ${userName}`}
      maxWidth="md"
    >
      <div className="space-y-6">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-sm">
            {error}
          </div>
        )}

        {mode === 'SELECT' && (
          <div className="flex flex-col items-center space-y-6">
            <AvatarImage userId={userId} name={userName} hasAvatar={hasAvatar} size="xl" />

            <div className="grid grid-cols-2 gap-3 w-full">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all text-slate-700 dark:text-slate-300 group cursor-pointer"
              >
                <ImageIcon className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-semibold">Escolher imagem</span>
                <span className="text-xs text-slate-500">JPG, PNG ou WebP</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />

              <button
                type="button"
                onClick={() => void startWebcam()}
                className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all text-slate-700 dark:text-slate-300 group cursor-pointer"
              >
                <Camera className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-semibold">Tirar foto</span>
                <span className="text-xs text-slate-500">Usar câmera</span>
              </button>
            </div>

            {hasAvatar && (
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleRemove()}
                className="inline-flex items-center text-sm font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 transition-colors pt-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Remover foto atual
              </button>
            )}
          </div>
        )}

        {mode === 'WEBCAM' && (
          <div className="flex flex-col items-center space-y-4">
            <div className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-blue-600 bg-black shadow-lg">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => {
                  stopWebcam();
                  setMode('SELECT');
                }}
                className="secondary-button text-sm px-4 py-2"
              >
                <VideoOff className="w-4 h-4 mr-1.5" /> Cancelar
              </button>
              <button
                type="button"
                onClick={captureWebcam}
                className="primary-button text-sm px-5 py-2"
              >
                <Camera className="w-4 h-4 mr-1.5" /> Capturar Foto
              </button>
            </div>
          </div>
        )}

        {mode === 'PREVIEW' && selectedImageData && (
          <div className="flex flex-col items-center space-y-5">
            {/* Interactive Crop Window */}
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
              title="Clique e arraste para posicionar a foto. Use a roda do mouse para dar zoom."
              className={`relative w-56 h-56 rounded-full overflow-hidden border-4 border-blue-600 shadow-xl bg-slate-100 dark:bg-slate-800 touch-none select-none ${
                isDragging ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            >
              <img
                src={selectedImageData}
                alt="Pré-visualização"
                draggable={false}
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                }}
                className="w-full h-full object-cover select-none pointer-events-none transition-none"
              />
              
              {/* Subtle drag hint overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20 pointer-events-none">
                <span className="bg-black/70 text-white text-[10px] font-semibold px-2 py-1 rounded-full flex items-center gap-1">
                  <Move className="w-3 h-3" /> Arrastar para enquadrar
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <Move className="w-3.5 h-3.5 text-blue-500" />
              <span>Arraste a foto para posicionar ou use o zoom abaixo</span>
            </div>

            {/* Controls Bar */}
            <div className="w-full max-w-xs flex items-center space-x-3 px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <ZoomIn className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Zoom</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs font-mono text-slate-500 w-9 text-right shrink-0">
                {zoom.toFixed(1)}x
              </span>
              {(zoom > 1 || offset.x !== 0 || offset.y !== 0) && (
                <button
                  type="button"
                  onClick={handleResetPosition}
                  title="Centralizar e resetar zoom"
                  className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex justify-end space-x-3 w-full pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setSelectedImageData(null);
                  setMode('SELECT');
                  setOffset({ x: 0, y: 0 });
                  setZoom(1);
                }}
                className="secondary-button text-sm px-4 py-2"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleUpload()}
                className="primary-button text-sm px-5 py-2"
              >
                <Upload className="w-4 h-4 mr-1.5" /> {loading ? 'Salvando...' : 'Salvar Foto'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
