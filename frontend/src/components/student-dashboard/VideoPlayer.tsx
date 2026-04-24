"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Settings,
  Subtitles,
  ChevronDown,
  ChevronUp,
  Loader2,
  SkipForward,
  PictureInPicture2,
} from "lucide-react";
import { toast } from "sonner";
import type { ModuleMaterial, MaterialVariant } from "@/types/student-dashboard";
import { studentApi } from "@/lib/api";

// ─── Props ──────────────────────────────────────────────────────

interface VideoPlayerProps {
  material: ModuleMaterial;
  courseId?: string;
  moduleId?: string;
  locale?: string;
  onComplete?: () => void;
  nextMaterialTitle?: string;
  onNextMaterial?: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function getResolutionLabel(resolution: string): string {
  switch (resolution) {
    case "360p":
      return "360p";
    case "720p":
      return "720p HD";
    case "1080p":
      return "1080p Full HD";
    default:
      return resolution;
  }
}

function pickDefaultVariant(variants: MaterialVariant[]): MaterialVariant | null {
  if (variants.length === 0) return null;
  const v720 = variants.find((v) => v.resolution === "720p");
  if (v720) return v720;
  // pick highest resolution available
  const sorted = [...variants].sort((a, b) => (b.width || 0) - (a.width || 0));
  return sorted[0];
}

// ─── Component ──────────────────────────────────────────────────

export default function VideoPlayer({
  material,
  courseId,
  moduleId,
  locale: localeProp,
  onComplete,
  nextMaterialTitle,
  onNextMaterial,
}: VideoPlayerProps) {
  const t = useTranslations("studentDashboard.learning");
  const detectedLocale = useLocale();
  const locale = localeProp || detectedLocale;
  const isRTL = locale === "ar";

  // ── Refs ────────────────────────────────────────────────────

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const centerPlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const volumeBarRef = useRef<HTMLDivElement>(null);

  // Watch event tracking refs
  const watchEventsBufferRef = useRef<{ eventType: string; position: number; fromPosition?: number }[]>([]);
  const watchEventsFlushRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── State ───────────────────────────────────────────────────

  // Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isWaiting, setIsWaiting] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);

  // Volume
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  // Speed
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Quality
  const [selectedVariant, setSelectedVariant] = useState<MaterialVariant | null>(
    () => pickDefaultVariant(material.variants)
  );
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  // Captions
  const [captionsOn, setCaptionsOn] = useState(locale === "ar");

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);

