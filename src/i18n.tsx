import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Lang = 'en' | 'bn'

/* ------------------------------------------------------------------ *
 * FOCUSO copy — authored in both languages from the start.
 * Bangla is natural and native, matching the brand voice: clear,
 * calm, practical, restrained. Proper nouns (FOCUSO, A5) and faith
 * terms stay familiar (নামাজ, কুরআন, দ্বীন).
 * ------------------------------------------------------------------ */
export type Dict = typeof en

const en = {
  nav: {
    links: [
      { href: '#inside', label: 'Inside the planner' },
      { href: '#how', label: 'How it works' },
      { href: '#faq', label: 'FAQ' },
    ],
    orderNow: 'Order the Planner',
    orderFull: 'Order the Planner',
    langLabel: 'Language',
  },
  hero: {
    label: 'The FOCUSO 60-day planner',
    tagline: 'Take control of your day.',
    title1: 'Small habits.',
    title2: 'Meaningful progress.',
    body: 'A 60-day productivity planner designed around real Muslim life — turning goals into small daily actions and bringing planning, habits, Salah and Qur\'an into one clear system.',
    order: 'Order the Planner',
    explore: 'Explore the planner',
    stats: [
      ['60', 'day system'],
      ['A5', 'format'],
      ['Undated', 'start anytime'],
    ],
  },
  tension: {
    heading: 'You have goals. But an unplanned day becomes reactive.',
    body1: 'Goals alone do not decide what you do today. Without a system, important actions get delayed, habits slip and Salah gets fitted around everything else.',
    body2: 'FOCUSO gives your day structure — so you know your priorities, plan when to act and keep returning to the routine.',
    cards: [
      'Goals without a daily plan',
      'Important tasks left for later',
      'Habits half-remembered',
      'Salah fitted around the day',
    ],
  },
  system: {
    label: 'How it works',
    heading: 'From intention to consistent action.',
    body: 'The monthly, weekly and daily pages connect — so a goal set once becomes a small action you can repeat today. Plan it. Track it. Keep showing up.',
    steps: [
      { label: 'Plan the month', body: 'Set monthly goals, top priorities, habit focus and personal growth — including a faith goal.' },
      { label: 'Shape the week', body: 'Turn priorities into a weekly plan with a Deen goal, events, deadlines and weekly habits.' },
      { label: 'Act and track daily', body: 'A full schedule beside priorities, tasks, Salah, Qur\'an and daily habits — everything in one place, every day.' },
    ],
  },
  inside: {
    label: 'Inside the planner',
    heading: 'A closer look at the real pages.',
    body: 'Not a feature grid — just the parts of the system you\'ll use every day, taken straight from the planner and given room to breathe.',
    daily: {
      label: 'The daily page',
      body: 'One page holds the whole day: a full schedule, your top three priorities, tasks, Salah, daily habits and a short Qur\'an verse to begin with intention. Faith sits inside the routine as function — never as decoration.',
      alt: 'A student writing in the FOCUSO planner at a calm desk',
    },
    pages: [
      { label: 'The monthly page', body: 'Monthly goals, top priorities, habit focus, important events and personal growth — including a faith goal.' },
      { label: 'The weekly page', body: 'A Deen goal, weekly priorities, a habit grid, events and deadlines — the bridge from month to day.' },
    ],
    breakdown: {
      caption: 'What lives on the daily page',
      schedule: {
        head: 'Today\'s schedule',
        title: 'Today\'s schedule',
        desc: 'An hour-by-hour timeline from Fajr to late evening.',
        times: ['08 AM', '10 AM', '12 PM', '02 PM', '04 PM'],
      },
      salah: {
        head: 'Salah',
        sub: 'Five daily prayers',
        title: 'Salah',
        desc: 'The five daily prayers, tracked inside the day itself.',
        prayers: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'],
      },
      habits: {
        head: 'Weekly habits',
        sub: 'Stay consistent',
        title: 'Weekly habits',
        desc: 'A simple grid to stay consistent, Qur\'an included.',
        days: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
        rows: ['Qur\'an', 'Read', 'Walk'],
      },
      verse: {
        head: 'Qur\'an',
        ref: '94:6',
        title: 'Daily Qur\'an verse',
        desc: 'A short ayah at the top of every daily page.',
        text: 'Indeed, with hardship [will be] ease.',
      },
    },
  },
  habitTracker: {
    label: 'Habit Tracker',
    heading: 'What you repeat shapes your progress.',
    body: 'Big goals are rarely built through one highly motivated day. They are built through the small actions you keep doing. FOCUSO\'s Habit Tracker helps you choose the habits that matter, see your consistency and keep returning to them — day after day.',
    points: [
      'Choose a few habits connected to your goals',
      'See whether you are actually following through',
      'Build awareness of your consistency over time',
      'Return to the routine after an imperfect day',
    ],
    compound: 'One small action may not feel significant. Repeated over days and weeks, those actions add up.',
    alt: 'The FOCUSO Habit Tracker page showing weekly habit consistency',
  },
  differentiator: {
    heading1: 'Muslim by design.',
    heading2: 'Not by decoration.',
    body: 'FOCUSO doesn\'t add faith as ornament around a generic planner. Salah, Qur\'an, priorities, responsibilities, habits and personal growth are treated as parts of one daily routine — useful, restrained and naturally aligned with Muslim life.',
    quote: 'যা গুরুত্বপূর্ণ, তার পরিকল্পনা করুন। ধারাবাহিক থাকুন।',
  },
  sixtyDay: {
    label: 'Why 60 days',
    heading: 'Give consistency time to build.',
    body: 'Choose what matters. Break it into actions you can repeat. Track your consistency. Then keep showing up for the next 60 days. You do not need a perfect day — you need a system you can return to.',
    points: [
      'A focused, manageable planning horizon',
      'Room to build consistency, day by day',
      'Motivation comes and goes — the routine holds',
      'Progress you can actually see over time',
    ],
    alt: 'A student planning the week with the FOCUSO planner at a desk',
  },
  details: {
    label: 'Product details',
    heading: 'FOCUSO 60-Day Planner',
    body: 'Only confirmed specifications are shown. Remaining details appear as clearly marked placeholders until finalised.',
    confirmed: [
      ['Format', 'A5'],
      ['Planning system', 'Undated · 60-day'],
      ['Planning layers', 'Monthly · Weekly · Daily'],
      ['Included', 'Habit tracking'],
      ['Faith integration', 'Salah'],
      ['Faith integration', 'Qur\'an'],
    ],
    placeholders: [
      ['Paper specification', '[Paper specification]'],
      ['Page count', '[Page count]'],
      ['Binding', '[Binding specification]'],
      ['Cover material', '[Cover material]'],
    ],
  },
  purchase: {
    label: 'Order',
    heading: 'FOCUSO Daily Planner',
    body: 'Undated A5 planner with monthly, weekly and daily layers — habits, Salah and Qur\'an built into the daily routine.',
    price: '৳250',
    priceNote: '+ ৳60 delivery charge',
    order: 'Order the Planner',
    footnote: 'Undated · A5 · 60-day system · Cash on delivery available',
  },
  faq: {
    label: 'FAQ',
    heading: 'Questions, answered plainly.',
    items: [
      ['What is the FOCUSO planner?', 'A premium, undated 60-day productivity planner built around real Muslim life — bringing goals, daily planning, habits, Salah and Qur\'an into one clear system.'],
      ['Is the planner dated?', 'No. It is undated, so you can start on any day and keep your rhythm without wasted pages.'],
      ['Who is FOCUSO designed for?', 'University students, competitive exam candidates and young professionals who want more structure, consistency and intention in daily life.'],
      ['What is the return or exchange policy?', '[Return and exchange policy]'],
    ],
  },
  finalCta: {
    title1: 'Plan it.',
    title2: 'Track it. Repeat it.',
    title3: 'Keep showing up for the next 60 days.',
    order: 'Order the Planner',
  },
  footer: {
    tagline: 'A practical system for building consistency, day by day.',
    links: [
      ['FAQ', '#faq'],
      ['Delivery', '#'],
      ['Returns', '#'],
      ['Privacy', '#'],
      ['Terms', '#'],
    ],
    copyright: (year: number) => `© ${year} FOCUSO · Designed for real Muslim life, in Bangladesh.`,
  },
  checkout: {
    back: 'Back',
    title: 'Checkout',
    subtitle: 'One product. A short, calm form. No account needed.',
    deliveryDetails: 'Delivery details',
    deliveryZone: {
      label: 'Delivery area',
      inside: 'Inside Chittagong',
      insidePrice: '৳60',
      outside: 'Outside Chittagong',
      outsidePrice: '৳100',
    },
    fields: {
      name: { label: 'Full name', ph: 'Your name' },
      phone: { label: 'Phone number', ph: '01XXXXXXXXX' },
      district: { label: 'District', ph: 'Select your district' },
      city: { label: 'Thana / Area', ph: 'e.g. Mirpur, Agrabad, Sadar' },
      address: { label: 'Delivery address', ph: 'House, road, landmark, full address' },
      notes: { label: 'Order notes', ph: 'Anything we should know (optional)' },
      coupon: {
        label: 'Coupon code',
        ph: 'Promo code (optional)',
        apply: 'Apply',
        eligibleHeading: 'Eligible promo codes',
        offerTitle: '25% OFF',
        offerSubtitle: 'On planner price',
        applied: 'FOCUS25 applied',
        discountAppliedText: '25% discount applied',
        remove: 'Remove',
        invalid: 'Invalid coupon code',
      },
    },
    paymentMethod: 'Payment method',
    cod: 'Cash on delivery',
    codDesc: 'Pay when you receive your order',
    bkash: 'bKash',
    bkashDesc: 'Pay now using bKash Send Money',
    bkashSendMoneyTo: 'Send Money to',
    bkashAmountToSend: 'Amount to send',
    bkashCopy: 'Copy',
    bkashCopied: 'Copied!',
    bkashInstructionsTitle: 'bKash Payment Steps',
    bkashStep1: 'Open your bKash app.',
    bkashStep2: 'Choose Send Money.',
    bkashStep3: 'Send the exact amount shown above to the displayed number.',
    bkashStep4: 'Copy the bKash Transaction ID (TrxID) from your confirmation SMS or statement.',
    bkashStep5: 'Enter the TrxID below and place your order.',
    bkashTrxIdLabel: 'bKash Transaction ID (TrxID)',
    bkashTrxIdPh: 'e.g. 9M87XTR23A',
    bkashTrxIdHelp: 'Enter the alphanumeric Transaction ID received after sending money.',
    bkashPriceChangedWarning: 'Order amount changed. Please verify your bKash payment details again.',
    orderSummary: 'Order summary',
    productName: 'FOCUSO Daily Planner',
    productMeta: 'Undated · A5 · 60-Day System',
    subtotal: 'FOCUSO Daily Planner',
    delivery: 'Delivery charge',
    discount: 'Coupon discount',
    total: 'Final total',
    calculatedAfterDistrict: 'Calculated after district selection',
    completeDetails: 'Complete the required details to place your order.',
    quantityLabel: 'Quantity',
    trust: ['No account required', 'Secure order processing', 'Pay on delivery available'],
    validation: {
      name: 'Enter your full name.',
      phone: 'Enter a valid Bangladeshi phone number.',
      district: 'Select your district.',
      city: 'Enter your thana / area.',
      address: 'Enter your delivery address.',
      bkashTrxId: 'Enter a valid bKash Transaction ID.',
    },
    placeOrder: 'Place order',
    safeNote: 'Safe, simple checkout · No account required',
  },
  confirmation: {
    title: 'Your order is confirmed.',
    body: 'Thank you. We\'ve received your order for the FOCUSO Daily Planner and will be in touch with delivery details shortly.',
    orderRef: 'Order reference',
    delivery: 'Delivery',
    deliveryVal: '2–3 business days (across Bangladesh)',
    payment: 'Payment',
    paymentVal: 'Cash on delivery',
    back: 'Back to FOCUSO',
  },
}

