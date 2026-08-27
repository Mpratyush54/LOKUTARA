"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  acceptAllConsent,
  hasDecided,
  rejectOptionalConsent,
  shouldLoadVendor,
  type ConsentState,
} from "@/lib/tracking/consent";
import {
  ensureIdentity,
  experimentFor,
  loadExperimentConfigs,
  readClientConsent,
  track,
  writeClientConsent,
} from "@/lib/tracking/client";
import { CookieBanner } from "@/components/consent/CookieBanner";

/**
 * Consent is read synchronously on the client so returning visitors never see a
 * banner flash. SSR starts as null (banner hidden) to avoid hydration mismatch.
 */
function initialConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  return readClientConsent();
}

export function SiteProviders({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<ConsentState | null>(initialConsent);
  const trackedPath = useRef<string | null>(null);

  useLayoutEffect(() => {
    // Sync read on mount covers edge cases where SSR null needs a client value.
    const stored = readClientConsent();
    setConsent(stored);
  }, []);

  useEffect(() => {
    if (!consent || !shouldLoadVendor(consent, "analytics")) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname.startsWith("/admin")) return;

    const path = window.location.pathname;
    if (trackedPath.current === path) return;
    trackedPath.current = path;

    // Defer identity + experiment fetch until after paint; avoid blocking render.
    const id = window.setTimeout(() => {
      void (async () => {
        ensureIdentity();
        await loadExperimentConfigs();
        const variant = experimentFor("hero_cta");
        void track("page_view", { experiment: "hero_cta", variant });
      })();
    }, 0);
    return () => window.clearTimeout(id);
  }, [consent]);

  function accept() {
    const next = acceptAllConsent();
    writeClientConsent(next);
    setConsent(next);
  }

  function reject() {
    const next = rejectOptionalConsent();
    writeClientConsent(next);
    setConsent(next);
  }

  const showBanner = consent !== null && !hasDecided(consent);

  return (
    <>
      {children}
      {showBanner ? (
        <CookieBanner consent={consent} onAcceptAll={accept} onRejectOptional={reject} />
      ) : null}
      {consent && shouldLoadVendor(consent, "analytics") ? <VendorScripts consent={consent} /> : null}
    </>
  );
}

function VendorScripts({ consent }: { consent: ConsentState }) {
  const posthog = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const ga = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const clarity = process.env.NEXT_PUBLIC_CLARITY_ID;
  const meta = process.env.NEXT_PUBLIC_META_PIXEL_ID;

  return (
    <>
      {posthog && shouldLoadVendor(consent, "analytics") ? (
        <script
          dangerouslySetInnerHTML={{
            __html: `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture identify alias people.set".split(" ");for(n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init(${JSON.stringify(posthog)},{api_host:${JSON.stringify(process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com")},capture_pageview:true,persistence:"cookie"});`,
          }}
        />
      ) : null}
      {ga ? (
        <>
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} />
          <script
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(ga)});`,
            }}
          />
        </>
      ) : null}
      {clarity ? (
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script",${JSON.stringify(clarity)});`,
          }}
        />
      ) : null}
      {meta && shouldLoadVendor(consent, "marketing") ? (
        <script
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(meta)});fbq('track','PageView');`,
          }}
        />
      ) : null}
    </>
  );
}
