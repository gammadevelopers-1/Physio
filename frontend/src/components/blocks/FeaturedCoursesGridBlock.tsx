"use client";

import type {
  FeaturedCoursesGridBlockData,
  SideLoadedData,
  HomePage,
} from "@/lib/strapi/types";
import FeaturedCourses from "@/components/FeaturedCourses";

interface FeaturedCoursesGridBlockProps {
  data: FeaturedCoursesGridBlockData;
  sideLoadedData: SideLoadedData;
}

export function FeaturedCoursesGridBlock({
  data,
  sideLoadedData,
}: FeaturedCoursesGridBlockProps) {
  // FeaturedCourses expects `sectionData` shaped like HomePage.
  // Map the generic block fields to the relevant HomePage fields.
  const sectionData: Partial<HomePage> = {
    featuredCoursesTitle: data.title,
    featuredCoursesDescription: data.description,
    featuredCoursesViewAllLabel: data.viewAllLabel,
  };

  return (
    <FeaturedCourses
      sectionData={sectionData as any}
    />
  );
}