const bn: Dict = {
  nav: {
    links: [
      { href: '#inside', label: 'প্ল্যানারের ভেতরে' },
      { href: '#how', label: 'কীভাবে কাজ করে' },
      { href: '#faq', label: 'প্রশ্নোত্তর' },
    ],
    orderNow: 'প্ল্যানারটি অর্ডার করুন',
    orderFull: 'প্ল্যানারটি অর্ডার করুন',
    langLabel: 'ভাষা',
  },
  hero: {
    label: 'FOCUSO ৬০ দিনের প্ল্যানার',
    tagline: 'নিজের দিনটাকে নিজের নিয়ন্ত্রণে আনুন।',
    title1: 'ছোট অভ্যাস।',
    title2: 'নিয়মিত অগ্রগতি।',
    body: 'সত্যিকারের মুসলিম জীবনকে কেন্দ্র করে তৈরি ৬০ দিনের একটি প্রডাক্টিভিটি প্ল্যানার — লক্ষ্যকে ছোট দৈনন্দিন কাজে রূপ দেয় এবং পরিকল্পনা, অভ্যাস, নামাজ ও কুরআনকে একটি পরিষ্কার সিস্টেমে নিয়ে আসে।',
    order: 'প্ল্যানারটি অর্ডার করুন',
    explore: 'প্ল্যানারটি দেখুন',
    stats: [
      ['৬০', 'দিনের সিস্টেম'],
      ['A5', 'সাইজ'],
      ['আনডেটেড', 'যেকোনো দিন শুরু'],
    ],
  },
  tension: {
    heading: 'আপনার লক্ষ্য আছে। কিন্তু পরিকল্পনা ছাড়া দিনটা ছুটে যায়।',
    body1: 'শুধু লক্ষ্য থাকলেই আজকের কাজ ঠিক হয় না। সিস্টেম না থাকলে গুরুত্বপূর্ণ কাজ পিছিয়ে যায়, অভ্যাস হারিয়ে যায় এবং নামাজ সবকিছুর ফাঁকে ফাঁকে বসে।',
    body2: 'FOCUSO দিনটাকে একটা কাঠামো দেয় — যাতে আপনি জানেন কোনটা আগে, কখন করবেন, আর রুটিনে ফিরতে পারেন বারবার।',
    cards: [
      'পরিকল্পনা ছাড়া লক্ষ্য',
      'গুরুত্বপূর্ণ কাজ পরের জন্য রাখা',
      'অর্ধেক মনে রাখা অভ্যাস',
      'দিনের ফাঁকে গুঁজে নেওয়া নামাজ',
    ],
  },
  system: {
    label: 'কীভাবে কাজ করে',
    heading: 'উদ্দেশ্য থেকে নিয়মিত কাজে।',
    body: 'মাসিক, সাপ্তাহিক ও দৈনন্দিন পাতাগুলো একে অপরের সঙ্গে যুক্ত — তাই একবার ঠিক করা লক্ষ্য আজকের ছোট কাজ হয়ে যায়। পরিকল্পনা করুন। ট্র্যাক করুন। প্রতিদিন ফিরে আসুন।',
    steps: [
      { label: 'মাসের পরিকল্পনা', body: 'মাসিক লক্ষ্য, প্রধান প্রাধান্য, অভ্যাসের লক্ষ্য ও নিজের বিকাশ — একটি দ্বীনি লক্ষ্যসহ ঠিক করুন।' },
      { label: 'সপ্তাহ সাজান', body: 'প্রাধান্যগুলোকে একটি সাপ্তাহিক পরিকল্পনায় রূপ দিন — দ্বীনি লক্ষ্য, ইভেন্ট, ডেডলাইন ও সাপ্তাহিক অভ্যাসসহ।' },
      { label: 'প্রতিদিন করুন ও ট্র্যাক করুন', body: 'প্রাধান্য, কাজ, নামাজ, কুরআন ও দৈনন্দিন অভ্যাসের পাশে একটি পূর্ণ সূচি — সবকিছু এক জায়গায়, প্রতিদিন।' },
    ],
  },
  inside: {
    label: 'প্ল্যানারের ভেতরে',
    heading: 'সত্যিকারের পাতাগুলোর কাছ থেকে দেখা।',
    body: 'এটি ফিচারের তালিকা নয় — শুধু সিস্টেমের সেই অংশগুলো যা আপনি প্রতিদিন ব্যবহার করবেন, প্ল্যানার থেকে সরাসরি নেওয়া।',
    daily: {
      label: 'দৈনন্দিন পাতা',
      body: 'একটি পাতাতে পুরো দিন: একটি পূর্ণ সূচি, আপনার শীর্ষ তিনটি প্রাধান্য, কাজ, নামাজ, দৈনন্দিন অভ্যাস আর উদ্দেশ্য নিয়ে দিন শুরু করার একটি সংক্ষিপ্ত কুরআনের আয়াত। সার্বক্ষণ রুটিনের ভেতরেই থাকে দ্বীন — কাজের অংশ হিসেবে, সাজসজ্জা হিসেবে নয়।',
      alt: 'শান্ত একটি ডেস্কে FOCUSO প্ল্যানারে লিখছেন একজন শিক্ষার্থী',
    },
    pages: [
      { label: 'মাসিক পাতা', body: 'মাসিক লক্ষ্য, প্রধান প্রাধান্য, অভ্যাসের লক্ষ্য, গুরুত্বপূর্ণ ইভেন্ট ও নিজের বিকাশ — একটি দ্বীনি লক্ষ্যসহ।' },
      { label: 'সাপ্তাহিক পাতা', body: 'একটি দ্বীনি লক্ষ্য, সাপ্তাহিক প্রাধান্য, একটি অভ্যাস গ্রিড, ইভেন্ট ও ডেডলাইন — মাস থেকে দিনের সেতু।' },
    ],
    breakdown: {
      caption: 'দৈনন্দিন পাতায় যা যা থাকে',
      schedule: {
        head: 'আজকের সূচি',
        title: 'আজকের সূচি',
        desc: 'ফজর থেকে রাত পর্যন্ত ঘণ্টা ধরে সাজানো একটি সময়সূচি।',
        times: ['08 AM', '10 AM', '12 PM', '02 PM', '04 PM'],
      },
      salah: {
        head: 'নামাজ',
        sub: 'পাঁচ ওয়াক্ত',
        title: 'নামাজ',
        desc: 'পাঁচ ওয়াক্ত নামাজ, দিনের ভেতরেই ট্র্যাক করা।',
        prayers: ['ফজর', 'যোহর', 'আসর', 'মাগরিব', 'ইশা'],
      },
      habits: {
        head: 'সাপ্তাহিক অভ্যাস',
        sub: 'ধারাবাহিক থাকুন',
        title: 'সাপ্তাহিক অভ্যাস',
        desc: 'ধারাবাহিক থাকার সহজ একটি গ্রিড, কুরআনসহ।',
        days: ['রব', 'সো', 'মঙ', 'বু', 'বৃ', 'শু', 'শ'],
        rows: ['কুরআন', 'পড়া', 'হাঁটা'],
      },
      verse: {
        head: 'কুরআন',
        ref: '৯৪:৬',
        title: 'দৈনিক কুরআনের আয়াত',
        desc: 'প্রতিটি দৈনন্দিন পাতার শুরুতে একটি সংক্ষিপ্ত আয়াত।',
        text: 'নিশ্চয়ই কষ্টের সাথেই স্বস্তি রয়েছে।',
      },
    },
  },
  habitTracker: {
    label: 'Habit Tracker',
    heading: 'যা আপনি বারবার করেন, তাই আপনার অগ্রগতি গড়ে।',
    body: 'বড় লক্ষ্য এক উদ্যমী দিনে তৈরি হয় না। তৈরি হয় প্রতিদিনের ছোট কাজ থেকে। FOCUSO-এর Habit Tracker আপনাকে গুরুত্বপূর্ণ অভ্যাসগুলো বেছে নিতে, নিজের ধারাবাহিকতা দেখতে এবং প্রতিদিন সেই অভ্যাসে ফিরে আসতে সাহায্য করে।',
    points: [
      'লক্ষ্যের সাথে জুড়ে কয়েকটি অভ্যাস বেছে নিন',
      'আপনি আসলেই করছেন কিনা তা দেখুন',
      'সময়ের সাথে নিজের ধারাবাহিকতা সম্পর্কে সচেতন হন',
      'অসম্পূর্ণ দিনের পরেও রুটিনে ফিরে আসুন',
    ],
    compound: 'একটি ছোট কাজ তেমন গুরুত্বপূর্ণ মনে না-ও হতে পারে। কিন্তু দিনের পর দিন করলে, সেই কাজগুলো একসাথে অনেক কিছু তৈরি করে।',
    alt: 'FOCUSO Habit Tracker পাতা যেখানে সাপ্তাহিক অভ্যাসের ধারাবাহিকতা দেখা যাচ্ছে',
  },
  differentiator: {
    heading1: 'ডিজাইনেই মুসলিম।',
    heading2: 'সাজসজ্জায় নয়।',
    body: 'FOCUSO একটি সাধারণ প্ল্যানারের গায়ে দ্বীনকে অলংকার হিসেবে জুড়ে দেয় না। নামাজ, কুরআন, প্রাধান্য, দায়িত্ব, অভ্যাস ও নিজের বিকাশকে একটি দৈনন্দিন রুটিনের অংশ হিসেবে দেখা হয় — কার্যকর, সংযত ও মুসলিম জীবনের সাথে স্বাভাবিকভাবে মানানসই।',
    quote: 'যা গুরুত্বপূর্ণ, তার পরিকল্পনা করুন। ধারাবাহিক থাকুন।',
  },
  sixtyDay: {
    label: 'কেন ৬০ দিন',
    heading: 'ধারাবাহিকতাকে সময় দিন।',
    body: 'কোনটা গুরুত্বপূর্ণ তা বেছে নিন। সেটাকে ছোট ছোট কাজে ভাগ করুন। ধারাবাহিকতা ট্র্যাক করুন। তারপর আগামী ৬০ দিন ধরে ফিরে আসতে থাকুন। নিখুঁত দিন লাগবে না — লাগবে এমন একটি সিস্টেম যেখানে ফিরে আসা যায়।',
    points: [
      'একটি মনোযোগী, সামলানো পরিকল্পনার সীমা',
      'দিনে দিনে ধারাবাহিকতা গড়ার সুযোগ',
      'অনুপ্রেরণা আসে-যায় — রুটিন ধরে রাখে',
      'সময়ের সাথে যে অগ্রগতি আপনি সত্যিই দেখতে পাবেন',
    ],
    alt: 'একটি ডেস্কে FOCUSO প্ল্যানারে সপ্তাহের পরিকল্পনা করছেন একজন শিক্ষার্থী',
  },
  details: {
    label: 'পণ্যের বিবরণ',
    heading: 'FOCUSO ৬০ দিনের প্ল্যানার',
    body: 'শুধু নিশ্চিত হওয়া স্পেসিফিকেশনগুলো দেখানো হয়েছে। বাকি তথ্য চূড়ান্ত না হওয়া পর্যন্ত স্পষ্ট প্লেসহোল্ডার হিসেবে থাকবে।',
    confirmed: [
      ['ফর্ম্যাট', 'A5'],
      ['পরিকল্পনা সিস্টেম', 'আনডেটেড · ৬০ দিন'],
      ['পরিকল্পনার স্তর', 'মাসিক · সাপ্তাহিক · দৈনন্দিন'],
      ['অন্তর্ভুক্ত', 'অভ্যাস ট্র্যাকিং'],
      ['দ্বীনি সংযোজন', 'নামাজ'],
      ['দ্বীনি সংযোজন', 'কুরআন'],
    ],
    placeholders: [
      ['কাগজের বিবরণ', '[কাগজের বিবরণ]'],
      ['পাতার সংখ্যা', '[পাতার সংখ্যা]'],
      ['বাইন্ডিং', '[বাইন্ডিংয়ের বিবরণ]'],
      ['কভার ম্যাটেরিয়াল', '[কভার ম্যাটেরিয়াল]'],
    ],
  },
  purchase: {
    label: 'অর্ডার',
    heading: 'FOCUSO ডেইলি প্ল্যানার',
    body: 'আনডেটেড A5 প্ল্যানার, মাসিক, সাপ্তাহিক ও দৈনন্দিন স্তরসহ — অভ্যাস, নামাজ ও কুরআন দৈনন্দিন রুটিনের ভেতরেই গাঁথা।',
    price: '৳২৫০',
    priceNote: '+ ৬০ টাকা ডেলিভারি চার্জ',
    order: 'প্ল্যানারটি অর্ডার করুন',
    footnote: 'আনডেটেড · A5 · ৬০ দিনের সিস্টেম · ক্যাশ অন ডেলিভারি সুবিধা',
  },
  faq: {
    label: 'প্রশ্নোত্তর',
    heading: 'প্রশ্নের সহজ উত্তর।',
    items: [
      ['FOCUSO প্ল্যানারটি কী?', 'সত্যিকারের মুসলিম জীবনকে কেন্দ্র করে তৈরি একটি প্রিমিয়াম, আনডেটেড ৬০ দিনের প্রডাক্টিভিটি প্ল্যানার — লক্ষ্য, দৈনন্দিন পরিকল্পনা, অভ্যাস, নামাজ ও কুরআনকে একটি পরিষ্কার সিস্টেমে একত্র করে।'],
      ['প্ল্যানারটি কি ডেট দেওয়া?', 'না। এটি আনডেটেড, তাই আপনি যেকোনো দিন শুরু করতে পারেন এবং কোনো পাতা নষ্ট না করেই ছন্দ ধরে রাখতে পারেন।'],
      ['FOCUSO কাদের জন্য তৈরি?', 'বিশ্ববিদ্যালয়ের শিক্ষার্থী, প্রতিযোগিতামূলক পরীক্ষার্থী এবং তরুণ পেশাজীবীদের জন্য, যারা দৈনন্দিন জীবনে আরও গঠন, ধারাবাহিকতা ও উদ্দেশ্য চান।'],
      ['রিটার্ন বা এক্সচেঞ্জ নীতি কী?', '[রিটার্ন ও এক্সচেঞ্জ নীতি]'],
    ],
  },
  finalCta: {
    title1: 'পরিকল্পনা করুন।',
    title2: 'ট্র্যাক করুন। বারবার করুন।',
    title3: 'আগামী ৬০ দিন ধরে ফিরে আসতে থাকুন।',
    order: 'প্ল্যানারটি অর্ডার করুন',
  },
  footer: {
    tagline: 'প্রতিদিনের ধারাবাহিকতা গড়ার একটি বাস্তব সিস্টেম।',
    links: [
      ['প্রশ্নোত্তর', '#faq'],
      ['ডেলিভারি', '#'],
      ['রিটার্ন', '#'],
      ['গোপনীয়তা', '#'],
      ['শর্তাবলী', '#'],
    ],
    copyright: (year: number) => `© ${year} FOCUSO · বাংলাদেশে, সত্যিকারের মুসলিম জীবনের জন্য ডিজাইন করা।`,
  },
  checkout: {
    back: 'ফিরে যান',
    title: 'চেকআউট',
    subtitle: 'একটি পণ্য। সংক্ষিপ্ত, শান্ত একটি ফর্ম। কোনো অ্যাকাউন্ট লাগবে না।',
    deliveryDetails: 'ডেলিভারির তথ্য',
    deliveryZone: {
      label: 'ডেলিভারি এলাকা',
      inside: 'চট্টগ্রামের ভেতর',
      insidePrice: '৳৬০',
      outside: 'চট্টগ্রামের বাইরে',
      outsidePrice: '৳১০০',
    },
    fields: {
      name: { label: 'পূর্ণ নাম', ph: 'আপনার নাম' },
      phone: { label: 'ফোন নম্বর', ph: '01XXXXXXXXX' },
      district: { label: 'জেলা', ph: 'জেলা নির্বাচন করুন' },
      city: { label: 'থানা / এলাকা', ph: 'যেমন মিরপুর, আগ্রাবাদ, সদর' },
      address: { label: 'ডেলিভারি ঠিকানা', ph: 'বাসা, রোড, এলাকা, পূর্ণ ঠিকানা' },
      notes: { label: 'অর্ডার নোট', ph: 'আমাদের জানার মতো কিছু (ঐচ্ছিক)' },
      coupon: {
        label: 'কুপন কোড',
        ph: 'প্রোমো কোড (ঐচ্ছিক)',
        apply: 'প্রয়োগ',
        eligibleHeading: 'উপলব্ধ প্রোমো কোড',
        offerTitle: '২৫% ছাড়',
        offerSubtitle: 'প্ল্যানারের মূল্যে',
        applied: 'FOCUS25 যুক্ত হয়েছে',
        discountAppliedText: '২৫% ছাড় সফলভাবে প্রযোজ্য হয়েছে',
        remove: 'মুছে ফেলুন',
        invalid: 'কুপন কোডটি সঠিক নয়',
      },
    },
    paymentMethod: 'পেমেন্ট পদ্ধতি',
    cod: 'ক্যাশ অন ডেলিভারি',
    codDesc: 'পণ্য হাতে পেয়ে মূল্য পরিশোধ করুন',
    bkash: 'bKash',
    bkashDesc: 'bKash সেন্ড মানি করে এখনই পরিশোধ করুন',
    bkashSendMoneyTo: 'সেন্ড মানি করুন',
    bkashAmountToSend: 'প্রদেয় মোট টাকা',
    bkashCopy: 'কপি',
    bkashCopied: 'কপি হয়েছে!',
    bkashInstructionsTitle: 'bKash পেমেন্ট নির্দেশিকা',
    bkashStep1: 'আপনার bKash অ্যাপ ওপেন করুন।',
    bkashStep2: 'Send Money অপশন বেছে নিন।',
    bkashStep3: 'উপরে উল্লেখিত নম্বরে প্রদর্শিত সঠিক পরিমাণ টাকা পাঠান।',
    bkashStep4: 'এসএমএস বা বিবরণী থেকে bKash ট্রানজেকশন আইডি (TrxID) কপি করুন।',
    bkashStep5: 'নিচে TrxID লিখুন এবং অর্ডার সম্পন্ন করুন।',
    bkashTrxIdLabel: 'bKash ট্রানজেকশন আইডি (TrxID)',
    bkashTrxIdPh: 'যেমন 9M87XTR23A',
    bkashTrxIdHelp: 'টাকা পাঠানোর পর প্রাপ্ত ট্রানজেকশন আইডিটি এখানে লিখুন।',
    bkashPriceChangedWarning: 'অর্ডারের মোট টাকার পরিমাণ পরিবর্তিত হয়েছে। অনুগ্রহ করে আপনার bKash পেমেন্টের তথ্য পুনরায় যাচাই করুন।',
    orderSummary: 'অর্ডার সামারি',
    productName: 'FOCUSO ডেইলি প্ল্যানার',
    productMeta: 'আনডেটেড · A5 · ৬০ দিনের সিস্টেম',
    subtotal: 'FOCUSO ডেইলি প্ল্যানার',
    delivery: 'ডেলিভারি চার্জ',
    discount: 'কুপন ছাড়',
    total: 'সর্বমোট',
    calculatedAfterDistrict: 'জেলা নির্বাচন করার পরে হিসাব হবে',
    completeDetails: 'অর্ডার করতে প্রয়োজনীয় তথ্য সম্পূর্ণ করুন।',
    quantityLabel: 'পরিমাণ',
    trust: ['কোনো অ্যাকাউন্ট লাগবে না', 'নিরাপদ অর্ডার প্রক্রিয়া', 'ডেলিভারির সময় পেমেন্ট'],
    validation: {
      name: 'আপনার পূর্ণ নাম লিখুন।',
      phone: 'সঠিক বাংলাদেশি ফোন নম্বর লিখুন।',
      district: 'আপনার জেলা নির্বাচন করুন।',
      city: 'আপনার থানা / এলাকা লিখুন।',
      address: 'আপনার ডেলিভারি ঠিকানা লিখুন।',
      bkashTrxId: 'সঠিক bKash ট্রানজেকশন আইডি লিখুন।',
    },
    placeOrder: 'অর্ডার কনফার্ম করুন',
    safeNote: 'নিরাপদ, সহজ চেকআউট · কোনো অ্যাকাউন্ট লাগবে না',
  },
  confirmation: {
    title: 'আপনার অর্ডার নিশ্চিত হয়েছে।',
    body: 'ধন্যবাদ। আমরা FOCUSO ডেইলি প্ল্যানারের জন্য আপনার অর্ডার পেয়েছি এবং শীগ্রই ডেলিভারির তথ্য নিয়ে যোগাযোগ করব।',
    orderRef: 'অর্ডার রেফারেন্স',
    delivery: 'ডেলিভারি',
    deliveryVal: '২–৩ কার্যদিবস (সারা বাংলাদেশ)',
    payment: 'পেমেন্ট',
    paymentVal: 'ক্যাশ অন ডেলিভারি',
    back: 'FOCUSO এ ফিরে যান',
  },
}

const dicts: Record<Lang, Dict> = { en, bn }

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: Dict }
const LanguageContext = createContext<Ctx | null>(null)

const STORAGE_KEY = 'focuso-lang'

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'en'
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved === 'bn' || saved === 'en' ? saved : 'en'
  })

  const setLang = (l: Lang) => {
    setLangState(l)
    try { window.localStorage.setItem(STORAGE_KEY, l) } catch { /* ignore */ }
  }

  // Drive font + spacing switching from the document root (see index.css).
  useEffect(() => {
    document.documentElement.setAttribute('data-lang', lang)
    document.documentElement.setAttribute('lang', lang === 'bn' ? 'bn' : 'en')
  }, [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: dicts[lang] }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang(): Ctx {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used within LanguageProvider')
  return ctx
}
