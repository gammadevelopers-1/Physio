import { defineField, defineType } from 'sanity'

export const localizedText = defineType({
    name: 'localizedText',
    title: 'Localized Text',
    type: 'object',
    fields: [
        defineField({
            name: 'en',
            title: 'English',
            type: 'text',
            rows: 3,
        }),
        defineField({
            name: 'ar',
            title: 'Arabic (العربية)',
            type: 'text',
            rows: 3,
        }),
    ],
})
