import type { StrapiApp } from '@strapi/strapi/admin';

const RTL_STYLE_ID = 'strapi-rtl-override';

const RTL_CSS = `
  /* RTL override for Arabic locale content fields */
  body.strapi-locale-ar main input:not([type="search"]):not([name*="search"]),
  body.strapi-locale-ar main textarea,
  body.strapi-locale-ar main [contenteditable="true"],
  body.strapi-locale-ar main [role="textbox"],
  body.strapi-locale-ar main [data-slate-editor="true"],
  body.strapi-locale-ar main .ck-editor__editable,
  body.strapi-locale-ar main [class*="EditorLayout"] textarea,
  body.strapi-locale-ar main [class*="Textarea"],
  body.strapi-locale-ar main [class*="TextInput"] input {
    direction: rtl !important;
    text-align: right !important;
  }
`;

function isArabicLocale(): boolean {
  // Strapi v5 content-manager URL: ?plugins[i18n][locale]=ar
  const url = window.location.href;
  if (url.includes('locale=ar')) return true;

  // Fallback: check the locale picker for Arabic selection
  const localePickerButtons = document.querySelectorAll(
    'button, [role="combobox"], [role="option"], [data-strapi-dropdown]'
  );
  for (const el of localePickerButtons) {
    const text = el.textContent?.trim() || '';
    if (text === 'Arabic (ar)' || text === 'ar') {
      // Make sure it's actually selected (has aria-selected or is the trigger)
      if (
        el.getAttribute('aria-selected') === 'true' ||
        el.tagName === 'BUTTON' ||
        el.getAttribute('role') === 'combobox'
      ) {
        return true;
      }
    }
  }
  return false;
}

function applyDirection() {
  const isArabic = isArabicLocale();

  // Toggle body class - CSS rules handle the rest
  document.body.classList.toggle('strapi-locale-ar', isArabic);

  // Ensure the style tag exists
  if (!document.getElementById(RTL_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = RTL_STYLE_ID;
    style.textContent = RTL_CSS;
    document.head.appendChild(style);
  }

  // Also set dir attribute on individual fields as a belt-and-suspenders approach
  if (isArabic) {
    const mainContent = document.querySelector('main') || document.body;
    const fields = mainContent.querySelectorAll<HTMLElement>(
      'input:not([type="search"]):not([type="hidden"]), textarea, [contenteditable="true"], [role="textbox"], [data-slate-editor="true"]'
    );
    fields.forEach((field) => {
      if (field.closest('nav') || field.closest('[role="navigation"]')) return;
      field.dir = 'rtl';
      field.style.setProperty('direction', 'rtl', 'important');
      field.style.setProperty('text-align', 'right', 'important');
    });
  }
}

export default {
  config: {
    locales: ['ar'],
  },
  bootstrap(_app: StrapiApp) {
    // Inject the RTL stylesheet immediately
    const style = document.createElement('style');
    style.id = RTL_STYLE_ID;
    style.textContent = RTL_CSS;
    document.head.appendChild(style);

    let lastUrl = '';

    const check = () => {
      applyDirection();
      lastUrl = window.location.href;
    };

    // MutationObserver for DOM changes (new fields rendering, locale switch)
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        check();
      }
      applyDirection();
    });

    const start = () => {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
      check();
    };

    // Poll every 500ms as fallback for async-rendered fields
    setInterval(applyDirection, 500);

    if (document.readyState === 'complete') {
      start();
    } else {
      window.addEventListener('load', start);
    }
  },
};
