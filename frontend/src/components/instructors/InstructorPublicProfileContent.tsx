"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useLocale } from "next-intl";
import { Star, BookOpen, Users, MessageSquare, Loader2 } from "lucide-react";
import { CourseCard, MobileCourseCard } from "@/components/courses";
import { publicApi } from "@/lib/api";
import { ApiError } from "@/lib/api";
import type { InstructorPublicProfile } from "@/types/instructor-dashboard";

interface InstructorPublicProfileContentProps {
  instructorId: string;
}

const InstructorPublicProfileContent = ({ instructorId }: InstructorPublicProfileContentProps) => {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const [profile, setProfile] = useState<InstructorPublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    publicApi
      .getInstructorPublicProfile(instructorId)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.statusCode === 404) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [instructorId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-16 py-20">
        <div className="flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-16 py-20 text-center">
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
          {isRTL ? "المدرب غير موجود" : "Instructor not found"}
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          {isRTL
            ? "يبدو أن هذا المدرب غير متاح حاليًا."
            : "This instructor profile is unavailable right now."}
        </p>
      </div>
    );
  }

  const fullName = (() => {
    const ar = `${profile.firstNameAr || ""} ${profile.lastNameAr || ""}`.trim();
    const en = `${profile.firstName || ""} ${profile.lastName || ""}`.trim();
    if (isRTL && ar) return ar;
    return en || ar || "Instructor";
  })();

  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  const tagline = profile.profession || profile.specialty || profile.qualification || null;

  const twitterHref = profile.twitter
    ? profile.twitter.startsWith("http")
      ? profile.twitter
      : `https://twitter.com/${profile.twitter.replace(/^@/, "")}`
    : null;
  const linkedinHref = profile.linkedin
    ? profile.linkedin.startsWith("http")
      ? profile.linkedin
      : `https://linkedin.com/in/${profile.linkedin}`
    : null;

  const formatDate = (raw: string) => {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString(isRTL ? "ar-SA" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-4 h-4 ${
            s <= Math.round(rating)
              ? "text-[var(--color-star)] fill-[var(--color-star)]"
              : "text-[var(--color-star-border)]"
          }`}
        />
      ))}
    </div>
  );

  const { stats, courses, reviews } = profile;

  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
      <section className="max-w-7xl mx-auto px-4 md:px-8 lg:px-16 py-8 md:py-12">
        {/* ─── Header card ─────────────────────────────────────── */}
        <div className="bg-[var(--color-surface-card)] rounded-2xl p-6 md:p-8 border border-[var(--color-border)]">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
            {/* Avatar */}
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden bg-[var(--color-border-subtle)] flex items-center justify-center flex-shrink-0">
              {profile.avatar ? (
                <Image
                  src={profile.avatar}
                  alt={fullName}
                  width={160}
                  height={160}
                  className="w-full h-full object-cover"
                  unoptimized={profile.avatar.startsWith("http")}
                />
              ) : (
                <span className="text-3xl md:text-4xl font-semibold text-[var(--color-text-secondary)]">
                  {initials || "?"}
                </span>
              )}
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] mb-1">
                {fullName}
              </h1>
              {tagline && (
                <p className="text-[var(--color-primary)] font-medium text-base md:text-lg mb-3">
                  {tagline}
                </p>
              )}

              {stats.totalRatings > 0 && (
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  {renderStars(stats.avgRating)}
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {stats.avgRating.toFixed(1)}
                  </span>
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    ({stats.totalRatings}{" "}
                    {isRTL ? "تقييم" : stats.totalRatings === 1 ? "review" : "reviews"})
                  </span>
                </div>
              )}

              {/* Social links */}
              {(twitterHref || linkedinHref) && (
                <div className="flex items-center gap-2 mt-2">
                  {linkedinHref && (
                    <a
                      href={linkedinHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="LinkedIn"
                      className="w-9 h-9 rounded-full border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-colors"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                      </svg>
                    </a>
                  )}
                  {twitterHref && (
                    <a
                      href={twitterHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Twitter"
                      className="w-9 h-9 rounded-full border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-colors"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Stats strip ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-6">
          <StatCard
            icon={<BookOpen className="w-5 h-5 text-[var(--color-primary)]" />}
            label={isRTL ? "الدورات" : "Courses"}
            value={String(stats.totalCourses)}
          />
          <StatCard
            icon={<Users className="w-5 h-5 text-[var(--color-primary)]" />}
            label={isRTL ? "الطلاب" : "Students"}
            value={String(stats.totalStudents)}
          />
          <StatCard
            icon={<MessageSquare className="w-5 h-5 text-[var(--color-primary)]" />}
            label={isRTL ? "المراجعات" : "Reviews"}
            value={String(stats.totalRatings)}
          />
          <StatCard
            icon={<Star className="w-5 h-5 text-[var(--color-star)] fill-[var(--color-star)]" />}
            label={isRTL ? "متوسط التقييم" : "Avg rating"}
            value={stats.totalRatings > 0 ? stats.avgRating.toFixed(1) : "—"}
          />
        </div>

        {/* ─── About / Bio ─────────────────────────────────────── */}
        {(profile.bio || profile.specialty || profile.qualification) && (
          <div className="bg-[var(--color-surface-card)] rounded-2xl p-6 md:p-8 mt-6 border border-[var(--color-border)]">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
              {isRTL ? "نبذة" : "About"}
            </h2>
            {profile.bio && (
              <p className="text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line mb-4">
                {profile.bio}
              </p>
            )}
            {(profile.specialty || profile.qualification) && (
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                {profile.specialty && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)] mb-0.5">
                      {isRTL ? "التخصص" : "Specialty"}
                    </dt>
                    <dd className="text-sm font-medium text-[var(--color-text-primary)]">
                      {profile.specialty}
                    </dd>
                  </div>
                )}
                {profile.qualification && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)] mb-0.5">
                      {isRTL ? "المؤهل" : "Qualification"}
                    </dt>
                    <dd className="text-sm font-medium text-[var(--color-text-primary)]">
                      {profile.qualification}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        )}

        {/* ─── Courses grid ────────────────────────────────────── */}
        {courses.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)] mb-6">
              {isRTL ? "دورات هذا المدرب" : "Courses by this instructor"}
            </h2>
            <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((c) => (
                <CourseCard key={c.id} course={c} isRTL={isRTL} />
              ))}
            </div>
            <div className="md:hidden flex flex-col gap-5">
              {courses.map((c) => (
                <MobileCourseCard key={c.id} course={c} isRTL={isRTL} />
              ))}
            </div>
          </div>
        )}

        {/* ─── Reviews ─────────────────────────────────────────── */}
        {reviews.data.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)] mb-6">
              {isRTL ? "آراء الطلاب" : "Student reviews"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reviews.data.map((r) => {
                const courseLabel = isRTL && r.courseTitleAr ? r.courseTitleAr : r.courseTitle;
                return (
                  <div
                    key={r.id}
                    className="bg-[var(--color-surface-card)] rounded-xl p-5 border border-[var(--color-border)]"
                  >
                    <div className="flex items-start justify-between mb-2 gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--color-text-primary)] truncate">
                          {r.studentName}
                        </p>
                        {courseLabel && (
                          <p className="text-xs text-[var(--color-text-secondary)] truncate mt-0.5">
                            {courseLabel}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0">{renderStars(r.rating)}</div>
                    </div>
                    {r.reviewText && (
                      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mt-2">
                        &ldquo;{r.reviewText}&rdquo;
                      </p>
                    )}
                    <p className="text-xs text-[var(--color-text-secondary)] mt-3">
                      {formatDate(r.createdAt)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

const StatCard = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <div className="bg-[var(--color-surface-card)] rounded-xl p-4 border border-[var(--color-border)] flex items-center gap-3">
    <div className="w-10 h-10 rounded-lg bg-[var(--color-border-subtle)] flex items-center justify-center flex-shrink-0">
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
      <p className="text-lg font-semibold text-[var(--color-text-primary)]">{value}</p>
    </div>
  </div>
);

export default InstructorPublicProfileContent;