  // PiP
  const [isPiP, setIsPiP] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);

  // Controls visibility
  const [showControls, setShowControls] = useState(true);
  const [showCenterPlay, setShowCenterPlay] = useState(true);

  // NELC anti-skip
  const [furthestWatchedSecond, setFurthestWatchedSecond] = useState(
    () => material.progress?.furthestWatchedSecond || 0
  );

  // Progress tracking
  const [markedComplete, setMarkedComplete] = useState(false);

  // Transcript
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);

  // Auto-advance
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null);

  // Seek tooltip
  const [seekTooltip, setSeekTooltip] = useState<{ time: number; x: number } | null>(null);

  // ── Derived ─────────────────────────────────────────────────

  const videoSrc = useMemo(() => {
    if (selectedVariant) return selectedVariant.fileUrl;
    return material.fileUrl;
  }, [selectedVariant, material.fileUrl]);

  const currentQualityLabel = useMemo(() => {
    if (!selectedVariant) return "Auto";
    return selectedVariant.resolution || "Auto";
  }, [selectedVariant]);

  // ── Control bar auto-hide ───────────────────────────────────

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlTimeoutRef.current) clearTimeout(controlTimeoutRef.current);
    controlTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
      }
    }, 3000);
  }, []);

  // ── PiP support check ──────────────────────────────────────

  useEffect(() => {
    setPipSupported(
      typeof document !== "undefined" && !!document.pictureInPictureEnabled
    );
  }, []);

  // ── Resume playback on mount ────────────────────────────────

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const watchedSeconds = material.progress?.watchedSeconds || 0;
    if (watchedSeconds > 0) {
      const handleCanPlay = () => {
        if (video.currentTime < 1 && watchedSeconds > 0) {
          video.currentTime = watchedSeconds;
          toast.info(t("resumeFrom", { time: formatTime(watchedSeconds) }));
        }
        video.removeEventListener("canplay", handleCanPlay);
      };
      video.addEventListener("canplay", handleCanPlay);
      return () => video.removeEventListener("canplay", handleCanPlay);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material.id]);

  // ── Auto-enable captions for Arabic locale ──────────────────

  useEffect(() => {
    if (locale !== "ar") return;
    const video = videoRef.current;
    if (!video) return;

    const enableCaptions = () => {
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = "showing";
      }
      setCaptionsOn(true);
    };

    if (video.textTracks.length > 0) {
      enableCaptions();
    } else {
      video.addEventListener("loadedmetadata", enableCaptions, { once: true });
      return () => video.removeEventListener("loadedmetadata", enableCaptions);
    }
  }, [locale, material.id]);

  // ── Progress auto-save (every 10s) ─────────────────────────

  useEffect(() => {
    if (!courseId || !moduleId) return;

    progressSaveRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.duration === 0) return;

      studentApi
        .updateProgress(courseId, {
          moduleId,
          materialId: material.id,
          watchedSeconds: Math.floor(video.currentTime),
          totalSeconds: Math.floor(video.duration),
        })
        .catch(() => {});
    }, 10000);

    return () => {
      if (progressSaveRef.current) clearInterval(progressSaveRef.current);
    };
  }, [courseId, moduleId, material.id]);

  // ── Watch event tracking (heartbeat + flush every 10s) ────────

  const flushWatchEvents = useCallback(() => {
    const events = watchEventsBufferRef.current;
    if (events.length === 0) return;
    watchEventsBufferRef.current = [];
    studentApi.recordWatchEvents(material.id, events).catch(() => {});
  }, [material.id]);

  const pushWatchEvent = useCallback((eventType: string, position: number, fromPosition?: number) => {
    watchEventsBufferRef.current.push({
      eventType,
      position: Math.floor(position),
      ...(fromPosition !== undefined ? { fromPosition: Math.floor(fromPosition) } : {}),
    });
  }, []);

  useEffect(() => {
    // Heartbeat: push a heartbeat event every 10s while playing, then flush
    watchEventsFlushRef.current = setInterval(() => {
      const video = videoRef.current;
      if (video && !video.paused && video.duration > 0) {
        pushWatchEvent("heartbeat", video.currentTime);
      }
      flushWatchEvents();
    }, 10000);

    return () => {
      if (watchEventsFlushRef.current) clearInterval(watchEventsFlushRef.current);
      // Flush remaining events on unmount
      flushWatchEvents();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material.id]);

  // ── Fullscreen change listener ──────────────────────────────

  useEffect(() => {
    const handleFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFSChange);
    return () => document.removeEventListener("fullscreenchange", handleFSChange);
  }, []);

  // ── PiP change listeners ───────────────────────────────────

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnterPiP = () => setIsPiP(true);
    const onLeavePiP = () => setIsPiP(false);

    video.addEventListener("enterpictureinpicture", onEnterPiP);
    video.addEventListener("leavepictureinpicture", onLeavePiP);
    return () => {
      video.removeEventListener("enterpictureinpicture", onEnterPiP);
      video.removeEventListener("leavepictureinpicture", onLeavePiP);
    };
  }, []);

  // ── Cleanup auto-advance on unmount ─────────────────────────

  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) clearInterval(autoAdvanceTimerRef.current);
    };
  }, []);

  // ── Video event handlers ────────────────────────────────────

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    setHasEnded(false);
    setAutoAdvanceCountdown(null);
    if (autoAdvanceTimerRef.current) {
      clearInterval(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    showControlsTemporarily();
    const video = videoRef.current;
    if (video) pushWatchEvent("play", video.currentTime);
  }, [showControlsTemporarily, pushWatchEvent]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    setShowControls(true);
    if (controlTimeoutRef.current) clearTimeout(controlTimeoutRef.current);
    const video = videoRef.current;
    if (video) pushWatchEvent("pause", video.currentTime);
  }, [pushWatchEvent]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setDuration(video.duration);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    setCurrentTime(video.currentTime);

    // Update furthest watched
    setFurthestWatchedSecond((prev) => Math.max(prev, video.currentTime));

    // Update buffered
    if (video.buffered.length > 0) {
      setBuffered(video.buffered.end(video.buffered.length - 1));
    }

    // 90% completion
    if (
      !markedComplete &&
      video.duration > 0 &&
      video.currentTime / video.duration >= 0.9
    ) {
      setMarkedComplete(true);
      onComplete?.();
      if (courseId && moduleId) {
        studentApi
          .updateProgress(courseId, {
            moduleId,
            materialId: material.id,
            watchedSeconds: Math.floor(video.currentTime),
            totalSeconds: Math.floor(video.duration),
            status: "completed",
          })
          .catch(() => {});
      }
    }
  }, [markedComplete, onComplete, courseId, moduleId, material.id]);

  const handleSeeking = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const seekTarget = video.currentTime;
    if (seekTarget > furthestWatchedSecond + 2) {
      video.currentTime = furthestWatchedSecond;
      toast.warning(t("skipPrevented"));
    }
    pushWatchEvent("seek", video.currentTime, seekTarget);
  }, [furthestWatchedSecond, t, pushWatchEvent]);

  const handleWaiting = useCallback(() => {
    setIsWaiting(true);
    const video = videoRef.current;
    if (video) pushWatchEvent("buffer", video.currentTime);
  }, [pushWatchEvent]);
  const handleCanPlay = useCallback(() => setIsWaiting(false), []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setHasEnded(true);
    setShowControls(true);

    // Record complete event
    const videoEl = videoRef.current;
    if (videoEl) pushWatchEvent("complete", videoEl.duration);

    // Save final progress
    const video = videoRef.current;
    if (video && courseId && moduleId) {
      studentApi
        .updateProgress(courseId, {
          moduleId,
          materialId: material.id,
          watchedSeconds: Math.floor(video.duration),
          totalSeconds: Math.floor(video.duration),
          status: "completed",
        })
        .catch(() => {});
    }

    // Start auto-advance countdown
    if (nextMaterialTitle && onNextMaterial) {
      setAutoAdvanceCountdown(5);
      autoAdvanceTimerRef.current = setInterval(() => {
        setAutoAdvanceCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (autoAdvanceTimerRef.current) {
              clearInterval(autoAdvanceTimerRef.current);
              autoAdvanceTimerRef.current = null;
            }
            onNextMaterial();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [courseId, moduleId, material.id, nextMaterialTitle, onNextMaterial, pushWatchEvent]);

  // ── Player control actions ──────────────────────────────────

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }

    // Show center play icon briefly
    setShowCenterPlay(true);
    if (centerPlayTimeoutRef.current) clearTimeout(centerPlayTimeoutRef.current);
    centerPlayTimeoutRef.current = setTimeout(() => {
      setShowCenterPlay(false);
    }, 800);
  }, []);

  const handleSeekBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const video = videoRef.current;
      const bar = seekBarRef.current;
      if (!video || !bar) return;

      const rect = bar.getBoundingClientRect();
      let fraction: number;
      if (isRTL) {
        fraction = (rect.right - e.clientX) / rect.width;
      } else {
        fraction = (e.clientX - rect.left) / rect.width;
      }
      fraction = Math.max(0, Math.min(1, fraction));
      let seekTo = fraction * video.duration;

      // NELC anti-skip: clamp to furthest watched
      seekTo = Math.min(seekTo, furthestWatchedSecond);
      video.currentTime = seekTo;
    },
    [isRTL, furthestWatchedSecond]
  );

  const handleSeekBarHover = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = seekBarRef.current;
      const video = videoRef.current;
      if (!bar || !video) return;

      const rect = bar.getBoundingClientRect();
      let fraction: number;
      if (isRTL) {
        fraction = (rect.right - e.clientX) / rect.width;
      } else {
        fraction = (e.clientX - rect.left) / rect.width;
      }
      fraction = Math.max(0, Math.min(1, fraction));
      const time = fraction * video.duration;
      setSeekTooltip({
        time,
        x: e.clientX - rect.left,
      });
    },
    [isRTL]
  );

  const handleSeekBarLeave = useCallback(() => {
    setSeekTooltip(null);
  }, []);

  const handleVolumeChange = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = volumeBarRef.current;
      const video = videoRef.current;
      if (!bar || !video) return;

      const rect = bar.getBoundingClientRect();
      let fraction = (e.clientX - rect.left) / rect.width;
      fraction = Math.max(0, Math.min(1, fraction));
      video.volume = fraction;
      setVolume(fraction);
      setIsMuted(fraction === 0);
      video.muted = fraction === 0;
    },
    []
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      video.muted = false;
      video.volume = volume > 0 ? volume : 0.5;
      setIsMuted(false);
      if (volume === 0) setVolume(0.5);
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const selectSpeed = useCallback((s: number) => {
    setSpeed(s);
    if (videoRef.current) videoRef.current.playbackRate = s;
    setShowSpeedMenu(false);
  }, []);

  const toggleCaptions = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const newState = !captionsOn;
    for (let i = 0; i < video.textTracks.length; i++) {
      video.textTracks[i].mode = newState ? "showing" : "hidden";
    }
    setCaptionsOn(newState);
  }, [captionsOn]);

  const switchQuality = useCallback(
    (variant: MaterialVariant | null) => {
      const video = videoRef.current;
      if (!video) return;

      const savedTime = video.currentTime;
      const wasPlaying = !video.paused;

      setSelectedVariant(variant);
      setShowQualityMenu(false);

      // After source changes, we need to restore position
      // Use a small timeout to let React re-render with new source
      setTimeout(() => {
        const v = videoRef.current;
        if (!v) return;

        const restorePosition = () => {
          v.currentTime = savedTime;
          if (wasPlaying) v.play().catch(() => {});
          v.removeEventListener("loadedmetadata", restorePosition);
        };
        v.addEventListener("loadedmetadata", restorePosition);
        v.load();
      }, 0);
    },
    []
  );

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen not supported or failed
    }
  }, []);

  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      // PiP not supported or failed
    }
  }, []);

  const cancelAutoAdvance = useCallback(() => {
    setAutoAdvanceCountdown(null);
    if (autoAdvanceTimerRef.current) {
      clearInterval(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;

      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case " ": {
          e.preventDefault();
          togglePlayPause();
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          showControlsTemporarily();
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          const newTime = Math.min(video.duration, video.currentTime + 10);
          // NELC anti-skip
          video.currentTime = Math.min(newTime, furthestWatchedSecond);
          showControlsTemporarily();
          break;
        }
        case "c":
        case "C": {
          e.preventDefault();
          toggleCaptions();
          break;
        }
        case "f":
        case "F": {
          e.preventDefault();
          toggleFullscreen();
          break;
        }
        case "m":
        case "M": {
          e.preventDefault();
          toggleMute();
          break;
        }
      }
    },
    [
      togglePlayPause,
      showControlsTemporarily,
      furthestWatchedSecond,
      toggleCaptions,
      toggleFullscreen,
      toggleMute,
    ]
  );

  // ── Transcript ──────────────────────────────────────────────

  const handleToggleTranscript = useCallback(async () => {
    if (showTranscript) {
      setShowTranscript(false);
      return;
    }
    if (transcript !== null) {
      setShowTranscript(true);
      return;
    }
    if (!material.transcriptUrl) return;

    setLoadingTranscript(true);
    try {
      const res = await fetch(material.transcriptUrl);
      const text = await res.text();
      setTranscript(text);
      setShowTranscript(true);
    } catch {
      setTranscript("Failed to load transcript.");
      setShowTranscript(true);
    } finally {
      setLoadingTranscript(false);
    }
  }, [showTranscript, transcript, material.transcriptUrl]);

  // ── Close menus on outside click ────────────────────────────

  useEffect(() => {
    const handleClick = () => {
      setShowQualityMenu(false);
      setShowSpeedMenu(false);
    };
    // Delayed so the click that opens the menu doesn't immediately close it
    if (showQualityMenu || showSpeedMenu) {
      const timer = setTimeout(() => {
        document.addEventListener("click", handleClick, { once: true });
      }, 0);
      return () => {
        clearTimeout(timer);
        document.removeEventListener("click", handleClick);
      };
    }
  }, [showQualityMenu, showSpeedMenu]);

  // ── Computed progress values ────────────────────────────────

  const playedPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0;
  const furthestPercent = duration > 0 ? (furthestWatchedSecond / duration) * 100 : 0;

  // ── Render ──────────────────────────────────────────────────

  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
      {/* Video Container */}
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseMove={showControlsTemporarily}
        onMouseLeave={() => {
          if (isPlaying) setShowControls(false);
          setShowVolumeSlider(false);
        }}
        className={`relative w-full rounded-xl bg-black overflow-hidden outline-none group ${
          isFullscreen ? "rounded-none" : ""
        }`}
        style={{ aspectRatio: isFullscreen ? undefined : "16/9" }}
      >
        {/* Video Element */}
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          preload="metadata"
          playsInline
          crossOrigin="anonymous"
          onClick={togglePlayPause}
          onPlay={handlePlay}
          onPause={handlePause}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onSeeking={handleSeeking}
          onWaiting={handleWaiting}
          onCanPlay={handleCanPlay}
          onEnded={handleEnded}
        >
          {videoSrc && (
            <source
              src={videoSrc}
              type={selectedVariant?.mimeType || material.mimeType || "video/mp4"}
            />
          )}
          {material.captionsUrl && (
            <track
              kind="captions"
              src={material.captionsUrl}
              srcLang="en"
              label="Captions"
              default
            />
          )}
        </video>

        {/* Loading Spinner */}
        {isWaiting && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <Loader2 className="w-12 h-12 text-white animate-spin" />
          </div>
        )}

        {/* Center Play/Pause Indicator */}
        {showCenterPlay && !isWaiting && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div
              className={`w-16 h-16 rounded-full bg-black/50 flex items-center justify-center transition-opacity duration-300 ${
                isPlaying && !showControls ? "opacity-0" : "opacity-100"
              }`}
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 text-white" />
              ) : (
                <Play className="w-8 h-8 text-white ms-1" />
              )}
            </div>
          </div>
        )}

        {/* Initial Big Play Button (before first play) */}
        {!isPlaying && currentTime === 0 && !hasEnded && !isWaiting && (
          <div
            className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer"
            onClick={togglePlayPause}
          >
            <div className="w-20 h-20 rounded-full bg-[#D4A520]/90 flex items-center justify-center hover:bg-[#D4A520] transition-colors shadow-lg">
              <Play className="w-10 h-10 text-white ms-1" />
            </div>
          </div>
        )}

        {/* Auto-Advance Overlay */}
        {autoAdvanceCountdown !== null && nextMaterialTitle && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-30">
            <SkipForward className="w-10 h-10 text-[#D4A520] mb-3" />
            <p className="text-white text-lg font-semibold mb-4 text-center px-4 max-w-md">
              {t("nextUp", { title: nextMaterialTitle })}
            </p>
            <p className="text-white/60 text-sm mb-4">
              {t("autoAdvanceIn", { seconds: String(autoAdvanceCountdown) })}
            </p>
            <button
              onClick={cancelAutoAdvance}
              className="px-5 py-2 border border-white/40 text-white rounded-lg hover:bg-[var(--color-surface-card)]/10 transition-colors text-sm"
            >
              {t("cancel")}
            </button>
          </div>
        )}

        {/* Bottom Control Bar */}
        <div
          className={`absolute bottom-0 inset-x-0 z-20 transition-opacity duration-300 ${
            showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* Gradient Backdrop */}
          <div className="bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-12 pb-2 px-3 sm:px-4">
            {/* Seek Bar */}
            <div
              ref={seekBarRef}
              className="relative w-full h-1.5 bg-[var(--color-surface-card)]/20 rounded-full cursor-pointer group/seek mb-3 hover:h-2.5 transition-all"
              onClick={handleSeekBarClick}
              onMouseMove={handleSeekBarHover}
              onMouseLeave={handleSeekBarLeave}
              role="slider"
              aria-valuenow={Math.round(playedPercent)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("seekBar")}
              tabIndex={0}
            >
              {/* Buffered */}
              <div
                className="absolute top-0 h-full bg-[var(--color-surface-card)]/30 rounded-full"
                style={{
                  [isRTL ? "right" : "left"]: 0,
                  width: `${bufferedPercent}%`,
                }}
              />

              {/* Furthest Watched Marker (NELC) */}
              <div
                className="absolute top-0 h-full bg-[var(--color-surface-card)]/15 rounded-full"
                style={{
                  [isRTL ? "right" : "left"]: 0,
                  width: `${furthestPercent}%`,
                }}
              />

              {/* Dim area beyond furthest watched */}
              {furthestPercent < 100 && (
                <div
                  className="absolute top-0 h-full bg-black/40 rounded-full"
                  style={{
                    [isRTL ? "right" : "left"]: `${furthestPercent}%`,
                    width: `${100 - furthestPercent}%`,
                  }}
                />
              )}

              {/* Played Progress */}
              <div
                className="absolute top-0 h-full bg-[#D4A520] rounded-full"
                style={{
                  [isRTL ? "right" : "left"]: 0,
                  width: `${playedPercent}%`,
                }}
              />

              {/* Furthest Watched Marker Dot */}
              {furthestPercent > 0 && furthestPercent < 100 && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-[var(--color-surface-card)]/70 rounded-full"
                  style={{
                    [isRTL ? "right" : "left"]: `${furthestPercent}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              )}

              {/* Playhead Dot */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-[#D4A520] rounded-full shadow opacity-0 group-hover/seek:opacity-100 transition-opacity"
                style={{
                  [isRTL ? "right" : "left"]: `${playedPercent}%`,
                  transform: "translate(-50%, -50%)",
                }}
              />

              {/* Seek Tooltip */}
              {seekTooltip && (
                <div
                  className="absolute -top-8 px-2 py-0.5 bg-black/90 text-white text-xs rounded whitespace-nowrap pointer-events-none"
                  style={{
                    left: `${seekTooltip.x}px`,
                    transform: "translateX(-50%)",
                  }}
                >
                  {formatTime(seekTooltip.time)}
                </div>
              )}
            </div>

            {/* Controls Row */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Play/Pause */}
              <button
                onClick={togglePlayPause}
                className="p-1.5 text-white hover:text-[#D4A520] transition-colors"
                aria-label={isPlaying ? t("pauseButton") : t("playButton")}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
              </button>

              {/* Time Display */}
              <span className="text-white text-xs sm:text-sm font-mono whitespace-nowrap px-1">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Volume */}
              <div
                className="relative flex items-center"
                onMouseEnter={() => setShowVolumeSlider(true)}
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                <button
                  onClick={toggleMute}
                  className="p-1.5 text-white hover:text-[#D4A520] transition-colors"
                  aria-label={isMuted ? t("unmuteButton") : t("muteButton")}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>

                {/* Volume Slider */}
                <div
                  className={`flex items-center overflow-hidden transition-all duration-200 ${
                    showVolumeSlider ? "w-20 opacity-100 ms-1" : "w-0 opacity-0"
                  }`}
                >
                  <div
                    ref={volumeBarRef}
                    className="relative w-full h-1 bg-[var(--color-surface-card)]/30 rounded-full cursor-pointer"
                    onClick={handleVolumeChange}
                    role="slider"
                    aria-valuenow={Math.round((isMuted ? 0 : volume) * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={t("volumeSlider")}
                    tabIndex={0}
                  >
                    <div
                      className="absolute top-0 h-full bg-[var(--color-surface-card)] rounded-full"
                      style={{
                        [isRTL ? "right" : "left"]: 0,
                        width: `${(isMuted ? 0 : volume) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Speed Selector */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSpeedMenu(!showSpeedMenu);
                    setShowQualityMenu(false);
                  }}
                  className="px-2 py-1 text-white text-xs font-medium hover:text-[#D4A520] transition-colors rounded"
                  aria-label={t("speedButton")}
                  aria-haspopup="true"
                  aria-expanded={showSpeedMenu}
                >
                  {speed}x
                </button>

                {showSpeedMenu && (
                  <div
                    className={`absolute bottom-full mb-2 ${
                      isRTL ? "left-0" : "right-0"
                    } bg-black/95 rounded-lg border border-white/10 py-1 min-w-[100px] z-50`}
                    onClick={(e) => e.stopPropagation()}
                    role="menu"
                  >
                    {PLAYBACK_SPEEDS.map((s) => (
                      <button
                        key={s}
                        onClick={() => selectSpeed(s)}
                        role="menuitem"
                        className={`w-full text-start px-3 py-1.5 text-sm transition-colors ${
                          s === speed
                            ? "text-[#D4A520] bg-[var(--color-surface-card)]/10"
                            : "text-white hover:bg-[var(--color-surface-card)]/10"
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Captions Toggle */}
              {material.captionsUrl && (
                <button
                  onClick={toggleCaptions}
                  className={`p-1.5 transition-colors rounded ${
                    captionsOn
                      ? "text-[var(--color-primary)] bg-[var(--color-surface-card)]/90"
                      : "text-white hover:text-[#D4A520]"
                  }`}
                  aria-label={captionsOn ? t("captionsOn") : t("captionsOff")}
                >
                  <Subtitles className="w-5 h-5" />
                </button>
              )}

              {/* Quality Selector */}
              {material.variants.length > 0 && (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowQualityMenu(!showQualityMenu);
                      setShowSpeedMenu(false);
                    }}
                    className="p-1.5 text-white hover:text-[#D4A520] transition-colors flex items-center gap-1"
                    aria-label={t("qualityButton")}
                    aria-haspopup="true"
                    aria-expanded={showQualityMenu}
                  >
                    <Settings className="w-5 h-5" />
                    <span className="text-[10px] hidden sm:inline">
                      {currentQualityLabel}
                    </span>
                  </button>

                  {showQualityMenu && (
                    <div
                      className={`absolute bottom-full mb-2 ${
                        isRTL ? "left-0" : "right-0"
                      } bg-black/95 rounded-lg border border-white/10 py-1 min-w-[140px] z-50`}
                      onClick={(e) => e.stopPropagation()}
                      role="menu"
                    >
                      {[...material.variants]
                        .sort((a, b) => (b.width || 0) - (a.width || 0))
                        .map((variant) => (
                          <button
                            key={variant.id}
                            onClick={() => switchQuality(variant)}
                            role="menuitem"
                            className={`w-full text-start px-3 py-1.5 text-sm transition-colors ${
                              selectedVariant?.id === variant.id
                                ? "text-[#D4A520] bg-[var(--color-surface-card)]/10"
                                : "text-white hover:bg-[var(--color-surface-card)]/10"
                            }`}
                          >
                            {getResolutionLabel(variant.resolution)}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* PiP Button */}
              {pipSupported && (
                <button
                  onClick={togglePiP}
                  className={`p-1.5 transition-colors ${
                    isPiP
                      ? "text-[#D4A520]"
                      : "text-white hover:text-[#D4A520]"
                  }`}
                  aria-label={t("pipButton")}
                >
                  <PictureInPicture2 className="w-5 h-5" />
                </button>
              )}

              {/* Fullscreen Button */}
              <button
                onClick={toggleFullscreen}
                className="p-1.5 text-white hover:text-[#D4A520] transition-colors"
                aria-label={isFullscreen ? t("exitFullscreenButton") : t("fullscreenButton")}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-5 h-5" />
                ) : (
                  <Maximize2 className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <p className="text-[10px] text-[var(--color-text-secondary)] mt-2 text-end">
        {t("keyboardShortcuts")}
      </p>

      {/* Transcript Section */}
      {material.transcriptUrl && (
        <div className="mt-3">
          <button
            onClick={handleToggleTranscript}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-primary)] hover:underline"
            aria-label={t("transcriptToggle")}
          >
            {loadingTranscript ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : showTranscript ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            {showTranscript ? t("hideTranscript") : t("showTranscript")}
          </button>

          {showTranscript && transcript && (
            <div className="mt-2 p-4 bg-[var(--color-surface-page)] rounded-lg border border-[var(--color-border)] max-h-[300px] overflow-y-auto">
              <pre className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap font-sans">
                {transcript}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
