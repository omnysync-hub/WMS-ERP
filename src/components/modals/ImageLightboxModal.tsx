"use client";

import { useEffect, useState, useCallback } from "react";
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ExternalLink,
  Maximize2,
} from "lucide-react";

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
  title?: string;
  filePrefix?: string;
}

export function downloadImageFile(dataUrlOrUrl: string, filename: string) {
  try {
    if (dataUrlOrUrl.startsWith("data:")) {
      const a = document.createElement("a");
      a.href = dataUrlOrUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    if (dataUrlOrUrl.startsWith("blob:")) {
      const a = document.createElement("a");
      a.href = dataUrlOrUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // External or local URL
    fetch(dataUrlOrUrl)
      .then((res) => {
        if (!res.ok) throw new Error("Network response was not ok");
        return res.blob();
      })
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      })
      .catch(() => {
        // Fallback for direct link
        const a = document.createElement("a");
        a.href = dataUrlOrUrl;
        a.download = filename;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
  } catch (err) {
    console.error("Failed to download image:", err);
  }
}

export default function ImageLightboxModal({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
  title = "Photo Viewer",
  filePrefix = "job-photo",
}: ImageLightboxModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, images.length - 1)));
      setZoom(1);
      setRotation(0);
    }
  }, [isOpen, initialIndex, images.length]);

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % images.length);
    setZoom(1);
    setRotation(0);
  }, [images.length]);

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    setZoom(1);
    setRotation(0);
  }, [images.length]);

  // Handle keyboard events (ESC, ArrowLeft, ArrowRight)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, handleNext, handlePrev]);

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex] || "";

  // Determine file extension
  let ext = "jpg";
  if (currentImage.startsWith("data:image/png")) ext = "png";
  else if (currentImage.startsWith("data:image/webp")) ext = "webp";
  else if (currentImage.endsWith(".png")) ext = "png";
  else if (currentImage.endsWith(".webp")) ext = "webp";

  const downloadFilename = `${filePrefix}-${currentIndex + 1}.${ext}`;

  const handleDownloadCurrent = () => {
    downloadImageFile(currentImage, downloadFilename);
  };

  const handleOpenInNewTab = () => {
    if (currentImage.startsWith("data:")) {
      const win = window.open();
      if (win) {
        win.document.write(
          `<title>${downloadFilename}</title><body style="margin:0;background:#0e0e11;display:flex;align-items:center;justify-content:center;height:100vh;"><img src="${currentImage}" style="max-width:100%;max-height:100%;object-contain:contain;"/></body>`
        );
      }
    } else {
      window.open(currentImage, "_blank");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/92 backdrop-blur-md select-none animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-black/60 border-b border-white/10 text-white z-20">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white tracking-wide truncate max-w-xs sm:max-w-md">
              {title}
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              Photo {currentIndex + 1} of {images.length}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Zoom In */}
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-200 hover:text-white transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {/* Zoom Out */}
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-200 hover:text-white transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* Reset Zoom / Rotate */}
          <button
            type="button"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-200 hover:text-white transition"
            title="Rotate 90° Clockwise"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Open in new tab */}
          <button
            type="button"
            onClick={handleOpenInNewTab}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-200 hover:text-white transition hidden sm:inline-flex"
            title="Open in new window"
          >
            <ExternalLink className="w-4 h-4" />
          </button>

          {/* DOWNLOAD BUTTON */}
          <button
            type="button"
            onClick={handleDownloadCurrent}
            className="px-3.5 py-2 rounded-lg bg-[#0D7A5F] hover:bg-[#0A624C] text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-950/40 ml-1"
            title="Download image to your computer"
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </button>

          {/* CLOSE BUTTON */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-red-500/80 text-zinc-200 hover:text-white transition ml-2"
            title="Close viewer (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div
        className="flex-1 relative flex items-center justify-center p-4 overflow-hidden"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Previous Button */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 border border-white/20 text-white flex items-center justify-center transition shadow-xl"
            title="Previous image (Left Arrow)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Display Image */}
        <div
          className="relative max-w-full max-h-full flex items-center justify-center transition-transform duration-200"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentImage}
            alt={`${title} #${currentIndex + 1}`}
            className="max-h-[76vh] max-w-[90vw] object-contain rounded-lg shadow-2xl border border-white/10 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Next Button */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 border border-white/20 text-white flex items-center justify-center transition shadow-xl"
            title="Next image (Right Arrow)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom Thumbnail Bar (if multiple images) */}
      <div className="px-4 py-3 bg-black/70 border-t border-white/10 flex items-center justify-between text-xs text-zinc-400 z-20">
        <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-full mx-auto">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setCurrentIndex(i);
                setZoom(1);
                setRotation(0);
              }}
              className={`w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition ${
                currentIndex === i
                  ? "border-[#0D7A5F] ring-2 ring-emerald-500/50 scale-105"
                  : "border-white/20 opacity-60 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
