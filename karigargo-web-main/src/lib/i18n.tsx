import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'ur';

interface Translations {
  [key: string]: string | Translations;
}

const translations = {
  en: {
    // Auth
    login: 'Login',
    signup: 'Sign Up',
    tagline: 'Har Kaam Ka Karigar, Bas Ek Tap Dur',
    email: 'Email',
    password: 'Password',
    phone: 'Phone Number',
    name: 'Full Name',
    city: 'City',
    cnic: 'CNIC Number',
    createAccount: 'Create Account',
    signIn: 'Sign In',
    signInWithGoogle: 'Sign in with Google',
    signUpWithGoogle: 'Sign up with Google',
    or: 'or',
    forgotPassword: 'Forgot Password?',
    alreadyHaveAccount: 'Already have an account?',
    dontHaveAccount: "Don't have an account?",
    customer: 'Customer',
    worker: 'Worker',
    customerRegistration: 'Customer Registration',
    workerRegistration: 'Worker Registration',
    hireWorkers: 'Hire Workers',
    findJobs: 'Find Jobs',
    uploadPhoto: 'Upload Photo',
    takeSelfie: 'Take Selfie',
    
    // Home
    postAJob: 'Post a Job',
    myJobs: 'My Jobs',
    messages: 'Messages',
    notifications: 'Notifications',
    profile: 'Profile',
    home: 'Home',
    ongoingJobs: 'Ongoing Jobs',
    completedJobs: 'Completed Jobs',
    serviceCategories: 'Service Categories',
    viewAll: 'View All',
    noOngoingJobs: 'No ongoing jobs',
    noCompletedJobs: 'No completed jobs yet',
    
    // Job
    postJob: 'Post Job',
    jobTitle: 'Job Title',
    jobDescription: 'Job Description',
    category: 'Category',
    budget: 'Budget (PKR)',
    date: 'Date',
    time: 'Time',
    location: 'Location',
    voiceNote: 'Voice Note (Explain the problem)',
    photosVideos: 'Photos & Videos (Please show the problem)',
    submit: 'Submit',
    
    // Profile
    personalInfo: 'Personal Information',
    changePassword: 'Change Password',
    preferences: 'Preferences',
    support: 'Support',
    helpSupport: 'Help & Support',
    faqsAndContact: 'FAQs and Contact',
    language: 'Language',
    logout: 'Logout',
    updatePassword: 'Update your password',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    confirmNewPassword: 'Confirm New Password',
    passwordRequirements: 'Password requirements:',
    atLeast6Chars: 'At least 6 characters',
    mixLettersNumbers: 'Mix of letters and numbers recommended',
    
    // Notifications
    noNotifications: 'No notifications',
    noNotificationsYet: 'You have no notifications yet',
    
    // Empty states
    noJobsFound: 'No jobs found',
    postJobToSee: 'Post a job to see it here',
    noJobsCompleted: 'No jobs completed till now',
    noJobsCancelled: 'No jobs cancelled till now',
    
    // General
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    ok: 'OK',
    back: 'Back',
    next: 'Next',
    submitRegistration: 'Submit Registration',
    skills: 'Skills',
    max3Skills: 'Max 3 skills',
    bio: 'Bio',
    aboutYourself: 'Tell customers about yourself',
    
    // Language names
    english: 'English',
    urdu: 'Urdu',
  },
  ur: {
    // Auth
    login: 'لاگ ان',
    signup: 'سائن اپ',
    email: 'ای میل',
    password: 'پاس ورڈ',
    phone: 'فون نمبر',
    name: 'پورا نام',
    city: 'شہر',
    cnic: 'شناختی کارڈ نمبر',
    createAccount: 'اکاؤنٹ بنائیں',
    signIn: 'سائن ان',
    signInWithGoogle: 'گوگل کے ساتھ سائن ان کریں',
    signUpWithGoogle: 'گوگل کے ساتھ سائن اپ کریں',
    or: 'یا',
    forgotPassword: 'پاس ورڈ بھول گئے؟',
    alreadyHaveAccount: 'پہلے سے اکاؤنٹ ہے؟',
    dontHaveAccount: 'اکاؤنٹ نہیں ہے؟',
    customer: 'کسٹمر',
    worker: 'کارکن',
    customerRegistration: 'کسٹمر رجسٹریشن',
    workerRegistration: 'کارکن رجسٹریشن',
    hireWorkers: 'کارکن کرائیں',
    findJobs: 'کام تلاش کریں',
    uploadPhoto: 'تصویر اپ لوڈ کریں',
    takeSelfie: 'سیلفی لیں',
    
    // Home
    postAJob: 'کام پوسٹ کریں',
    myJobs: 'میرے کام',
    messages: 'پیغامات',
    notifications: 'اطلاعات',
    profile: 'پروفائل',
    home: 'ہوم',
    ongoingJobs: 'جاری کام',
    completedJobs: 'مکمل شدہ کام',
    serviceCategories: 'خدمات کی اقسام',
    viewAll: 'سب دیکھیں',
    noOngoingJobs: 'کوئی جاری کام نہیں',
    noCompletedJobs: 'ابھی تک کوئی کام مکمل نہیں ہوا',
    
    // Job
    postJob: 'کام پوسٹ کریں',
    jobTitle: 'کام کا عنوان',
    jobDescription: 'کام کی تفصیل',
    category: 'زمرہ',
    budget: 'بجٹ (روپے)',
    date: 'تاریخ',
    time: 'وقت',
    location: 'مقام',
    voiceNote: 'وائس نوٹ (مسئلہ بتائیں)',
    photosVideos: 'تصاویر اور ویڈیوز (براہ کرم مسئلہ دکھائیں)',
    submit: 'جمع کرائیں',
    
    // Profile
    personalInfo: 'ذاتی معلومات',
    changePassword: 'پاس ورڈ تبدیل کریں',
    preferences: 'ترجیحات',
    support: 'مدد',
    helpSupport: 'مدد اور سپورٹ',
    language: 'زبان',
    logout: 'لاگ آؤٹ',
    updatePassword: 'پاس ورڈ اپڈیٹ کریں',
    currentPassword: 'موجودہ پاس ورڈ',
    newPassword: 'نیا پاس ورڈ',
    confirmNewPassword: 'نیا پاس ورڈ تصدیق کریں',
    passwordRequirements: 'پاس ورڈ کی ضروریات:',
    atLeast6Chars: 'کم از کم 6 حروف',
    mixLettersNumbers: 'حروف اور اعداد کا امتزاج تجویز کیا جاتا ہے',
    
    // Notifications
    noNotifications: 'کوئی اطلاعات نہیں',
    noNotificationsYet: 'آپ کو ابھی تک کوئی اطلاعات نہیں ہیں',
    
    // Empty states
    noJobsFound: 'کوئی کام نہیں ملا',
    postJobToSee: 'اسے دیکھنے کے لیے کام پوسٹ کریں',
    noJobsCompleted: 'ابھی تک کوئی کام مکمل نہیں ہوا',
    noJobsCancelled: 'ابھی تک کوئی کام منسوخ نہیں ہوا',
    
    // General
    save: 'محفوظ کریں',
    cancel: 'منسوخ کریں',
    edit: 'ترمیم کریں',
    delete: 'حذف کریں',
    loading: 'لوڈ ہو رہا ہے...',
    error: 'خرابی',
    success: 'کامیابی',
    ok: 'ٹھیک ہے',
    back: 'واپس',
    next: 'آگے',
    submitRegistration: 'رجسٹریشن جمع کرائیں',
    skills: 'مہارتیں',
    max3Skills: 'زیادہ سے زیادہ 3 مہارتیں',
    bio: 'بائیو',
    aboutYourself: 'گاہکوں کو اپنے بارے میں بتائیں',
    
    // Language names
    english: 'انگریزی',
    urdu: 'اردو',
  }
};

interface I18nContextType {
  language: Language;
  t: (key: string) => string;
  setLanguage: (lang: Language) => void;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Check localStorage for saved language preference
    const saved = localStorage.getItem('karigargo-language') as Language;
    return saved === 'ur' ? 'ur' : 'en';
  });

  const setLanguage = (lang: Language) => {
    localStorage.setItem('karigargo-language', lang);
    setLanguageState(lang);
    // Set document direction for RTL support
    document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
  };

  // Initialize direction on mount
  useEffect(() => {
    document.documentElement.dir = language === 'ur' ? 'rtl' : 'ltr';
  }, [language]);

  const t = (key: string): string => {
    const keys = key.split('.');
    let value: any = translations[language];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to English if key not found
        let fallback: any = translations.en;
        for (const fk of keys) {
          if (fallback && typeof fallback === 'object' && fk in fallback) {
            fallback = fallback[fk];
          } else {
            return key; // Return key if not found in any language
          }
        }
        return typeof fallback === 'string' ? fallback : key;
      }
    }
    
    return typeof value === 'string' ? value : key;
  };

  return (
    <I18nContext.Provider value={{ language, t, setLanguage }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
