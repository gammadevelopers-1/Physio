"use server";

// Server actions for fetching blog data from Sanity
// These run on the server, avoiding CORS issues

import { client } from "@/lib/sanity";
import {
    getAllBlogPostsQuery,
    getFeaturedBlogQuery,
    getBlogCategoriesQuery,
    getBlogBySlugQuery,
    getLatestBlogsQuery,
} from "@/lib/sanity/queries";
import type { SanityBlogPost, SanityBlogPostDetail, SanityCategory } from "@/lib/sanity/types";

export async function fetchAllBlogPosts(): Promise<SanityBlogPost[]> {
    try {
        const posts = await client.fetch<SanityBlogPost[]>(getAllBlogPostsQuery);
        return posts || [];
    } catch (error) {
        console.error("Error fetching blog posts from Sanity:", error);
        return [];
    }
}

export async function fetchFeaturedBlog(): Promise<SanityBlogPost | null> {
    try {
        const post = await client.fetch<SanityBlogPost | null>(getFeaturedBlogQuery);
        return post;
    } catch (error) {
        console.error("Error fetching featured blog from Sanity:", error);
        return null;
    }
}

export async function fetchBlogCategories(): Promise<SanityCategory[]> {
    try {
        const categories = await client.fetch<SanityCategory[]>(getBlogCategoriesQuery);
        return categories || [];
    } catch (error) {
        console.error("Error fetching categories from Sanity:", error);
        return [];
    }
}

export async function fetchBlogBySlug(slug: string): Promise<SanityBlogPostDetail | null> {
    try {
        const post = await client.fetch<SanityBlogPostDetail | null>(getBlogBySlugQuery, { slug });
        return post;
    } catch (error) {
        console.error("Error fetching blog by slug from Sanity:", error);
        return null;
    }
}

export async function fetchLatestBlogs(): Promise<SanityBlogPost[]> {
    try {
        const posts = await client.fetch<SanityBlogPost[]>(getLatestBlogsQuery);
        return posts || [];
    } catch (error) {
        console.error("Error fetching latest blogs from Sanity:", error);
        return [];
    }
}
