"use client";

import Script from "next/script";

interface LiveChatWidgetProps {
  enabled?: boolean | null;
  propertyId?: string | null;
  widgetId?: string | null;
}

const LiveChatWidget = ({ enabled, propertyId, widgetId }: LiveChatWidgetProps) => {
  if (!enabled) return null;
  if (!propertyId?.trim() || !widgetId?.trim()) return null;

  const src = `https://embed.tawk.to/${propertyId.trim()}/${widgetId.trim()}`;

  return (
    <Script
      id="tawk-to-embed"
      strategy="afterInteractive"
    >
      {`
        var Tawk_API = Tawk_API || {};
        var Tawk_LoadStart = new Date();
        (function(){
          var s1 = document.createElement("script");
          var s0 = document.getElementsByTagName("script")[0];
          s1.async = true;
          s1.src = '${src}';
          s1.charset = 'UTF-8';
          s1.setAttribute('crossorigin', '*');
          s0.parentNode.insertBefore(s1, s0);
        })();
      `}
    </Script>
  );
};

export default LiveChatWidget;
