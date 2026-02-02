import { defineField, defineType } from 'sanity'

export const blogPost = defineType({
    name: 'blogPost',
    title: 'Blog Post',
    type: 'document',
    fields: [
        defineField({
            name: 'title',
            title: 'Title',
            type: 'localizedString',
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'slug',
            title: 'Slug',
            type: 'slug',
            options: {
                source: 'title.en',
                maxLength: 96,
            },
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'excerpt',
            title: 'Excerpt',
            type: 'localizedText',
            description: 'A short description of the blog post',
        }),
        defineField({
            name: 'mainImage',
            title: 'Main Image',
            type: 'image',
            options: {
                hotspot: true,
            },
            fields: [
                {
                    name: 'alt',
                    type: 'string',
                    title: 'Alternative Text',
                },
            ],
        }),
        defineField({
            name: 'category',
            title: 'Category',
            type: 'reference',
            to: [{ type: 'category' }],
        }),
        defineField({
            name: 'author',
            title: 'Author',
            type: 'object',
            fields: [
                defineField({
                    name: 'name',
                    title: 'Name',
                    type: 'localizedString',
                }),
                defineField({
                    name: 'avatar',
                    title: 'Avatar',
                    type: 'image',
                }),
            ],
        }),
        defineField({
            name: 'publishedAt',
            title: 'Published At',
            type: 'datetime',
            initialValue: () => new Date().toISOString(),
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'readTimeMinutes',
            title: 'Read Time (minutes)',
            type: 'number',
            initialValue: 5,
            validation: (rule) => rule.required().min(1),
        }),
        defineField({
            name: 'featured',
            title: 'Featured Post',
            type: 'boolean',
            initialValue: false,
            description: 'Show this post in the featured section',
        }),
        defineField({
            name: 'content',
            title: 'Content',
            type: 'localizedContent',
        }),
        defineField({
            name: 'tags',
            title: 'Tags',
            type: 'array',
            of: [{ type: 'string' }],
            options: {
                layout: 'tags',
            },
        }),
    ],
    preview: {
        select: {
            titleEn: 'title.en',
            titleAr: 'title.ar',
            media: 'mainImage',
            categoryTitle: 'category.title.en',
            featured: 'featured',
        },
        prepare(selection) {
            const { titleEn, titleAr, media, categoryTitle, featured } = selection
            return {
                title: titleEn || titleAr || 'Untitled',
                subtitle: `${featured ? '⭐ Featured | ' : ''}${categoryTitle || 'No category'}`,
                media,
            }
        },
    },
    orderings: [
        {
            title: 'Published Date, New',
            name: 'publishedAtDesc',
            by: [{ field: 'publishedAt', direction: 'desc' }],
        },
        {
            title: 'Published Date, Old',
            name: 'publishedAtAsc',
            by: [{ field: 'publishedAt', direction: 'asc' }],
        },
    ],
})
