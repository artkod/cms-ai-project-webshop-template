import { createContext, useContext, useEffect, useState, type CSSProperties } from "react";
import { useParams, useSearchParams, Link } from "react-router";
import { Loader, Box } from "@mantine/core";
import { ChevronDown, X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { getPageBySlug, type Page, type Block, type LinkPagesMap } from "@/lib/api";
import { tiptapToHtml } from "@/lib/tiptapRenderer";
import { usePageAlternates, useLocaleConfig } from "@/lib/locale";
import { useDocumentSeo } from "@/lib/seo";
import { NotFound } from "./NotFound";
import "@/styles/pages/mixed.scss";

// ─── Render context (locale + linkPages, for nested renderers) ────────────────

interface RenderCtx {
  locale: string;
  linkPages: LinkPagesMap;
}

const RenderContext = createContext<RenderCtx>({ locale: "hr", linkPages: {} });

function useRender(): RenderCtx {
  return useContext(RenderContext);
}

// ─── Mixed content data shapes ────────────────────────────────────────────────

function getVideoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
    if (u.hostname.includes("youtube.com") && u.pathname.startsWith("/embed/")) {
      return url;
    }
    return url;
  } catch {
    return null;
  }
}

interface MixedContentWidget {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

interface MixedContentColumn {
  id: string;
  width: number;
  widgets: MixedContentWidget[];
}

interface MixedContentData {
  layout: number[];
  columns: MixedContentColumn[];
}

interface GalleryImage {
  mediaId: string;
  cdnUrl: string;
  name?: string;
}

interface AccordionItem {
  id: string;
  title: string;
  content: Record<string, unknown> | null;
}

// ─── Link widget (text link / semantic button) ──────────────────────────────

function LinkRenderer({ data }: { data: Record<string, unknown> }) {
  const { locale, linkPages } = useRender();
  const linkType = data.linkType as string;
  if (!linkType) return null;

  const displayText = (data.linkText as string) || undefined;
  const tooltip = (data.tooltip as string) || undefined;
  const asButton = Boolean(data.asButton);
  const openInNewTab = Boolean(data.openInNewTab);

  let href = "#";
  let isInternal = false;
  const rel = openInNewTab ? "noopener noreferrer" : undefined;
  const target = openInNewTab ? "_blank" : undefined;

  if (linkType === "page") {
    const pageId = (data.pageId as string) || "";
    const resolved = pageId ? linkPages[pageId]?.[locale] : null;
    const linkPath = resolved?.path && resolved.path.length ? resolved.path.join("/") : resolved?.slug;
    href = resolved?.active && linkPath ? `/${locale}/${linkPath}` : `/${locale}/`;
    isInternal = true;
  } else if (linkType === "remote") {
    href = (data.url as string) || "#";
  } else if (linkType === "email") {
    const e = (data.email as string) || "";
    const s = (data.emailSubject as string) || "";
    href = `mailto:${e}${s ? `?subject=${encodeURIComponent(s)}` : ""}`;
  } else if (linkType === "file") {
    href = (data.fileUrl as string) || "#";
  }

  const label = displayText || href;

  if (asButton) {
    const sz = data.buttonSize as string;
    const size = sz === "sm" || sz === "lg" ? sz : "md";
    const bt = data.buttonType as string;
    const type = bt === "secondary" || bt === "tertiary" ? bt : "primary";
    const ps = data.buttonPosition as string;
    const pos = ps === "center" || ps === "right" ? ps : "left";
    const cls = `mxbtn mxbtn--${type} mxbtn--${size}`;
    return (
      <div className={`mx-btnwrap pos-${pos}`}>
        {isInternal ? (
          <Link to={href} className={cls} title={tooltip}>{label}</Link>
        ) : (
          <a href={href} className={cls} target={target} rel={rel} title={tooltip}>{label}</a>
        )}
      </div>
    );
  }

  return (
    <div>
      {isInternal ? (
        <Link to={href} className="mx-textlink" title={tooltip}>{label}</Link>
      ) : (
        <a href={href} className="mx-textlink" target={target} rel={rel} title={tooltip}>{label}</a>
      )}
    </div>
  );
}

// ─── Widgets ──────────────────────────────────────────────────────────────────

function TextWidget({ data }: { data: Record<string, unknown> }) {
  const html = data.json ? tiptapToHtml(data.json) : "";
  if (html) return <div className="mx-richtext" dangerouslySetInnerHTML={{ __html: html }} />;
  const content = (data.content as string) || "";
  return content ? <div className="mx-richtext"><p>{content}</p></div> : null;
}

function VideoWidget({ data }: { data: Record<string, unknown> }) {
  const embedUrl = getVideoEmbedUrl((data.url as string) || "");
  if (!embedUrl) return null;
  const maxW = data.width ? Number(data.width) : undefined;
  return (
    <div className="mx-video" style={maxW ? { maxWidth: maxW } : undefined}>
      <div className="mx-video__frame">
        <iframe
          src={embedUrl}
          title="Video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}

function AccordionWidget({ data }: { data: Record<string, unknown> }) {
  const items = (data.items as AccordionItem[]) ?? [];
  const title = (data.title as string) || "";
  const [open, setOpen] = useState<Set<string>>(new Set());
  if (!items.length) return null;
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  return (
    <div>
      {title && <div className="mx-acc__title">{title}</div>}
      <div className="mx-acc">
        {items.map((item) => {
          const isOpen = open.has(item.id);
          return (
            <div key={item.id} className={`mx-acc__item${isOpen ? " is-open" : ""}`}>
              <button type="button" className="mx-acc__h" aria-expanded={isOpen} onClick={() => toggle(item.id)}>
                {item.title}
                <ChevronDown className="mx-acc__chev" aria-hidden="true" />
              </button>
              <div className="mx-acc__p">
                <div className="mx-acc__pin">
                  <div className="mx-acc__body">
                    {item.content && (
                      <div className="mx-richtext" dangerouslySetInnerHTML={{ __html: tiptapToHtml(item.content) }} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GalleryWidget({ data }: { data: Record<string, unknown> }) {
  const imgs = (data.images as GalleryImage[]) ?? [];
  const [idx, setIdx] = useState<number | null>(null);

  useEffect(() => {
    if (idx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIdx(null);
      else if (e.key === "ArrowRight") setIdx((i) => (i === null ? i : (i + 1) % imgs.length));
      else if (e.key === "ArrowLeft") setIdx((i) => (i === null ? i : (i - 1 + imgs.length) % imgs.length));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [idx, imgs.length]);

  if (!imgs.length) return null;
  const cur = idx !== null ? imgs[idx] : null;

  return (
    <div>
      <div className="mx-gallery">
        {imgs.map((img, i) => (
          <button key={i} type="button" className="mx-gallery__item" onClick={() => setIdx(i)} aria-label={img.name || `Image ${i + 1}`}>
            <img src={img.cdnUrl} alt={img.name || ""} loading="lazy" />
            <span className="mx-gallery__zoom"><ZoomIn aria-hidden="true" /></span>
          </button>
        ))}
      </div>
      {cur && idx !== null && (
        <div className="mx-lb" role="dialog" aria-modal="true">
          <div className="mx-lb__bg" onClick={() => setIdx(null)} />
          <button className="mx-lb__x" type="button" aria-label="Close" onClick={() => setIdx(null)}>
            <X aria-hidden="true" />
          </button>
          {imgs.length > 1 && (
            <button className="mx-lb__nav mx-lb__prev" type="button" aria-label="Previous" onClick={() => setIdx((idx - 1 + imgs.length) % imgs.length)}>
              <ChevronLeft aria-hidden="true" />
            </button>
          )}
          <div className="mx-lb__stage">
            <img className="mx-lb__img" src={cur.cdnUrl} alt={cur.name || ""} />
            {cur.name && <div className="mx-lb__cap">{cur.name}</div>}
          </div>
          {imgs.length > 1 && (
            <button className="mx-lb__nav mx-lb__next" type="button" aria-label="Next" onClick={() => setIdx((idx + 1) % imgs.length)}>
              <ChevronRight aria-hidden="true" />
            </button>
          )}
          {imgs.length > 1 && <div className="mx-lb__count">{idx + 1} / {imgs.length}</div>}
        </div>
      )}
    </div>
  );
}

// Recursive — `section` embeds a nested row.
function SectionWidget({ data }: { data: Record<string, unknown> }) {
  const section = data as unknown as MixedContentData;
  if (!section.columns?.length) return null;
  return (
    <div className="mx-row mx-row--nested">
      {section.columns.map((col) => (
        <div key={col.id} className="mx-col" style={{ "--w": col.width } as CSSProperties}>
          {col.widgets.map((w) => renderWidget(w))}
        </div>
      ))}
    </div>
  );
}

function renderWidget(widget: MixedContentWidget) {
  switch (widget.type) {
    case "text": return <TextWidget key={widget.id} data={widget.data} />;
    case "video": return <VideoWidget key={widget.id} data={widget.data} />;
    case "link": return widget.data.linkType ? <LinkRenderer key={widget.id} data={widget.data} /> : null;
    case "accordion": return <AccordionWidget key={widget.id} data={widget.data} />;
    case "gallery": return <GalleryWidget key={widget.id} data={widget.data} />;
    case "section": return <SectionWidget key={widget.id} data={widget.data} />;
    default: return null;
  }
}

// ─── Block renderer ───────────────────────────────────────────────────────────
// Mixed Content is the only built-in block type. Renders one row; authored
// column widths map to `--w` (the SCSS turns that into grid spans).

function BlockRenderer({ block }: { block: Block }) {
  if (block.type !== "mixed-content") return null;
  const d = block.data as unknown as MixedContentData;
  if (!d.columns?.length) return null;
  return (
    <div className="mx-row">
      {d.columns.map((col) => (
        <div key={col.id} className="mx-col" style={{ "--w": col.width } as CSSProperties}>
          {col.widgets.map((widget) => renderWidget(widget))}
        </div>
      ))}
    </div>
  );
}

// ─── Default page view ──────────────────────────────────────────────────────
// The page title above the blocks; each Mixed Content block is its own
// full-width section band with an inner `.ln-container`.

function DefaultView({ page }: { page: Page }) {
  const blocks = (page.blocks ?? []).filter((b) => b.type === "mixed-content");
  return (
    <div className="mx-view">
      <section className="mx-pagehead">
        <div className="ln-container">
          <h1>{page.title}</h1>
        </div>
      </section>
      {blocks.map((block) => (
        <section className="mx-section" key={block.id}>
          <div className="ln-container">
            <BlockRenderer block={block} />
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function PageView() {
  const params = useParams();
  const locale = params.locale;
  // Splat = the full hierarchical path after the locale (e.g. "about/team").
  const path = params["*"] ?? "";
  const [searchParams] = useSearchParams();
  const previewToken = searchParams.get("previewToken") ?? undefined;
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { setAlternates } = usePageAlternates();
  const { settings } = useLocaleConfig();

  useDocumentSeo(
    page
      ? {
          title: page.title,
          metaTitle: page.metaTitle,
          metaDescription: page.metaDescription,
          ogImageUrl: page.ogImageUrl,
          canonicalUrl: page.canonicalUrl,
          noindex: page.noindex || !!previewToken,
        }
      : null,
    settings,
  );

  useEffect(() => {
    if (!path || !locale) return;
    setLoading(true);
    setNotFound(false);
    getPageBySlug(locale, path, previewToken)
      .then((data) => {
        if (!data || (!previewToken && data.status !== "published")) {
          setPage(null);
          setNotFound(true);
        } else {
          setPage(data);
          setAlternates(data.alternates ?? null);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [locale, path, previewToken, setAlternates]);

  useEffect(() => {
    return () => setAlternates(null);
  }, [setAlternates]);

  if (loading) return <Loader />;
  if (notFound) return <NotFound />;
  if (!page) return null;

  const activeLocale = locale ?? page.locale ?? "hr";
  const linkPages = page.linkPages ?? {};

  const previewBanner = previewToken ? (
    <Box
      p="xs"
      style={{
        background: "#f5a623",
        color: "#000",
        textAlign: "center",
        fontWeight: 600,
        fontSize: 14,
        position: "sticky",
        top: 0,
        zIndex: 1000,
      }}
    >
      Preview mode — this page is not published
    </Box>
  ) : null;

  return (
    <RenderContext.Provider value={{ locale: activeLocale, linkPages }}>
      {previewBanner}
      {page.type === "404" ? <NotFound /> : <DefaultView page={page} />}
    </RenderContext.Provider>
  );
}
