export const ROLE: Record<string, string> = { OWNER: 'مدیرعامل', MANAGER: 'مدیر', MEMBER: 'عضو تیم', INTERN: 'کارآموز' };
export const EMPLOYMENT: Record<string, string> = { FULL_TIME: 'تمام‌وقت', PART_TIME: 'پاره‌وقت', PROJECT_BASED: 'پروژه‌ای', CONTRACTOR: 'پیمانکار', INTERN: 'کارآموز', TRAINEE: 'دوره‌ی آموزشی', VOLUNTEER: 'داوطلب', PARTNER: 'شریک' };
export const PRIORITY: Record<string, string> = { CRITICAL: 'بحرانی', HIGH: 'بالا', MEDIUM: 'متوسط', LOW: 'پایین' };
export const TASK_STATUS: Record<string, string> = { NOT_STARTED: 'شروع‌نشده', IN_PROGRESS: 'در حال انجام', WAITING: 'در انتظار', BLOCKED: 'مسدود', COMPLETED: 'انجام‌شده', CANCELLED: 'لغو‌شده' };
export const TASK_TYPE: Record<string, string> = { ENGINEERING: 'مهندسی', MANUFACTURING: 'ساخت', SALES: 'فروش', MARKETING: 'بازاریابی', ADMINISTRATIVE: 'اداری', RESEARCH: 'پژوهش', FINANCIAL: 'مالی', MANAGEMENT: 'مدیریتی', TRAINING: 'آموزشی', FOLLOW_UP: 'پیگیری' };
export const PROJECT_STATUS: Record<string, string> = { PLANNING: 'برنامه‌ریزی', WAITING_APPROVAL: 'منتظر تأیید', ACTIVE: 'فعال', WAITING_PAYMENT: 'منتظر پرداخت', IN_PRODUCTION: 'در حال ساخت', BLOCKED: 'مسدود', COMPLETED: 'تکمیل‌شده', ARCHIVED: 'بایگانی' };
export const HEALTH: Record<string, string> = { HEALTHY: 'سالم', AT_RISK: 'در خطر', BLOCKED: 'مسدود', OVERDUE: 'دیرکرد', COMPLETED: 'تکمیل' };
export const REPORT_TYPE: Record<string, string> = { DAILY: 'روزانه', WEEKLY: 'هفتگی', PROJECT: 'پروژه' };
export const REPORT_STATE: Record<string, string> = { DRAFT: 'پیش‌نویس', SUBMITTED: 'ارسال‌شده', APPROVED: 'تأییدشده', RETURNED: 'برگشت برای اصلاح' };

export type Field = { key: string; label: string; long?: boolean; num?: boolean };
export const DAILY_FIELDS: Field[] = [
  { key: 'worked', label: 'امروز روی چه کاری کار کردم؟', long: true },
  { key: 'completed', label: 'چه چیزی تمام شد؟', long: true },
  { key: 'unfinished', label: 'چه چیزی ناتمام ماند؟', long: true },
  { key: 'problems', label: 'چه مشکلی پیش آمد؟', long: true },
  { key: 'blockers', label: 'چه چیزی جلوی کارم را گرفته؟', long: true },
  { key: 'needs', label: 'از مدیریت چه نیاز دارم؟', long: true },
  { key: 'next', label: 'قدم بعدی چیست؟', long: true },
  { key: 'hours', label: 'ساعت کار (اختیاری)', num: true },
];
export const WEEKLY_FIELDS: Field[] = [
  { key: 'completed', label: 'کارهای انجام‌شده', long: true },
  { key: 'ongoing', label: 'پیشرفت کارهای در جریان', long: true },
  { key: 'problems', label: 'مشکلات و تأخیرها', long: true },
  { key: 'blockers', label: 'موانع', long: true },
  { key: 'achievements', label: 'دستاوردها', long: true },
  { key: 'lessons', label: 'درس‌هایی که گرفتم', long: true },
  { key: 'nextPlan', label: 'برنامه‌ی هفته‌ی بعد', long: true },
  { key: 'support', label: 'پشتیبانی موردنیاز', long: true },
];
export const DEFAULT_CATEGORIES = ['طراحی صنعتی', 'مهندسی مکانیک', 'پژوهش و توسعه', 'نمونه‌سازی', 'ساخت دیجیتال', 'CNC', 'پرینت سه‌بعدی', 'لیزر', 'الکترونیک', 'محصولات سازمانی', 'محصولات تبلیغاتی', 'آموزش', 'توسعه‌ی داخلی', 'زیرساخت', 'فروش'];
export const DEFAULT_SKILLS = ['CAD', 'طراحی مکانیک', 'الکترونیک', 'PCB', 'CNC', 'لیزر', 'پرینت سه‌بعدی', 'برنامه‌نویسی', 'بازاریابی', 'فروش', 'عکاسی', 'فینیشینگ محصول'];
