"use client";

import type {
  InstructorsGridBlockData,
  SideLoadedData,
  Instructor,
  HomePage,
} from "@/lib/strapi/types";
import ExpertInstructors from "@/components/ExpertInstructors";

interface InstructorsGridBlockProps {
  data: InstructorsGridBlockData;
  sideLoadedData: SideLoadedData;
}

export function InstructorsGridBlock({
  data,
  sideLoadedData,
}: InstructorsGridBlockProps) {
  // Filter instructors based on block configuration
  let filtered: Instructor[] = sideLoadedData.instructors;

  if (data.filterSection !== "all") {
    filtered = filtered.filter(
      (instructor) => instructor.section === data.filterSection
    );
  }

  if (data.showHomepageOnly) {
    filtered = filtered.filter((instructor) => instructor.showOnHomepage);
  }

  // ExpertInstructors expects `sectionData` shaped like HomePage.
  const sectionData: Partial<HomePage> = {
    instructorsTitle: data.title,
    instructorsDescription: data.description,
  };

  return (
    <ExpertInstructors
      instructors={filtered}
      sectionData={sectionData as any}
    />
  );
}
