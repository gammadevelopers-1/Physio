#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, '..', 'frontend', 'messages', 'en.json');
const arPath = path.join(__dirname, '..', 'frontend', 'messages', 'ar.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

// AGENT DASHBOARD
en.supportDashboard.agentDashboard = {
  title: "My Dashboard",
  welcome: "Welcome back, {name}! Here are your assigned tickets.",
  fallbackName: "Agent",
  assignedTickets: "My Assigned Tickets",
  viewAll: "View All →",
  noTickets: "No tickets assigned to you yet.",
  columns: {
    id: "ID",
    subject: "Subject",
    student: "Student",
    priority: "Priority",
    status: "Status"
  }
};
ar.supportDashboard.agentDashboard = {
  title: "لوحتي",
  welcome: "مرحبًا بعودتك يا {name}! هذه التذاكر المسندة إليك.",
  fallbackName: "موظف الدعم",
  assignedTickets: "التذاكر المسندة إليّ",
  viewAll: "عرض الكل ←",
  noTickets: "لا توجد تذاكر مسندة إليك حتى الآن.",
  columns: {
    id: "المعرف",
    subject: "الموضوع",
    student: "الطالب",
    priority: "الأولوية",
    status: "الحالة"
  }
};

// TEAM PAGE additions
en.supportDashboard.teamPage.modal = {
  title: "Add New Agent",
  firstName: "First Name *",
  lastName: "Last Name *",
  email: "Email *",
  password: "Password *",
  passwordPlaceholder: "Min 8 characters",
  phone: "Phone",
  helpText: "The new user will be created with the Support Agent role and can immediately access the agent dashboard.",
  cancel: "Cancel",
  create: "Create Agent",
  creating: "Creating..."
};
ar.supportDashboard.teamPage.modal = {
  title: "إضافة موظف جديد",
  firstName: "الاسم الأول *",
  lastName: "اسم العائلة *",
  email: "البريد الإلكتروني *",
  password: "كلمة المرور *",
  passwordPlaceholder: "8 أحرف كحد أدنى",
  phone: "الهاتف",
  helpText: "سيتم إنشاء المستخدم الجديد بدور موظف الدعم ويمكنه الوصول مباشرة إلى لوحة الموظف.",
  cancel: "إلغاء",
  create: "إنشاء موظف",
  creating: "جارٍ الإنشاء..."
};
en.supportDashboard.teamPage.toasts = {
  fillAll: "Please fill all required fields",
  passwordLength: "Password must be at least 8 characters",
  created: "Agent created successfully",
  createFailed: "Failed to create agent"
};
ar.supportDashboard.teamPage.toasts = {
  fillAll: "يرجى تعبئة جميع الحقول المطلوبة",
  passwordLength: "يجب ألا تقل كلمة المرور عن 8 أحرف",
  created: "تم إنشاء الموظف بنجاح",
  createFailed: "تعذّر إنشاء الموظف"
};
en.supportDashboard.teamPage.noData = "No data yet";
ar.supportDashboard.teamPage.noData = "لا توجد بيانات بعد";
en.supportDashboard.teamPage.agentRoles = { supervisor: "Supervisor", agent: "Agent" };
ar.supportDashboard.teamPage.agentRoles = { supervisor: "مشرف", agent: "موظف" };

// KB PAGE additions
en.supportDashboard.kbPage.toasts = {
  titleBodyRequired: "English title and body are required",
  updated: "Article updated",
  created: "Article created",
  saveFailed: "Failed to save article",
  confirmDelete: "Delete this article?",
  deleted: "Article deleted",
  deleteFailed: "Failed to delete article"
};
ar.supportDashboard.kbPage.toasts = {
  titleBodyRequired: "العنوان والمحتوى باللغة الإنجليزية مطلوبان",
  updated: "تم تحديث المقال",
  created: "تم إنشاء المقال",
  saveFailed: "تعذّر حفظ المقال",
  confirmDelete: "حذف هذا المقال؟",
  deleted: "تم حذف المقال",
  deleteFailed: "تعذّر حذف المقال"
};
en.supportDashboard.kbPage.form = {
  editTitle: "Edit Article",
  createTitle: "Create New Article",
  titleEn: "Title (English) *",
  titleAr: "Title (Arabic)",
  titleEnPlaceholder: "Article title in English",
  titleArPlaceholder: "Article title in Arabic",
  bodyEn: "Body (English) *",
  bodyAr: "Body (Arabic)",
  bodyEnPlaceholder: "Article content in English...",
  bodyArPlaceholder: "Article content in Arabic...",
  category: "Category",
  publishedToggle: "Published",
  draftToggle: "Draft",
  saving: "Saving...",
  update: "Update",
  create: "Create",
  cancel: "Cancel",
  categoryOptions: {
    technical: "Technical",
    billing: "Billing",
    login: "Login",
    content: "Content"
  }
};
ar.supportDashboard.kbPage.form = {
  editTitle: "تعديل المقال",
  createTitle: "إنشاء مقال جديد",
  titleEn: "العنوان (الإنجليزية) *",
  titleAr: "العنوان (العربية)",
  titleEnPlaceholder: "عنوان المقال بالإنجليزية",
  titleArPlaceholder: "عنوان المقال بالعربية",
  bodyEn: "المحتوى (الإنجليزية) *",
  bodyAr: "المحتوى (العربية)",
  bodyEnPlaceholder: "محتوى المقال بالإنجليزية...",
  bodyArPlaceholder: "محتوى المقال بالعربية...",
  category: "الفئة",
  publishedToggle: "منشور",
  draftToggle: "مسودة",
  saving: "جارٍ الحفظ...",
  update: "تحديث",
  create: "إنشاء",
  cancel: "إلغاء",
  categoryOptions: {
    technical: "تقني",
    billing: "الفوترة",
    login: "تسجيل الدخول",
    content: "المحتوى"
  }
};

// TICKET DETAIL
en.supportDashboard.ticketDetail = {
  backToTickets: "Back to Tickets",
  notFound: "Ticket not found",
  staffBadge: "Staff",
  internalBadge: "Internal",
  unknownAuthor: "Unknown",
  reply: "Reply",
  applyMacro: "Apply Macro",
  macroPreview: "Macro Preview",
  insertMacro: "Insert",
  cancelMacro: "Cancel",
  internalNote: "Internal Note",
  internalNotePlaceholder: "Add an internal note (not visible to student)...",
  replyPlaceholder: "Type your reply...",
  addNote: "Add Note",
  sendReply: "Send Reply",
  details: "Details",
  detailsLabels: {
    category: "Category",
    assignee: "Assignee",
    unassigned: "Unassigned",
    course: "Course",
    created: "Created",
    resolved: "Resolved"
  },
  sla: {
    title: "SLA",
    firstResponse: "First Response",
    resolution: "Resolution",
    breached: "BREACHED",
    met: "MET",
    target: "Target: {value}",
    remaining: "{value} remaining",
    overdueBy: "Overdue by {value}",
    pausedOnHold: "SLA paused (on hold)"
  },
  actions: {
    title: "Actions",
    reassign: "Reassign Ticket",
    resolve: "Resolve Ticket",
    close: "Close Ticket",
    onHold: "Put On Hold",
    resume: "Resume Ticket",
    supervisorBadge: "(Supervisor)"
  },
  toasts: {
    loadFailed: "Failed to load ticket",
    internalAdded: "Internal note added",
    replySent: "Reply sent",
    replyFailed: "Failed to send reply",
    statusChanged: "Status changed to {status}",
    statusFailed: "Failed to update status",
    applyMacroFailed: "Failed to apply macro",
    reassigned: "Reassigned to {name}",
    reassignFailed: "Failed to reassign"
  }
};
ar.supportDashboard.ticketDetail = {
  backToTickets: "العودة إلى التذاكر",
  notFound: "لم يتم العثور على التذكرة",
  staffBadge: "موظف",
  internalBadge: "ملاحظة داخلية",
  unknownAuthor: "غير معروف",
  reply: "رد",
  applyMacro: "تطبيق قالب",
  macroPreview: "معاينة القالب",
  insertMacro: "إدراج",
  cancelMacro: "إلغاء",
  internalNote: "ملاحظة داخلية",
  internalNotePlaceholder: "أضف ملاحظة داخلية (غير ظاهرة للطالب)...",
  replyPlaceholder: "اكتب ردك...",
  addNote: "إضافة ملاحظة",
  sendReply: "إرسال الرد",
  details: "التفاصيل",
  detailsLabels: {
    category: "الفئة",
    assignee: "المسؤول",
    unassigned: "غير مُسند",
    course: "الدورة",
    created: "تاريخ الإنشاء",
    resolved: "تاريخ الحل"
  },
  sla: {
    title: "اتفاقية الخدمة",
    firstResponse: "أول استجابة",
    resolution: "الحل",
    breached: "تم الإخلال",
    met: "تم الإنجاز",
    target: "المستهدف: {value}",
    remaining: "متبقي {value}",
    overdueBy: "متأخر بمقدار {value}",
    pausedOnHold: "اتفاقية الخدمة متوقفة (قيد الانتظار)"
  },
  actions: {
    title: "الإجراءات",
    reassign: "إعادة إسناد التذكرة",
    resolve: "حل التذكرة",
    close: "إغلاق التذكرة",
    onHold: "تعليق التذكرة",
    resume: "استئناف التذكرة",
    supervisorBadge: "(مشرف)"
  },
  toasts: {
    loadFailed: "تعذّر تحميل التذكرة",
    internalAdded: "تمت إضافة الملاحظة الداخلية",
    replySent: "تم إرسال الرد",
    replyFailed: "تعذّر إرسال الرد",
    statusChanged: "تم تغيير الحالة إلى {status}",
    statusFailed: "تعذّر تحديث الحالة",
    applyMacroFailed: "تعذّر تطبيق القالب",
    reassigned: "تمت إعادة الإسناد إلى {name}",
    reassignFailed: "تعذّر إعادة الإسناد"
  }
};

// REPORTS PAGE additions
en.supportDashboard.reportsPage.export = "Export";
en.supportDashboard.reportsPage.downloadCsv = "Download CSV";
en.supportDashboard.reportsPage.downloadPdf = "Download PDF";
en.supportDashboard.reportsPage.filters.from = "From";
en.supportDashboard.reportsPage.filters.to = "To";
en.supportDashboard.reportsPage.reportTypes.topIssues = "Top Issues";
en.supportDashboard.reportsPage.reportTypes.topIssuesDesc = "Recurring issue categories by frequency";
en.supportDashboard.reportsPage.volume = {
  totalTickets: "Total tickets: {count}",
  noTickets: "No tickets found in this date range."
};
en.supportDashboard.reportsPage.issues = {
  noIssues: "No issues found in this date range.",
  columns: { rank: "Rank", category: "Category", tickets: "Tickets" }
};
en.supportDashboard.reportsPage.slaPanel = {
  noResolved: "No resolved tickets in this date range.",
  overallCompliance: "Overall SLA Compliance",
  metSla: "{met} / {total} tickets met SLA",
  frtCompliance: "FRT Compliance",
  frtSubtitle: "First Response Time met",
  ttrCompliance: "TTR Compliance",
  ttrSubtitle: "Time to Resolution met"
};
en.supportDashboard.reportsPage.agentsPanel = {
  noData: "No agent data available.",
  unknown: "Unknown",
  columns: {
    agent: "Agent",
    total: "Total",
    open: "Open",
    resolved: "Resolved",
    avgFrt: "Avg FRT",
    csat: "CSAT",
    frtBreaches: "FRT Breaches",
    ttrBreaches: "TTR Breaches"
  }
};
en.supportDashboard.reportsPage.csatPanel = {
  title: "CSAT Score",
  avgScore: "Avg Score (out of 5)",
  responses: "Responses",
  responseRate: "Response Rate",
  star: "{score} star"
};
en.supportDashboard.reportsPage.npsPanel = {
  title: "Net Promoter Score",
  score: "NPS Score",
  responses: "Responses",
  responseRate: "Response Rate",
  promoters: "Promoters",
  passives: "Passives",
  detractors: "Detractors"
};
en.supportDashboard.reportsPage.toasts = {
  loadFailed: "Failed to load report data",
  downloadedCsv: "Report downloaded",
  exportFailed: "Failed to export report",
  downloadedPdf: "PDF downloaded",
  exportPdfFailed: "Failed to export PDF",
  refreshed: "Report refreshed"
};

ar.supportDashboard.reportsPage.export = "تصدير";
ar.supportDashboard.reportsPage.downloadCsv = "تنزيل CSV";
ar.supportDashboard.reportsPage.downloadPdf = "تنزيل PDF";
ar.supportDashboard.reportsPage.filters.from = "من";
ar.supportDashboard.reportsPage.filters.to = "إلى";
ar.supportDashboard.reportsPage.reportTypes.topIssues = "أبرز المشكلات";
ar.supportDashboard.reportsPage.reportTypes.topIssuesDesc = "فئات المشكلات المتكررة حسب التكرار";
ar.supportDashboard.reportsPage.volume = {
  totalTickets: "إجمالي التذاكر: {count}",
  noTickets: "لا توجد تذاكر في هذا النطاق الزمني."
};
ar.supportDashboard.reportsPage.issues = {
  noIssues: "لا توجد مشكلات في هذا النطاق الزمني.",
  columns: { rank: "الترتيب", category: "الفئة", tickets: "التذاكر" }
};
ar.supportDashboard.reportsPage.slaPanel = {
  noResolved: "لا توجد تذاكر محلولة في هذا النطاق الزمني.",
  overallCompliance: "نسبة الالتزام الإجمالية باتفاقية الخدمة",
  metSla: "{met} من {total} تذكرة استوفت اتفاقية الخدمة",
  frtCompliance: "نسبة الالتزام بـ FRT",
  frtSubtitle: "تم الالتزام بزمن الاستجابة الأولى",
  ttrCompliance: "نسبة الالتزام بـ TTR",
  ttrSubtitle: "تم الالتزام بزمن الحل"
};
ar.supportDashboard.reportsPage.agentsPanel = {
  noData: "لا توجد بيانات للموظفين.",
  unknown: "غير معروف",
  columns: {
    agent: "الموظف",
    total: "الإجمالي",
    open: "مفتوحة",
    resolved: "محلولة",
    avgFrt: "متوسط FRT",
    csat: "CSAT",
    frtBreaches: "إخلالات FRT",
    ttrBreaches: "إخلالات TTR"
  }
};
ar.supportDashboard.reportsPage.csatPanel = {
  title: "درجة CSAT",
  avgScore: "متوسط الدرجة (من 5)",
  responses: "الردود",
  responseRate: "معدل الاستجابة",
  star: "{score} نجوم"
};
ar.supportDashboard.reportsPage.npsPanel = {
  title: "صافي نقاط المروّجين",
  score: "درجة NPS",
  responses: "الردود",
  responseRate: "معدل الاستجابة",
  promoters: "المروّجون",
  passives: "المحايدون",
  detractors: "المنتقدون"
};
ar.supportDashboard.reportsPage.toasts = {
  loadFailed: "تعذّر تحميل بيانات التقرير",
  downloadedCsv: "تم تنزيل التقرير",
  exportFailed: "تعذّر تصدير التقرير",
  downloadedPdf: "تم تنزيل PDF",
  exportPdfFailed: "تعذّر تصدير PDF",
  refreshed: "تم تحديث التقرير"
};

// SETTINGS PAGE additions
en.supportDashboard.settingsPage.tabs.profile = "Profile";
en.supportDashboard.settingsPage.tabs.escalation = "Escalation Paths";
en.supportDashboard.settingsPage.comingSoonBadge = "Soon";
en.supportDashboard.settingsPage.comingSoon = {
  title: "Coming Soon",
  description: "This feature is currently under development and will be available in an upcoming sprint. Stay tuned!"
};
en.supportDashboard.settingsPage.personalSecurity = "Personal Security Settings";
en.supportDashboard.settingsPage.profile = {
  title: "Profile Information",
  photoLabel: "Profile Photo",
  photoHelp: "JPG, PNG or GIF. Max 2MB.",
  uploadPhoto: "Upload Photo",
  removePhoto: "Remove Photo",
  firstName: "First Name",
  lastName: "Last Name",
  firstNamePlaceholder: "Enter first name",
  lastNamePlaceholder: "Enter last name",
  email: "Email",
  phone: "Phone",
  phonePlaceholder: "Enter phone number",
  saveChanges: "Save Changes",
  saving: "Saving...",
  toasts: {
    photoUpdated: "Profile photo updated",
    photoUploadFailed: "Failed to upload photo",
    photoRemoved: "Profile photo removed",
    photoRemoveFailed: "Failed to remove photo",
    profileUpdated: "Profile updated successfully",
    profileUpdateFailed: "Failed to update profile"
  }
};
en.supportDashboard.settingsPage.slaPanel = {
  title: "SLA Targets",
  description: "Configure First Response Time and Time to Resolution targets per priority level. Changes apply to future tickets only.",
  loadFailedTitle: "Failed to load SLA policies",
  retry: "Retry",
  noPolicies: "No SLA policies configured. Contact an administrator.",
  columns: {
    priority: "Priority",
    frt: "FRT (minutes)",
    ttr: "TTR (minutes)",
    escalate: "Escalate After (min)"
  },
  saving: "Saving...",
  save: "Save",
  validation: {
    frtPositive: "FRT must be a positive integer",
    ttrPositive: "TTR must be a positive integer",
    escalatePositive: "Escalate After must be a positive integer",
    ttrGreaterThanFrt: "TTR must be greater than FRT",
    escalateLessThanTtr: "Escalate After must be ≤ TTR"
  },
  toasts: {
    updated: "SLA policy updated",
    loadFailed: "Failed to load SLA policies",
    updateFailed: "Failed to update"
  }
};
en.supportDashboard.settingsPage.macrosPanel = {
  title: "Reply Macros",
  newMacro: "+ New Macro",
  description: "Pre-built reply templates with variable substitution. Variables: {variables}",
  editTitle: "Edit Macro",
  createTitle: "Create New Macro",
  formTitle: "Title *",
  formTitlePlaceholder: "e.g., Zoom Session Fix",
  bodyTemplate: "Body Template *",
  insertVariablesHint: "Click a variable to insert it at the cursor:",
  bodyTemplatePlaceholder: "Hi {learnerVar}, thank you for reaching out...",
  kbUrls: "KB Article URLs (one per line)",
  saving: "Saving...",
  update: "Update",
  create: "Create",
  cancel: "Cancel",
  noMacros: "No macros created yet.",
  edit: "Edit",
  delete: "Delete",
  variables: {
    learnerName: "Learner Name",
    courseName: "Course Name",
    ticketId: "Ticket ID",
    agentName: "Agent Name"
  },
  toasts: {
    titleBodyRequired: "Title and body are required",
    updated: "Macro updated",
    created: "Macro created",
    saveFailed: "Failed to save macro",
    confirmDelete: "Delete this macro?",
    deleted: "Macro deleted"
  }
};
en.supportDashboard.settingsPage.escalationPanel = {
  title: "Escalation Paths",
  description: "Define automatic ticket reassignment chains based on elapsed time.",
  newPath: "+ New Path",
  editTitle: "Edit Escalation Path",
  createTitle: "Create Escalation Path",
  nameLabel: "Name *",
  namePlaceholder: "e.g., Standard Escalation",
  stepsLabel: "Steps (in ascending order of minutes)",
  stepLabel: "Step {n}:",
  after: "After",
  minutesArrow: "min →",
  remove: "Remove",
  addStep: "+ Add Step",
  saving: "Saving...",
  update: "Update",
  create: "Create",
  cancel: "Cancel",
  noPathsConfigured: "No escalation paths configured.",
  edit: "Edit",
  delete: "Delete",
  loading: "Loading...",
  roles: {
    SUPPORT: "Support Agent",
    ADMIN: "Admin",
    SUPER_ADMIN: "Super Admin"
  },
  stepChip: "After {minutes}m → {role}",
  toasts: {
    nameRequired: "Name is required",
    atLeastOneStep: "At least one step is required",
    stepMinutesInvalid: "Step {n}: minutes must be >= 1",
    stepMinutesAscending: "Step {n} must have higher minutes than step {prev}",
    updated: "Escalation path updated",
    created: "Escalation path created",
    saveFailed: "Failed to save",
    loadFailed: "Failed to load escalation paths",
    confirmDelete: "Delete this escalation path?",
    deleted: "Escalation path deleted",
    deleteFailed: "Failed to delete"
  }
};

ar.supportDashboard.settingsPage.tabs.profile = "الملف الشخصي";
ar.supportDashboard.settingsPage.tabs.escalation = "مسارات التصعيد";
ar.supportDashboard.settingsPage.comingSoonBadge = "قريبًا";
ar.supportDashboard.settingsPage.comingSoon = {
  title: "قريبًا",
  description: "هذه الميزة قيد التطوير وستتوفّر في تحديث قادم. ترقّبوا الجديد!"
};
ar.supportDashboard.settingsPage.personalSecurity = "إعدادات الأمان الشخصية";
ar.supportDashboard.settingsPage.profile = {
  title: "بيانات الملف الشخصي",
  photoLabel: "صورة الملف الشخصي",
  photoHelp: "JPG أو PNG أو GIF. حد أقصى 2 ميجابايت.",
  uploadPhoto: "رفع صورة",
  removePhoto: "إزالة الصورة",
  firstName: "الاسم الأول",
  lastName: "اسم العائلة",
  firstNamePlaceholder: "أدخل الاسم الأول",
  lastNamePlaceholder: "أدخل اسم العائلة",
  email: "البريد الإلكتروني",
  phone: "الهاتف",
  phonePlaceholder: "أدخل رقم الهاتف",
  saveChanges: "حفظ التغييرات",
  saving: "جارٍ الحفظ...",
  toasts: {
    photoUpdated: "تم تحديث صورة الملف الشخصي",
    photoUploadFailed: "تعذّر رفع الصورة",
    photoRemoved: "تمت إزالة صورة الملف الشخصي",
    photoRemoveFailed: "تعذّر إزالة الصورة",
    profileUpdated: "تم تحديث الملف الشخصي بنجاح",
    profileUpdateFailed: "تعذّر تحديث الملف الشخصي"
  }
};
ar.supportDashboard.settingsPage.slaPanel = {
  title: "أهداف اتفاقية الخدمة",
  description: "إعداد أهداف زمن الاستجابة الأولى وزمن الحل لكل أولوية. تنطبق التغييرات على التذاكر المستقبلية فقط.",
  loadFailedTitle: "تعذّر تحميل سياسات اتفاقية الخدمة",
  retry: "إعادة المحاولة",
  noPolicies: "لم يتم إعداد أي سياسات اتفاقية خدمة. تواصل مع المسؤول.",
  columns: {
    priority: "الأولوية",
    frt: "FRT (دقائق)",
    ttr: "TTR (دقائق)",
    escalate: "التصعيد بعد (دقائق)"
  },
  saving: "جارٍ الحفظ...",
  save: "حفظ",
  validation: {
    frtPositive: "يجب أن يكون FRT عددًا صحيحًا موجبًا",
    ttrPositive: "يجب أن يكون TTR عددًا صحيحًا موجبًا",
    escalatePositive: "يجب أن يكون التصعيد عددًا صحيحًا موجبًا",
    ttrGreaterThanFrt: "يجب أن يكون TTR أكبر من FRT",
    escalateLessThanTtr: "يجب أن يكون التصعيد ≤ TTR"
  },
  toasts: {
    updated: "تم تحديث سياسة اتفاقية الخدمة",
    loadFailed: "تعذّر تحميل سياسات اتفاقية الخدمة",
    updateFailed: "تعذّر التحديث"
  }
};
ar.supportDashboard.settingsPage.macrosPanel = {
  title: "قوالب الردود",
  newMacro: "+ قالب جديد",
  description: "قوالب ردود جاهزة مع استبدال متغيرات. المتغيرات: {variables}",
  editTitle: "تعديل القالب",
  createTitle: "إنشاء قالب جديد",
  formTitle: "العنوان *",
  formTitlePlaceholder: "مثال: حل مشكلة جلسة زووم",
  bodyTemplate: "نص القالب *",
  insertVariablesHint: "اضغط على متغير لإدراجه في موضع المؤشر:",
  bodyTemplatePlaceholder: "مرحبًا {learnerVar}، شكرًا لتواصلك معنا...",
  kbUrls: "روابط مقالات قاعدة المعرفة (رابط في كل سطر)",
  saving: "جارٍ الحفظ...",
  update: "تحديث",
  create: "إنشاء",
  cancel: "إلغاء",
  noMacros: "لم يتم إنشاء أي قوالب بعد.",
  edit: "تعديل",
  delete: "حذف",
  variables: {
    learnerName: "اسم المتعلم",
    courseName: "اسم الدورة",
    ticketId: "معرّف التذكرة",
    agentName: "اسم الموظف"
  },
  toasts: {
    titleBodyRequired: "العنوان والمحتوى مطلوبان",
    updated: "تم تحديث القالب",
    created: "تم إنشاء القالب",
    saveFailed: "تعذّر حفظ القالب",
    confirmDelete: "حذف هذا القالب؟",
    deleted: "تم حذف القالب"
  }
};
ar.supportDashboard.settingsPage.escalationPanel = {
  title: "مسارات التصعيد",
  description: "حدّد سلاسل إعادة إسناد التذاكر تلقائيًا بناءً على الوقت المنقضي.",
  newPath: "+ مسار جديد",
  editTitle: "تعديل مسار التصعيد",
  createTitle: "إنشاء مسار تصعيد",
  nameLabel: "الاسم *",
  namePlaceholder: "مثال: تصعيد قياسي",
  stepsLabel: "الخطوات (مرتّبة تصاعديًا بالدقائق)",
  stepLabel: "الخطوة {n}:",
  after: "بعد",
  minutesArrow: "دقيقة ←",
  remove: "إزالة",
  addStep: "+ إضافة خطوة",
  saving: "جارٍ الحفظ...",
  update: "تحديث",
  create: "إنشاء",
  cancel: "إلغاء",
  noPathsConfigured: "لم يتم إعداد أي مسارات تصعيد.",
  edit: "تعديل",
  delete: "حذف",
  loading: "جارٍ التحميل...",
  roles: {
    SUPPORT: "موظف دعم",
    ADMIN: "مسؤول",
    SUPER_ADMIN: "مسؤول رئيسي"
  },
  stepChip: "بعد {minutes} د ← {role}",
  toasts: {
    nameRequired: "الاسم مطلوب",
    atLeastOneStep: "يجب إضافة خطوة واحدة على الأقل",
    stepMinutesInvalid: "الخطوة {n}: يجب أن تكون الدقائق ≥ 1",
    stepMinutesAscending: "يجب أن تحتوي الخطوة {n} على دقائق أعلى من الخطوة {prev}",
    updated: "تم تحديث مسار التصعيد",
    created: "تم إنشاء مسار التصعيد",
    saveFailed: "تعذّر الحفظ",
    loadFailed: "تعذّر تحميل مسارات التصعيد",
    confirmDelete: "حذف مسار التصعيد هذا؟",
    deleted: "تم حذف مسار التصعيد",
    deleteFailed: "تعذّر الحذف"
  }
};

fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n');
fs.writeFileSync(arPath, JSON.stringify(ar, null, 2) + '\n');
console.log('JSON files updated successfully');
