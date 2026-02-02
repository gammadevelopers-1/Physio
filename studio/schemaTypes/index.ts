import { localizedString } from './localizedString'
import { localizedText } from './localizedText'
import { localizedContent } from './localizedContent'
import { category } from './category'
import { blogPost } from './blogPost'

export const schemaTypes = [
    // Utility types
    localizedString,
    localizedText,
    localizedContent,
    // Document types
    category,
    blogPost,
]
