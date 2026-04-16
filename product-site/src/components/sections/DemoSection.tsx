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
    <section id="demo" className="scroll-mt-12">
      {/* Heading */}
      <div className="bg-white py-20 text-center sm:py-28">
        <div className="container">
          <h2 className="text-section-title text-[#1d1d1f]">{t.demo.heading}</h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[#86868b]">
            {t.demo.desc}
          </p>
        </div>
      </div>

      {/* Video + Tracking cards */}
      <div className="bg-[#f5f5f7] py-16 sm:py-20">
        <div className="container">
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Video card */}
            <article className="overflow-hidden rounded-3xl bg-white">
              <div className="p-6 sm:p-8">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-card-title text-[#1d1d1f]">{t.demo.videoTitle}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#86868b]">{t.demo.videoDesc}</p>
                  </div>
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f5f5f7] text-[#1d1d1f]">
                    <Video className="h-5 w-5" />
                  </span>
                </div>
              </div>

              <div className="bg-[#f5f5f7]">
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
                    <div className="relative flex h-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#e8e8ed] to-[#f5f5f7] p-6 text-center">
                      <div className="relative">
                        <span className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#1d1d1f] shadow-sm">
                          <PlayCircle className="h-7 w-7" />
                        </span>
                        <h4 className="text-sm font-semibold text-[#1d1d1f]">{t.demo.videoPlaceholderTitle}</h4>
                        <p className="mt-1 max-w-xs text-xs leading-relaxed text-[#86868b]">
                          {t.demo.videoPlaceholderDesc}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {videoUrl ? (
                <div className="px-6 py-4 sm:px-8">
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackCTA("guide_video", "demo_section")}
                    className="inline-flex items-center gap-1.5 text-sm font-normal text-[#0071e3] transition-colors hover:underline"
                  >
                    {t.demo.videoCta}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ) : null}
            </article>

            {/* Tracking card */}
            <article className="overflow-hidden rounded-3xl bg-white">
              <div className="p-6 sm:p-8">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-[#0071e3]">
                      BA.SEW Tracking
                    </p>
                    <h3 className="mt-2 text-card-title text-[#1d1d1f]">{t.demo.trackingTitle}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#86868b]">{t.demo.trackingDesc}</p>
                  </div>
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f5f5f7] text-[#1d1d1f]">
                    <MonitorSmartphone className="h-5 w-5" />
                  </span>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {trackingHighlights.map((item, index) => {
                    const Icon = index % 2 === 0 ? MapPinned : Radar;
                    return (
                      <div
                        key={item}
                        className="flex items-start gap-2.5 rounded-xl bg-[#f5f5f7] p-4 text-sm leading-relaxed text-[#1d1d1f]"
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#86868b]" />
                        <span>{item}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#f5f5f7] p-5">
                  <p className="text-sm text-[#86868b]">
                    Demo tracking mở ở trang riêng để bản đồ đủ rộng và dễ thao tác.
                  </p>
                  <a
                    href={trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackCTA("tracking_demo", "demo_section")}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-[#0071e3] px-5 text-sm font-normal text-white transition-all hover:bg-[#0077ED]"
                  >
                    {t.demo.trackingCta}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DemoSection;
