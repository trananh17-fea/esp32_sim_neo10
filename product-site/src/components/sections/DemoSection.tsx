import type { FC } from "react";
import { ExternalLink, MapPinned, MonitorSmartphone, PlayCircle, Radar, Video } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { trackCTA } from "@/services/analytics/webAnalytics";
import { DEMO_VIDEO_EMBED_URL, TRACKING_WEB_URL } from "@/config/env";
import { useInView } from "@/hooks/useInView";

const trackingHighlights: string[] = [
  "Bản đồ trực tiếp, dễ xem trên điện thoại và desktop",
  "Lịch sử di chuyển theo khoảng thời gian",
  "Thiết lập HOME và vùng an toàn",
  "Chạy độc lập trên GitHub Pages",
];

function resolvePublicUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^(https?:)?\/\//i.test(trimmed)) return trimmed;

  const baseUrl = "/";
  const publicPath = trimmed.replace(/^\/?public\//, "").replace(/^\.?\//, "");
  const basePath = baseUrl.replace(/^\/+|\/+$/g, "");

  if (basePath && publicPath.startsWith(`${basePath}/`)) {
    return `/${publicPath}`;
  }

  return `${baseUrl}${publicPath}`;
}

const DemoSection: FC = () => {
  const { t } = useI18n();
  const [cardRef, cardVisible] = useInView<HTMLElement>();
  const trackingUrl = TRACKING_WEB_URL;
  const videoUrl = resolvePublicUrl(DEMO_VIDEO_EMBED_URL.trim());
  const isVideoFile = /\.(mp4|webm|ogg)([?#].*)?$/i.test(videoUrl);

  return (
    <section id="demo" className="scroll-mt-12">
      {/* Demo - 1 card trắng chung */}
      <div className="bg-[#f5f5f7] py-16 sm:py-20">
        <div className="container">
          <article
            ref={cardRef}
            className={`overflow-hidden rounded-3xl bg-white reveal reveal-scale${cardVisible ? " is-visible" : ""}`}
          >
            {/* Header */}
            <div className="border-b border-[#f5f5f7] p-6 text-center sm:p-10">
              <p className="text-sm font-semibold uppercase tracking-widest text-[#8B5E3C]">Demo</p>
              <h2 className="mt-3 text-section-title text-[#1d1d1f]">{t.demo.heading}</h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[#4a4a4f]">
                {t.demo.desc}
              </p>
            </div>

            {/* 2 cột: Video (trái) + Tracking (phải) */}
            <div className="grid lg:grid-cols-2">
              {/* Video - bên trái */}
              <div className="border-b border-[#f5f5f7] p-6 sm:p-8 lg:border-b-0 lg:border-r">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <h3 className="text-card-title text-[#1d1d1f]">{t.demo.videoTitle}</h3>
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FDF6F0] text-[#8B5E3C]">
                    <Video className="h-5 w-5" />
                  </span>
                </div>

                <div className="overflow-hidden rounded-2xl bg-[#f5f5f7]">
                  <div className="aspect-video">
                    {videoUrl && isVideoFile ? (
                      <video
                        src={videoUrl}
                        className="h-full w-full bg-black object-contain"
                        controls
                        preload="metadata"
                      />
                    ) : videoUrl ? (
                      <iframe
                        title="BA.SEW guide video"
                        src={videoUrl}
                        className="h-full w-full border-0"
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <div className="relative flex h-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#FDF6F0] to-[#f5f5f7] p-6 text-center">
                        <div className="relative">
                          <span className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#8B5E3C] shadow-sm">
                            <PlayCircle className="h-7 w-7" />
                          </span>
                          <h4 className="text-sm font-semibold text-[#1d1d1f]">{t.demo.videoPlaceholderTitle}</h4>
                          <p className="mt-1 max-w-xs text-xs leading-relaxed text-[#6e6e73]">
                            {t.demo.videoPlaceholderDesc}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {videoUrl ? (
                  <div className="mt-4">
                    <a
                      href={videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => trackCTA("guide_video", "demo_section")}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-[#8B5E3C] transition-colors hover:underline"
                    >
                      {t.demo.videoCta}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ) : null}
              </div>

              {/* Tracking - bên phải */}
              <div className="p-6 sm:p-8">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#8B5E3C]">
                      BA.SEW Tracking
                    </p>
                    <h3 className="mt-2 text-card-title text-[#1d1d1f]">{t.demo.trackingTitle}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#4a4a4f]">{t.demo.trackingDesc}</p>
                  </div>
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FDF6F0] text-[#8B5E3C]">
                    <MonitorSmartphone className="h-5 w-5" />
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {trackingHighlights.map((item, index) => {
                    const Icon = index % 2 === 0 ? MapPinned : Radar;
                    return (
                      <div
                        key={item}
                        className="flex items-start gap-2.5 rounded-xl bg-[#f5f5f7] p-4 text-sm leading-relaxed text-[#1d1d1f]"
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#8B5E3C]" />
                        <span>{item}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#f5f5f7] p-5">
                  <p className="text-sm text-[#4a4a4f]">
                    Demo tracking mở ở trang riêng để bản đồ đủ rộng và dễ thao tác.
                  </p>
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackCTA("tracking_demo", "demo_section")}
                    className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-[#8B5E3C] px-5 text-sm font-medium text-white transition-all hover:bg-[#6F4A2F] active:scale-[0.97]"
                  >
                    {t.demo.trackingCta}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
};

export default DemoSection;
