import { defineField, defineType } from 'sanity'

export const category = defineType({
    name: 'category',
    title: 'Category',
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
            name: 'description',
            title: 'Description',
            type: 'localizedText',
        }),
    ],
    preview: {
        select: {
            titleEn: 'title.en',
            titleAr: 'title.ar',
        },
        prepare(selection) {
            const { titleEn, titleAr } = selection
            return {
                title: titleEn || titleAr || 'Untitled',
                subtitle: titleAr ? `العربية: ${titleAr}` : undefined,
            }
        },
    },
})
