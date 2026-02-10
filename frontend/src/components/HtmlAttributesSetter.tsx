'use client';

import { useEffect } from 'react';

interface HtmlAttributesSetterProps {
  lang: string;
  dir: 'ltr' | 'rtl';
}

export function HtmlAttributesSetter({ lang, dir }: HtmlAttributesSetterProps) {
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  return null;
}
