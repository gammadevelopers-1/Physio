// GROQ queries for fetching blog content from Sanity

// Get all blog posts with localized fields
export const getAllBlogPostsQuery = `
  *[_type == "blogPost"] | order(publishedAt desc) {
    _id,
    title,
    slug,
    excerpt,
    mainImage,
    category->{
      _id,
      title,
      slug
    },
    publishedAt,
    readTimeMinutes,
    featured,
    author
  }
`;

// Get featured blog post
export const getFeaturedBlogQuery = `
  *[_type == "blogPost" && featured == true][0] {
    _id,
    title,
    slug,
    excerpt,
    mainImage,
    category->{
      _id,
      title,
      slug
    },
    publishedAt,
    readTimeMinutes,
    featured,
    author
  }
`;

// Get single blog post by slug
export const getBlogBySlugQuery = `
  *[_type == "blogPost" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    excerpt,
    content,
    mainImage,
    category->{
      _id,
      title,
      slug
    },
    publishedAt,
    readTimeMinutes,
    author,
    tags
  }
`;

// Get all blog categories
export const getBlogCategoriesQuery = `
  *[_type == "category"] | order(title.en asc) {
    _id,
    title,
    slug
  }
`;

// Get blogs by category
export const getBlogsByCategoryQuery = `
  *[_type == "blogPost" && category->slug.current == $categorySlug] | order(publishedAt desc) {
    _id,
    title,
    slug,
    excerpt,
    mainImage,
    category->{
      _id,
      title,
      slug
    },
    publishedAt,
    readTimeMinutes,
    featured,
    author
  }
`;

// Get latest blogs (for sidebar)
export const getLatestBlogsQuery = `
  *[_type == "blogPost"] | order(publishedAt desc)[0...3] {
    _id,
    title,
    slug,
    mainImage,
    category->{
      _id,
      title,
      slug
    }
  }
`;

// Search blogs by query (searches title, excerpt, and tags in both languages)
export const searchBlogsQuery = `
  *[_type == "blogPost" && (
    title.en match $searchQuery ||
    title.ar match $searchQuery ||
    excerpt.en match $searchQuery ||
    excerpt.ar match $searchQuery ||
    $searchQuery in tags[]
  )] | order(publishedAt desc) {
    _id,
    title,
    slug,
    excerpt,
    mainImage,
    category->{
      _id,
      title,
      slug
    },
    publishedAt,
    readTimeMinutes,
    featured,
    author,
    tags
  }
`;
