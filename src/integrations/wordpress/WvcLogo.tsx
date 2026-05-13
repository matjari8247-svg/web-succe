import { useEffect, useState } from 'react';

interface WvcLogoProps {
  className?: string;
  style?: React.CSSProperties;
}

declare const wvcClient:
  | { getLogo?: (skipCache?: boolean) => Promise<{ attachment_id: number; url: string } | null> }
  | undefined;

interface LogoState {
  svgContent: string | null;
  imgUrl: string | null;
}

async function fetchLogoData(url: string): Promise<LogoState> {
  // PNG URLs don't need a fetch — <img> loads cross-origin without CORS headers.
  // fetch() would trigger a CORS preflight that self-hosted WP sites may not support.
  if (/\.png(\?|#|$)/i.test(url)) {
    return { svgContent: null, imgUrl: url };
  }
  try {
    const res = await fetch(url);
    if (!res.ok) return { svgContent: null, imgUrl: null };
    const contentType = res.headers.get('Content-Type') ?? '';
    if (contentType.includes('image/svg+xml')) {
      const raw = await res.text();
      // Strip hardcoded width/height/style from root <svg> so the component
      // controls sizing, then inject height:100%;width:auto so it fills its container.
      const svgContent = raw
        .replace(/\bfill="[^"]*"/g, 'fill="currentColor"')
        .replace(/<svg\b([^>]*)>/i, (_, attrs) => {
          const cleaned = attrs.replace(/\s+(?:width|height|style)="[^"]*"/g, '');
          return `<svg${cleaned} style="height:100%;width:auto;display:block">`;
        });
      return { svgContent, imgUrl: null };
    }
    return { svgContent: null, imgUrl: url };
  } catch {
    return { svgContent: null, imgUrl: null };
  }
}

export function WvcLogo({ className = 'h-10 w-auto', style }: WvcLogoProps) {
  const [logo, setLogo] = useState<LogoState>({ svgContent: null, imgUrl: null });

  useEffect(() => {
    if (typeof wvcClient?.getLogo !== 'function') return;

    // Fetch logo on mount — getLogo() returns cached data instantly on first load,
    // falls back to REST if not pre-loaded
    wvcClient.getLogo().then((meta) => {
      if (meta?.url) fetchLogoData(meta.url).then(setLogo);
    });

    // Re-fetch when WordPress updates the logo
    const handleRefresh = () => {
      wvcClient?.getLogo?.(true)?.then((updated) => {
        if (updated?.url) fetchLogoData(updated.url).then(setLogo);
      });
    };
    window.addEventListener('WVC_LOGO_REFRESH', handleRefresh);
    return () => window.removeEventListener('WVC_LOGO_REFRESH', handleRefresh);
  }, []);

  if (logo.svgContent) {
    return (
      <span className={className} style={{ display: 'inline-block', ...style, maxHeight: '26px' }} data-wvc-role="logo">
        <span
          style={{ color: 'var(--color-logo)', display: 'block', height: '100%' }}
          dangerouslySetInnerHTML={{ __html: logo.svgContent }}
        />
      </span>
    );
  }

  if (logo.imgUrl) {
    return (
      <span className={className} style={{ display: 'inline-block', ...style, maxHeight: '26px' }} data-wvc-role="logo">
        <img
          src={logo.imgUrl}
          alt="Logo"
          style={{ display: 'block', height: '100%', width: 'auto' }}
        />
      </span>
    );
  }

  return null;
}