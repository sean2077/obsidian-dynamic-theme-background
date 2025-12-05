/**
 * DTB Landing Page i18n Module
 * Handles dynamic language switching without page reload
 */
(function () {
    'use strict';

    const SUPPORTED_LANGS = ['en', 'zh'];
    const DEFAULT_LANG = 'en';
    const STORAGE_KEY = 'dtb-lang';

    let currentLang = DEFAULT_LANG;
    let translations = {};

    /**
     * Detect user's preferred language
     */
    function detectLanguage() {
        // 1. Check URL parameter ?lang=xx
        const params = new URLSearchParams(location.search);
        const urlLang = params.get('lang');
        if (urlLang && SUPPORTED_LANGS.includes(urlLang)) {
            return urlLang;
        }

        // 2. Check localStorage
        const storedLang = localStorage.getItem(STORAGE_KEY);
        if (storedLang && SUPPORTED_LANGS.includes(storedLang)) {
            return storedLang;
        }

        // 3. Check browser language
        const browserLang = navigator.language || navigator.userLanguage || '';
        if (browserLang.startsWith('zh')) {
            return 'zh';
        }

        return DEFAULT_LANG;
    }

    /**
     * Load translation file
     */
    async function loadTranslation(lang) {
        try {
            const response = await fetch(`i18n/${lang}.json`);
            if (!response.ok) throw new Error('Failed to load translation');
            return await response.json();
        } catch (e) {
            console.warn(`Failed to load ${lang} translation:`, e);
            if (lang !== DEFAULT_LANG) {
                return loadTranslation(DEFAULT_LANG);
            }
            return {};
        }
    }

    /**
     * Get nested value from object by dot-notation path
     */
    function getNestedValue(obj, path) {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    }

    /**
     * Apply translations to all elements with data-i18n attribute
     */
    function applyTranslations(t) {
        // Update HTML lang attribute
        document.documentElement.lang = t.lang || currentLang;

        // Update page title
        if (t.meta?.title) {
            document.title = t.meta.title;
        }

        // Update meta description
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc && t.meta?.description) {
            metaDesc.setAttribute('content', t.meta.description);
        }

        // Update meta keywords
        const metaKeywords = document.querySelector('meta[name="keywords"]');
        if (metaKeywords && t.meta?.keywords) {
            metaKeywords.setAttribute('content', t.meta.keywords);
        }

        // Update OG meta tags
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle && t.meta?.ogTitle) {
            ogTitle.setAttribute('content', t.meta.ogTitle);
        }

        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc && t.meta?.ogDescription) {
            ogDesc.setAttribute('content', t.meta.ogDescription);
        }

        const ogLocale = document.querySelector('meta[property="og:locale"]');
        if (ogLocale && t.meta?.ogLocale) {
            ogLocale.setAttribute('content', t.meta.ogLocale);
        }

        // Apply translations to elements with data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const value = getNestedValue(t, key);
            if (value !== undefined) {
                // Check if it contains HTML
                if (typeof value === 'string' && (value.includes('<') || value.includes('&'))) {
                    el.innerHTML = value;
                } else {
                    el.textContent = value;
                }
            }
        });

        // Apply translations to elements with data-i18n-attr (for attributes)
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const value = getNestedValue(t, key);
            if (value) el.setAttribute('title', value);
        });

        document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
            const key = el.getAttribute('data-i18n-aria-label');
            const value = getNestedValue(t, key);
            if (value) el.setAttribute('aria-label', value);
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const value = getNestedValue(t, key);
            if (value) el.setAttribute('placeholder', value);
        });

        // Update language toggle button
        const langToggle = document.getElementById('lang-toggle-btn') || document.querySelector('.lang-toggle');
        if (langToggle) {
            const langText = langToggle.querySelector('.lang-text');
            const targetLang = currentLang === 'en' ? 'zh' : 'en';
            if (langText) {
                langText.textContent = targetLang === 'zh' ? '中' : 'EN';
            }
            langToggle.setAttribute('title', t.nav?.langSwitchTitle || '');
            langToggle.setAttribute('aria-label', t.nav?.langSwitch || '');
        }

        // Update back-to-top button
        const backToTop = document.getElementById('back-to-top');
        if (backToTop && t.nav?.backToTop) {
            backToTop.setAttribute('aria-label', t.nav.backToTop);
            backToTop.setAttribute('title', t.nav.backToTop);
        }

        // Update skip link
        const skipLink = document.querySelector('.skip-link');
        if (skipLink && t.accessibility?.skipToContent) {
            skipLink.textContent = t.accessibility.skipToContent;
        }

        // Handle FAQ items dynamically
        if (t.faq?.items) {
            const faqGrid = document.querySelector('.faq-grid');
            if (faqGrid) {
                const faqItems = faqGrid.querySelectorAll('.faq-item');
                t.faq.items.forEach((item, index) => {
                    if (faqItems[index]) {
                        const q = faqItems[index].querySelector('.faq-question');
                        const a = faqItems[index].querySelector('.faq-answer');
                        if (q) q.textContent = item.q;
                        if (a) a.innerHTML = item.a;
                    }
                });
            }
        }

        // Handle demo items via data-demo-list attribute
        document.querySelectorAll('[data-demo-list]').forEach(ul => {
            const listType = ul.getAttribute('data-demo-list');
            const items = t.demo?.[listType + 'Items'];
            if (items && Array.isArray(items)) {
                ul.innerHTML = items.map(item => `<li>${item}</li>`).join('');
            }
        });

        // Handle installation steps via data-install-method attribute
        document.querySelectorAll('[data-install-method]').forEach(ul => {
            const method = ul.getAttribute('data-install-method');
            const steps = t.installation?.[method]?.steps;
            if (steps && Array.isArray(steps)) {
                ul.innerHTML = steps.map((step, i) =>
                    `<li><span class="install-step-number">${i + 1}</span> <span>${step}</span></li>`
                ).join('');
            }
        });
    }

    /**
     * Switch language
     */
    async function switchLanguage(lang) {
        if (!SUPPORTED_LANGS.includes(lang)) {
            console.warn(`Unsupported language: ${lang}`);
            return;
        }

        currentLang = lang;
        localStorage.setItem(STORAGE_KEY, lang);

        // Update URL without reload
        const url = new URL(location.href);
        url.searchParams.set('lang', lang);
        history.replaceState(null, '', url.toString());

        // Load and apply translations
        translations = await loadTranslation(lang);
        applyTranslations(translations);

        // Dispatch event for other scripts
        document.dispatchEvent(new CustomEvent('dtb-lang-change', { detail: { lang, translations } }));
    }

    /**
     * Initialize i18n
     */
    async function init() {
        currentLang = detectLanguage();
        translations = await loadTranslation(currentLang);
        applyTranslations(translations);

        // Setup language toggle click handler
        const langToggle = document.getElementById('lang-toggle-btn') || document.querySelector('.lang-toggle');
        if (langToggle) {
            langToggle.addEventListener('click', (e) => {
                e.preventDefault();
                const targetLang = currentLang === 'en' ? 'zh' : 'en';
                switchLanguage(targetLang);
            });
            // Remove href if it's an anchor, to prevent navigation
            if (langToggle.tagName === 'A') {
                langToggle.removeAttribute('href');
                langToggle.style.cursor = 'pointer';
            }
        }
    }

    // Expose API
    window.DTBi18n = {
        init,
        switchLanguage,
        getCurrentLang: () => currentLang,
        getTranslations: () => translations
    };

    // Auto-init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
