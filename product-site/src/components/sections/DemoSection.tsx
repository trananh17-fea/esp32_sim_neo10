import type { FC } from "react";
import { ExternalLink, MapPinned, MonitorSmartphone, PlayCircle, Radar, Video } from "lucide-react";
import { useI18n } from "@/i18n/context";
import { trackCTA } from "@/services/analytics/webAnalytics";
import { DEMO_VIDEO_EMBED_URL, TRACKING_WEB_URL } from "@/config/env";

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
  const trackingUrl = TRACKING_WEB_URL;
  const videoUrl = resolvePublicUrl(DEMO_VIDEO_EMBED_URL.trim());
  const isVideoFile = /\.(mp4|webm|ogg)([?#].*)?$/i.test(videoUrl);

  return (
    <section id="demo" className="scroll-mt-24 py-12 sm:py-16">
      <div className="container">
        <div className="mb-6 max-w-3xl sm:mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-[#2B211B] sm:text-3xl">{t.demo.heading}</h2>
          <p className="mt-3 text-sm leading-relaxed text-[#6E5A4A] sm:text-base">{t.demo.desc}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr] lg:gap-5">
          <article className="rounded-[1.6rem] border border-[#E7DED2] bg-white p-4 shadow-[0_26px_65px_-52px_rgba(74,52,38,0.64)] sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[#2B211B] sm:text-lg">{t.demo.videoTitle}</h3>
                <p className="mt-1 text-xs leading-relaxed text-[#6E5A4A] sm:text-sm">{t.demo.videoDesc}</p>
              </div>
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E7DED2] bg-[#F7F3EE] text-[#6B4F3A]">
                <Video className="h-5 w-5" />
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#E7DED2] bg-[#F7F3EE]">
              <div className="flex h-10 items-center justify-between border-b border-[#E7DED2] px-3 text-[11px] font-medium text-[#6E5A4A]">
                <span>Video hướng dẫn</span>
                <span>BA.SEW</span>
              </div>

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
                  <div className="relative flex h-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#EEE2D4] via-[#F8F2EA] to-[#F1E5D9] p-6 text-center">
                    <div className="relative">
                      <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#6B4F3A] shadow">
                        <PlayCircle className="h-6 w-6" />
                      </span>
                      <h4 className="text-sm font-semibold text-[#2B211B]">{t.demo.videoPlaceholderTitle}</h4>
                      <p className="mt-1 max-w-xs text-xs leading-relaxed text-[#6E5A4A]">{t.demo.videoPlaceholderDesc}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {videoUrl ? (
              <a
                href={videoUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackCTA("guide_video", "demo_section")}
                className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-[#D8CCBD] bg-white px-4 text-sm font-semibold text-[#4A3426] transition-colors hover:bg-[#F7F3EE]"
              >
                {t.demo.videoCta}
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </article>

          <article className="rounded-[1.6rem] border border-[#E7DED2] bg-white p-5 shadow-[0_26px_65px_-52px_rgba(74,52,38,0.64)] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6B4F3A]">BA.SEW Tracking</p>
                <h3 className="mt-2 text-xl font-bold tracking-tight text-[#2B211B]">{t.demo.trackingTitle}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#6E5A4A]">{t.demo.trackingDesc}</p>
              </div>
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#E7DED2] bg-[#F7F3EE] text-[#6B4F3A]">
                <MonitorSmartphone className="h-5 w-5" />
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {trackingHighlights.map((item, index) => {
                const Icon = index % 2 === 0 ? MapPinned : Radar;
                return (
                  <div key={item} className="flex items-start gap-2.5 rounded-2xl border border-[#E7DED2] bg-[#F7F3EE] p-3 text-sm leading-relaxed text-[#4A3426]">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#6B4F3A]" />
                    <span>{item}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E7DED2] bg-[#FFFDFC] p-4">
              <p className="text-sm font-medium text-[#6E5A4A]">
                Demo tracking mở ở trang riêng để bản đồ đủ rộng và dễ thao tác.
              </p>
              <a
                href={trackingUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackCTA("tracking_demo", "demo_section")}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#6B4F3A] px-4 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#4A3426]"
              >
                {t.demo.trackingCta}
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
};

export default DemoSection;
