// TypeScript types for Sanity blog data

import type { PortableTextBlock } from "@portabletext/react";

// Bilingual text field
export interface LocalizedString {
    en: string;
    ar: string;
}

// Sanity image reference
export interface SanityImage {
    _type: "image";
    asset: {
        _ref: string;
        _type: "reference";
    };
    alt?: string;
}

// Category type
export interface SanityCategory {
    _id: string;
    title: LocalizedString;
    slug: {
        current: string;
    };
}

// Author type
export interface SanityAuthor {
    name: LocalizedString;
    avatar?: SanityImage;
}

// Blog post type for list view
export interface SanityBlogPost {
    _id: string;
    title: LocalizedString;
    slug: {
        current: string;
    };
    excerpt: LocalizedString;
    mainImage?: SanityImage;
    category?: SanityCategory;
    publishedAt: string;
    readTimeMinutes: number;
    featured?: boolean;
    author?: SanityAuthor;
}

// Bilingual content using Portable Text
export interface LocalizedContent {
    en: PortableTextBlock[];
    ar: PortableTextBlock[];
}

// Full blog post type (for detail view)
export interface SanityBlogPostDetail extends SanityBlogPost {
    content: LocalizedContent;
    tags?: string[];
}

// Helper function to get localized value
export function getLocalizedValue<T>(
    obj: { en: T; ar: T } | undefined,
    locale: string
): T | undefined {
    if (!obj) return undefined;
    return locale === "ar" ? obj.ar : obj.en;
}

// Format publish date based on locale
export function formatPublishDate(dateString: string, locale: string): string {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
        day: "numeric",
        month: "short",
        year: "numeric",
    };

    if (locale === "ar") {
        // Format for Arabic
        const formatted = date.toLocaleDateString("ar-SA", options);
        return `نُشر في ${formatted}`;
    }

    // Format for English
    const formatted = date.toLocaleDateString("en-US", options);
    return `Published on ${formatted}`;
}

// Format read time based on locale
export function formatReadTime(minutes: number, locale: string): string {
    if (locale === "ar") {
        return `${minutes} دقائق قراءة`;
    }
    return `${minutes} min read`;
}
