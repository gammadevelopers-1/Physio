import { createClient } from "@sanity/client";
import imageUrlBuilder from "@sanity/image-url";
import type { SanityImageSource } from "@sanity/image-url/lib/types/types";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const apiVersion = "2024-01-01";

// Public client for reading published content
export const client = createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: true, // Enable CDN for faster responses
});

// Client with token for authenticated requests (server-side only)
export const getAuthenticatedClient = () =>
    createClient({
        projectId,
        dataset,
        apiVersion,
        useCdn: false,
        token: process.env.SANITY_API_TOKEN,
    });

// Image URL builder
const builder = imageUrlBuilder(client);

export const urlFor = (source: SanityImageSource) => {
    return builder.image(source);
};

// Real-time listener client (no CDN for live updates)
export const previewClient = createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: false,
    // Token not needed for public content
});
