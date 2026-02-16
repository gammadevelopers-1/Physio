"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
import {
  Search,
  Plus,
  Filter,
  ChevronDown,
  MoreVertical,
  FileText,
  ClipboardList,
  BarChart3,
  Users,
  CheckCircle,
  Clock,
  Edit3,
  Copy,
  Trash2,
  Eye,
  HelpCircle,
  ListChecks,
  ToggleLeft,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface Assessment {
  id: string;
  title: string;
  course: string;
  type: "quiz" | "exam" | "assignment";
  questions: number;
  submissions: number;
  avgScore: number;
  status: "active" | "draft" | "closed";
  dueDate?: string;
}

interface Question {
  id: string;
  text: string;
  type: "multiple-choice" | "true-false" | "short-answer" | "essay";
  course: string;
  usedIn: number;
  lastUsed: string;
}

interface Submission {
  id: string;
  studentName: string;
  studentInitials: string;
  assessment: string;
  score: number;
  maxScore: number;
  submittedAt: string;
  status: "graded" | "pending" | "needs-review";
}

interface ItemAnalysis {
  id: string;
  question: string;
  correctRate: number;
  avgTime: string;
  discrimination: "good" | "moderate" | "poor";
  difficulty: "easy" | "medium" | "hard";
}

const AssessmentsContent = () => {
  const instructor = useInstructorProfile();
  const t = useTranslations("instructorDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [activeTab, setActiveTab] = useState<
    "all" | "questionBank" | "submissions" | "itemAnalysis"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // Mock data
  const assessments: Assessment[] = [
    {
      id: "1",
      title: "Lower Back Pain - Final Exam",
      course: "Lower Back Pain Management",
      type: "exam",
      questions: 50,
      submissions: 28,
      avgScore: 82,
      status: "active",
      dueDate: "Feb 15, 2024",
    },
    {
      id: "2",
      title: "Module 3 Quiz",
      course: "Sports Rehabilitation",
      type: "quiz",
      questions: 15,
      submissions: 42,
      avgScore: 88,
      status: "active",
    },
    {
      id: "3",
      title: "Case Study Analysis",
      course: "Pediatric Physiotherapy",
      type: "assignment",
      questions: 5,
      submissions: 18,
      avgScore: 75,
      status: "closed",
    },
    {
      id: "4",
      title: "Mid-term Assessment",
      course: "Lower Back Pain Management",
      type: "exam",
      questions: 30,
      submissions: 0,
      avgScore: 0,
      status: "draft",
    },
  ];

  const questions: Question[] = [
    {
      id: "1",
      text: "Which muscle group is primarily affected in lumbar disc herniation?",
      type: "multiple-choice",
      course: "Lower Back Pain Management",
      usedIn: 3,
      lastUsed: "Feb 5, 2024",
    },
    {
      id: "2",
      text: "True or False: The McKenzie method is effective for all types of back pain.",
      type: "true-false",
      course: "Lower Back Pain Management",
      usedIn: 2,
      lastUsed: "Jan 28, 2024",
    },
    {
      id: "3",
      text: "Describe the proper technique for ACL rehabilitation in the first 6 weeks.",
      type: "essay",
      course: "Sports Rehabilitation",
      usedIn: 1,
      lastUsed: "Jan 20, 2024",
    },
    {
      id: "4",
      text: "List three contraindications for pediatric massage therapy.",
      type: "short-answer",
      course: "Pediatric Physiotherapy",
      usedIn: 2,
      lastUsed: "Jan 15, 2024",
    },
  ];

  const submissions: Submission[] = [
    {
      id: "1",
      studentName: "Sarah Johnson",
      studentInitials: "SJ",
      assessment: "Lower Back Pain - Final Exam",
      score: 45,
      maxScore: 50,
      submittedAt: "2 hours ago",
      status: "graded",
    },
    {
      id: "2",
      studentName: "Ahmed Al-Hassan",
      studentInitials: "AH",
      assessment: "Module 3 Quiz",
      score: 12,
      maxScore: 15,
      submittedAt: "5 hours ago",
      status: "pending",
    },
    {
      id: "3",
      studentName: "Maria Garcia",
      studentInitials: "MG",
      assessment: "Case Study Analysis",
      score: 4,
      maxScore: 5,
      submittedAt: "1 day ago",
      status: "needs-review",
    },
    {
      id: "4",
      studentName: "James Wilson",
      studentInitials: "JW",
      assessment: "Lower Back Pain - Final Exam",
      score: 48,
      maxScore: 50,
      submittedAt: "1 day ago",
      status: "graded",
    },
  ];

  const itemAnalysis: ItemAnalysis[] = [
    {
      id: "1",
      question: "Which muscle group is primarily affected in lumbar disc herniation?",
      correctRate: 78,
      avgTime: "1m 45s",
      discrimination: "good",
      difficulty: "medium",
    },
    {
      id: "2",
      question: "The McKenzie method is effective for all types of back pain.",
      correctRate: 92,
      avgTime: "0m 30s",
      discrimination: "moderate",
      difficulty: "easy",
    },
    {
      id: "3",
      question: "What is the primary function of the transverse abdominis?",
      correctRate: 45,
      avgTime: "2m 15s",
      discrimination: "good",
      difficulty: "hard",
    },
    {
      id: "4",
      question: "Which imaging technique is best for soft tissue assessment?",
      correctRate: 68,
      avgTime: "1m 20s",
      discrimination: "poor",
      difficulty: "medium",
    },
  ];

  const courses = [
    { id: "all", name: t("assessments.allCourses") },
    { id: "course1", name: "Lower Back Pain Management" },
    { id: "course2", name: "Sports Rehabilitation" },
    { id: "course3", name: "Pediatric Physiotherapy" },
  ];

  const types = [
    { id: "all", name: t("assessments.allTypes") },
    { id: "quiz", name: t("assessments.typeQuiz") },
    { id: "exam", name: t("assessments.typeExam") },
    { id: "assignment", name: t("assessments.typeAssignment") },
  ];

  const tabs = [
    { id: "all" as const, label: t("assessments.tabAll"), icon: ClipboardList },
    { id: "questionBank" as const, label: t("assessments.tabQuestionBank"), icon: HelpCircle },
    { id: "submissions" as const, label: t("assessments.tabSubmissions"), icon: Users },
    { id: "itemAnalysis" as const, label: t("assessments.tabItemAnalysis"), icon: BarChart3 },
  ];

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "active":
        return "bg-[#DCFCE7] text-[#22C55E]";
      case "draft":
        return "bg-[#FEF9C3] text-[#EAB308]";
      case "closed":
        return "bg-[#F3F4F6] text-[#6B7280]";
      default:
        return "bg-[#F3F4F6] text-[#6B7280]";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "multiple-choice":
        return <ListChecks className="w-4 h-4 text-[#3B82F6]" />;
      case "true-false":
        return <ToggleLeft className="w-4 h-4 text-[#22C55E]" />;
      case "short-answer":
        return <MessageSquare className="w-4 h-4 text-[#F97316]" />;
      case "essay":
        return <FileText className="w-4 h-4 text-[#8B5CF6]" />;
      default:
        return <HelpCircle className="w-4 h-4 text-[#6B7280]" />;
    }
  };

  const getSubmissionStatusStyle = (status: string) => {
    switch (status) {
      case "graded":
        return "bg-[#DCFCE7] text-[#22C55E]";
      case "pending":
        return "bg-[#FEF9C3] text-[#EAB308]";
      case "needs-review":
        return "bg-[#FEE2E2] text-[#EF4444]";
      default:
        return "bg-[#F3F4F6] text-[#6B7280]";
    }
  };

  const getDifficultyStyle = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "bg-[#DCFCE7] text-[#22C55E]";
      case "medium":
        return "bg-[#FEF9C3] text-[#EAB308]";
      case "hard":
        return "bg-[#FEE2E2] text-[#EF4444]";
      default:
        return "bg-[#F3F4F6] text-[#6B7280]";
    }
  };

  const getDiscriminationStyle = (discrimination: string) => {
    switch (discrimination) {
      case "good":
        return "text-[#22C55E]";
      case "moderate":
        return "text-[#EAB308]";
      case "poor":
        return "text-[#EF4444]";
      default:
        return "text-[#6B7280]";
    }
  };

  // Stats
  const totalAssessments = assessments.length;
  const activeAssessments = assessments.filter((a) => a.status === "active").length;
  const totalSubmissions = submissions.length;
  const pendingGrading = submissions.filter((s) => s.status === "pending" || s.status === "needs-review").length;

  return (
    <>
      <InstructorNavbar instructor={instructor} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <InstructorSidebar instructor={instructor} />
            </div>
            <InstructorMobileSidebar instructor={instructor} />

            <div className="flex-1 min-w-0 space-y-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-[#1F2937]">
                    {t("assessments.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {t("assessments.subtitle")}
                  </p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 btn-gold text-white rounded-lg transition-colors text-sm font-medium">
                  <Plus className="w-4 h-4" />
                  {t("assessments.createNew")}
                </button>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#DBEAFE] flex items-center justify-center">
                      <ClipboardList className="w-5 h-5 text-[#3B82F6]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#1F2937]">{totalAssessments}</p>
                      <p className="text-xs text-[#6B7280]">{t("assessments.total")}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#DCFCE7] flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-[#22C55E]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#1F2937]">{activeAssessments}</p>
                      <p className="text-xs text-[#6B7280]">{t("assessments.active")}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#E0E7FF] flex items-center justify-center">
                      <Users className="w-5 h-5 text-[#6366F1]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#1F2937]">{totalSubmissions}</p>
                      <p className="text-xs text-[#6B7280]">{t("assessments.submissions")}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#FEF9C3] flex items-center justify-center">
                      <Clock className="w-5 h-5 text-[#EAB308]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#1F2937]">{pendingGrading}</p>
                      <p className="text-xs text-[#6B7280]">{t("assessments.pendingGrading")}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="bg-white rounded-xl border border-[#E5E7EB]">
                <div className="flex border-b border-[#E5E7EB] overflow-x-auto">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-5 py-3 text-sm font-medium relative transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                        activeTab === tab.id
                          ? "text-[#3B82F6]"
                          : "text-[#6B7280] hover:text-[#374151]"
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                      {activeTab === tab.id && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3B82F6] rounded-t" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Search and Filters */}
                <div className="p-4 border-b border-[#E5E7EB]">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                      <Search
                        className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`}
                      />
                      <input
                        type="text"
                        placeholder={t("assessments.searchPlaceholder")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`w-full py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"}`}
                      />
                    </div>

                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className="md:hidden flex items-center justify-center gap-2 px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] hover:bg-[#F9FAFB]"
                    >
                      <Filter className="w-4 h-4" />
                      {t("assessments.filters")}
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
                      />
                    </button>

                    <div className="hidden md:flex gap-3">
                      <select
                        value={selectedCourse}
                        onChange={(e) => setSelectedCourse(e.target.value)}
                        className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                      >
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.name}
                          </option>
                        ))}
                      </select>
                      {activeTab === "all" && (
                        <select
                          value={selectedType}
                          onChange={(e) => setSelectedType(e.target.value)}
                          className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                        >
                          {types.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Mobile Filters */}
                  {showFilters && (
                    <div className="md:hidden mt-4 pt-4 border-t border-[#E5E7EB] grid grid-cols-2 gap-3">
                      <select
                        value={selectedCourse}
                        onChange={(e) => setSelectedCourse(e.target.value)}
                        className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                      >
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.name}
                          </option>
                        ))}
                      </select>
                      {activeTab === "all" && (
                        <select
                          value={selectedType}
                          onChange={(e) => setSelectedType(e.target.value)}
                          className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                        >
                          {types.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>

                {/* Tab Content */}
                <div className="p-5">
                  {/* All Assessments Tab */}
                  {activeTab === "all" && (
                    <div className="space-y-4">
                      {assessments.map((assessment) => (
                        <div
                          key={assessment.id}
                          className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-lg bg-[#DBEAFE] flex items-center justify-center">
                                <FileText className="w-5 h-5 text-[#3B82F6]" />
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-[#1F2937]">
                                  {assessment.title}
                                </h4>
                                <p className="text-xs text-[#6B7280] mt-0.5">
                                  {assessment.course}
                                </p>
                                <div className="flex items-center gap-3 mt-2">
                                  <span className="text-xs text-[#6B7280]">
                                    {assessment.questions} {t("assessments.questions")}
                                  </span>
                                  <span className="text-xs text-[#6B7280]">
                                    {assessment.submissions} {t("assessments.submissions")}
                                  </span>
                                  {assessment.avgScore > 0 && (
                                    <span className="text-xs text-[#6B7280]">
                                      {t("assessments.avgScore")}: {assessment.avgScore}%
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusStyle(assessment.status)}`}
                            >
                              {assessment.status === "active" && <CheckCircle className="w-3 h-3" />}
                              {assessment.status === "draft" && <Clock className="w-3 h-3" />}
                              {t(`assessments.status${assessment.status.charAt(0).toUpperCase() + assessment.status.slice(1)}`)}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                className="p-2 text-[#6B7280] hover:text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                                title={t("assessments.edit")}
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                className="p-2 text-[#6B7280] hover:text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                                title={t("assessments.duplicate")}
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button className="p-2 text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Question Bank Tab */}
                  {activeTab === "questionBank" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm text-[#6B7280]">
                          {questions.length} {t("assessments.questionsInBank")}
                        </p>
                        <button className="flex items-center gap-2 px-3 py-1.5 bg-[#3B82F6] text-white rounded-lg hover:bg-[#2563EB] transition-colors text-sm font-medium">
                          <Plus className="w-4 h-4" />
                          {t("assessments.addQuestion")}
                        </button>
                      </div>

                      {questions.map((question) => (
                        <div
                          key={question.id}
                          className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] transition-colors"
                        >
                          <div className="flex items-start gap-3 flex-1">
                            <div className="w-9 h-9 rounded-lg bg-[#F3F4F6] flex items-center justify-center">
                              {getTypeIcon(question.type)}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-[#1F2937] line-clamp-2">
                                {question.text}
                              </p>
                              <div className="flex items-center gap-3 mt-2">
                                <span className="text-xs text-[#9CA3AF]">
                                  {question.course}
                                </span>
                                <span className="text-xs text-[#9CA3AF]">
                                  {t("assessments.usedIn")} {question.usedIn} {t("assessments.assessmentsLabel")}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#9CA3AF]">
                              {t("assessments.lastUsed")}: {question.lastUsed}
                            </span>
                            <button className="p-2 text-[#6B7280] hover:text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-[#6B7280] hover:text-[#EF4444] hover:bg-[#FEE2E2] rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Submissions Tab */}
                  {activeTab === "submissions" && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-left">
                            <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                              {t("assessments.student")}
                            </th>
                            <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                              {t("assessments.assessment")}
                            </th>
                            <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                              {t("assessments.score")}
                            </th>
                            <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                              {t("assessments.submitted")}
                            </th>
                            <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                              {t("assessments.status")}
                            </th>
                            <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                              {t("assessments.actions")}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E7EB]">
                          {submissions.map((submission) => (
                            <tr key={submission.id} className="hover:bg-[#F9FAFB]">
                              <td className="py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-[#E5E7EB] flex items-center justify-center text-xs font-semibold text-[#4B5563]">
                                    {submission.studentInitials}
                                  </div>
                                  <span className="text-sm text-[#1F2937]">
                                    {submission.studentName}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3">
                                <span className="text-sm text-[#374151]">
                                  {submission.assessment}
                                </span>
                              </td>
                              <td className="py-3">
                                <span
                                  className={`text-sm font-semibold ${
                                    (submission.score / submission.maxScore) * 100 >= 80
                                      ? "text-[#22C55E]"
                                      : (submission.score / submission.maxScore) * 100 >= 60
                                        ? "text-[#EAB308]"
                                        : "text-[#EF4444]"
                                  }`}
                                >
                                  {submission.score}/{submission.maxScore}
                                </span>
                              </td>
                              <td className="py-3">
                                <span className="text-sm text-[#6B7280]">
                                  {submission.submittedAt}
                                </span>
                              </td>
                              <td className="py-3">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getSubmissionStatusStyle(submission.status)}`}
                                >
                                  {submission.status === "graded" && <CheckCircle className="w-3 h-3" />}
                                  {submission.status === "pending" && <Clock className="w-3 h-3" />}
                                  {t(`assessments.submission${submission.status.charAt(0).toUpperCase() + submission.status.slice(1).replace("-", "")}`)}
                                </span>
                              </td>
                              <td className="py-3">
                                <button className="p-2 text-[#6B7280] hover:text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors">
                                  <Eye className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Item Analysis Tab */}
                  {activeTab === "itemAnalysis" && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-left">
                            <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                              {t("assessments.question")}
                            </th>
                            <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                              {t("assessments.correctRate")}
                            </th>
                            <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                              {t("assessments.avgTime")}
                            </th>
                            <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                              {t("assessments.discrimination")}
                            </th>
                            <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                              {t("assessments.difficulty")}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E7EB]">
                          {itemAnalysis.map((item) => (
                            <tr key={item.id} className="hover:bg-[#F9FAFB]">
                              <td className="py-3">
                                <span className="text-sm text-[#1F2937] line-clamp-1 max-w-[300px]">
                                  {item.question}
                                </span>
                              </td>
                              <td className="py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        item.correctRate >= 70
                                          ? "bg-[#22C55E]"
                                          : item.correctRate >= 50
                                            ? "bg-[#EAB308]"
                                            : "bg-[#EF4444]"
                                      }`}
                                      style={{ width: `${item.correctRate}%` }}
                                    />
                                  </div>
                                  <span className="text-sm text-[#374151]">
                                    {item.correctRate}%
                                  </span>
                                </div>
                              </td>
                              <td className="py-3">
                                <span className="text-sm text-[#6B7280]">{item.avgTime}</span>
                              </td>
                              <td className="py-3">
                                <span
                                  className={`flex items-center gap-1 text-sm font-medium ${getDiscriminationStyle(item.discrimination)}`}
                                >
                                  {item.discrimination === "good" && <TrendingUp className="w-4 h-4" />}
                                  {item.discrimination === "poor" && <TrendingDown className="w-4 h-4" />}
                                  {t(`assessments.discrimination${item.discrimination.charAt(0).toUpperCase() + item.discrimination.slice(1)}`)}
                                </span>
                              </td>
                              <td className="py-3">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyStyle(item.difficulty)}`}
                                >
                                  {t(`assessments.difficulty${item.difficulty.charAt(0).toUpperCase() + item.difficulty.slice(1)}`)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AssessmentsContent;
