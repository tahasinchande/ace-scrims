"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

export type Language = "en" | "bn"

type LanguageContextType = {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: string, defaultText?: string) => string
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    nav_home: "Home",
    nav_scrims: "Scrims",
    nav_results: "Results",
    nav_report: "Report",
    nav_tutorial: "Tutorial",
    nav_how_it_works: "How It Works",
    nav_faq: "FAQ",
    nav_contact: "Contact",
    nav_admin: "Admin",
    nav_dashboard: "Dashboard",
    nav_signin: "Sign In",
    nav_join: "Join Now",
    brand_desc: "Bangladesh's premium Free Fire scrim platform. 12 competitive lobbies every night.",

    // Hero
    hero_eyebrow: "Daily Esports Lobbies · 7 PM to 12 AM",
    hero_title: "ACE SCRIMS",
    hero_h2: "DOMINATE THE LOBBY EVERY NIGHT",
    hero_subtitle: "Bangladesh's most competitive Free Fire scrims. Daily competitive lobbies, instant booking, automatic bKash/Nagad payments, and cash prize pool. Your squad vs the best.",
    browse_scrims: "Browse Scrims",
    view_results: "View Results",
    scrims_tonight: "Scrims Tonight",
    team_slots: "Team Slots",
    nightly_prizes: "Nightly Prizes",

    // Scrim Explorer
    tonight_schedule_eyebrow: "Tonight's Schedule",
    tonight_schedule_title: "Scrim Lobbies. Pick your hour.",
    tonight_schedule_subtitle: "Every scrim runs for one hour with 12 team slots. Book before they fill.",
    todays_scrims_title: "Today's Scrims",
    todays_scrims_subtitle: "Competitive lobbies scheduled daily. Entry is from ৳35 per squad, 12 teams max. Book your slot before the lobby fills.",
    search_scrims_placeholder: "Search time, map or mode...",
    filter_all: "All",
    status_open: "OPEN",
    status_filling: "FILLING FAST",
    status_full: "FULL",
    status_live: "LIVE NOW",
    status_completed: "COMPLETED",
    price_label: "Entry Fee",
    prize_label: "Prize Pool",
    map_label: "Map",
    mode_label: "Mode",
    book_now: "Book Now",
    view_details: "View Details",
    lobby_full: "Lobby Full",
    slots_left: "slots left",
    confirmed_teams: "Confirmed Teams",

    // Scrim Details
    facilities_heading: "Facilities & Rewards",
    facility_1: "Top 3 Prize Pool",
    facility_2: "Top 3 Face Banner",
    facility_3: "MVP Face Banner",
    facility_4: "Overall Standing Banner",
    facility_5: "Receive payment within 6 hours of result publication (Max 24h)",
    rules_heading: "Rules & Format",
    notes_heading: "Important Notes",
    matches_per_scrim: "3 Matches · Bermuda, Purgatory & Kalahari",

    // How it works
    how_eyebrow: "How It Works",
    how_title: "From booking to booyah in 4 steps",
    how_subtitle: "The entire flow is automatic. Book, pay, play — no admins to chase.",
    step1_title: "Pick a Scrim",
    step1_body: "12 lobbies every night from 7 PM to 12 AM. Choose your time, check the map and prize pool.",
    step2_title: "Pay ৳35",
    step2_body: "Checkout with bKash or Nagad. Payment is verified automatically in seconds.",
    step3_title: "Get Room Details",
    step3_body: "Enter your squad info. Room ID and password appear in your dashboard before match time.",
    step4_title: "Play & Win",
    step4_body: "Drop in, top the lobby, and get your prize. Results and payouts published the same night.",

    // Features
    features_eyebrow: "Why Ace Scrims",
    features_title: "Built for serious squads",
    features_subtitle: "Everything a competitive Free Fire team needs — automated, transparent and fast.",
    feat1_title: "Instant Auto Payment",
    feat1_body: "Pay with bKash or Nagad through automated gateway. Your slot is confirmed the second your payment clears.",
    feat2_title: "Room ID On Time",
    feat2_body: "Room ID and password are published to paid teams right in your dashboard before match start.",
    feat3_title: "Real Cash Prizes",
    feat3_body: "Every lobby has a guaranteed prize pool (৳330). Winners are published with proof and prizes are paid out fast.",
    feat4_title: "Fair Play Enforced",
    feat4_body: "No emulators, no teaming, no hackers. Moderated lobbies with instant bans for rule breakers.",
    feat5_title: "Live Notifications",
    feat5_body: "Get notified the moment your room ID drops, results are published, or your prize is on the way.",
    feat6_title: "Transparent History",
    feat6_body: "Every booking, payment and result is tracked in your dashboard. Full transaction history, always.",

    // FAQ
    faq_eyebrow: "FAQ",
    faq_title: "Questions, answered",
    faq1_q: "How do I book a scrim slot?",
    faq1_a: "Create an account, pick a scrim from tonight's schedule, enter your squad details, and pay ৳35 with bKash or Nagad. Your slot is confirmed automatically.",
    faq2_q: "When do I get the Room ID and password?",
    faq2_a: "Room credentials are published by our moderators 10-15 minutes before match start in your dashboard.",
    faq3_q: "What happens if the lobby is full?",
    faq3_a: "Each scrim is capped at 12 teams. Once full, booking closes automatically. Check the other 11 nightly time slots.",
    faq4_q: "How are prizes paid out?",
    faq4_a: "Winners are published on the Results page with kills and screenshots. Prizes are sent to the leader's bKash/Nagad number within 6 hours.",
    faq5_q: "Can I get a refund?",
    faq5_a: "If a scrim is cancelled by us, you get a full automatic refund. See our Refund Policy for details.",
    faq6_q: "Are emulator players allowed?",
    faq6_a: "No. Ace Scrims is mobile-only. Emulator players are banned without refund per our fair play rules.",

    // Contact
    contact_eyebrow: "Contact",
    contact_title: "Need help? Talk to a human.",
    contact_subtitle: "Our moderators are active on Discord and WhatsApp every evening. Message us with your transaction ID for quick help.",
    join_discord: "Join our Discord server",
    message_facebook: "Message on Facebook",
    email_us: "Email Support",

    // Results Page
    results_eyebrow: "PROVED WINNERS",
    results_title: "Match Results & Leaderboard",
    results_subtitle: "Transparent results with match screenshots and verified prize payouts.",
    total_prizes_paid: "Total Prizes Paid",
    matches_played: "Matches Completed",
    top_squad: "Top Champion Squad",
    view_proof_screenshot: "View Full Proof Screenshot",
    winner: "Winner",
    kills: "Kills",
    prize: "Prize",
    match_date: "Match Date",
    no_results_yet: "No match results published yet. Check back after tonight's matches!",

    // Booking Wizard
    step_1_heading: "Squad Information",
    step_2_heading: "Payment via bKash / Nagad",
    step_3_heading: "Booking Confirmation",
    team_name: "Team Name",
    team_tag: "Team Tag",
    team_leader: "Team Leader / Captain Name",
    captain_uid: "Team Leader Free Fire UID",
    player_2_name: "Player 2 Name",
    player_2_uid: "Player 2 Free Fire UID",
    player_3_name: "Player 3 Name",
    player_3_uid: "Player 3 Free Fire UID",
    player_4_name: "Player 4 Name",
    player_4_uid: "Player 4 Free Fire UID",
    player_5_name: "Substitute Player Name (Optional)",
    player_5_uid: "Substitute UID (Optional)",
    whatsapp_number: "WhatsApp Number (For Room ID)",
    proceed_to_payment: "Proceed to Payment (৳35)",
    payment_method: "Select Payment Gateway",
    bkash_nagad: "bKash / Nagad Auto Gateway",
    pay_now: "Pay ৳35 Now",
    payment_instruction: "You will be redirected to the secure payment portal. After payment, your slot will be instantly locked.",

    // Dashboard
    dashboard_welcome: "Welcome back",
    dashboard_sub: "Your scrim HQ — bookings, room credentials and results in one place.",
    total_bookings: "Total Bookings",
    upcoming_matches: "Upcoming Matches",
    wins: "Wins",
    prize_won: "Prize Won",
    no_upcoming_matches: "No upcoming matches",
    browse_scrims_cta: "Browse Scrims",
    room_id: "Room ID",
    room_pass: "Room Password",
    room_not_published: "Room ID & Password will be published 10-15 mins before match time.",
    view_all: "View all",
    my_bookings: "My Bookings",
    notifications: "Notifications",
    profile: "Profile",

    // Auth
    welcome_back: "Welcome back",
    signin_sub: "Sign in to book scrims and manage your squad.",
    join_ace_scrims: "Join Ace Scrims",
    signup_sub: "Create an account to register your squad and win cash prizes.",
    email: "Email",
    password: "Password",
    full_name: "Full Name",
    create_account: "Create Account",
    signin_button: "Sign In",
    forgot_password: "Forgot password?",
    or: "or",
    continue_google: "Continue with Google",
    already_have_account: "Already have an account?",
    new_to_ace_scrims: "New to Ace Scrims?",

    // Footer & Legal
    platform: "Platform",
    support: "Support",
    legal: "Legal",
    privacy_policy: "Privacy Policy",
    terms_conditions: "Terms & Conditions",
    refund_policy: "Refund Policy",
    rights_reserved: "Ace Scrims. All rights reserved. Not affiliated with Garena.",
  },
  bn: {
    // Navigation
    nav_home: "হোম",
    nav_scrims: "স্ক্রিমস",
    nav_results: "রেজাল্ট",
    nav_report: "রিপোর্ট",
    nav_tutorial: "টিউটোরিয়াল",
    nav_how_it_works: "কীভাবে কাজ করে",
    nav_faq: "প্রশ্নোত্তর",
    nav_contact: "যোগাযোগ",
    nav_admin: "এডমিন",
    nav_dashboard: "ড্যাশবোর্ড",
    nav_signin: "সাইন ইন",
    nav_join: "রেজিস্টার করুন",
    brand_desc: "বাংলাদেশের প্রিমিয়াম ফ্রি ফায়ার স্ক্রিম প্ল্যাটফর্ম। প্রতি রাতে ১২টি প্রতিযোগিতামূলক লবি।",

    // Hero
    hero_eyebrow: "দৈনিক ইস্পোর্টস লবি · সন্ধ্যা ৭টা থেকে রাত ১২টা",
    hero_title: "ACE SCRIMS",
    hero_h2: "বাংলাদেশের সেরা স্ক্রিম টুর্নামেন্ট খেলুন",
    hero_subtitle: "বাংলাদেশের সেরা প্রতিযোগিতামূলক ফ্রি ফায়ার স্ক্রিমস। প্রতি রাতে লাইভ লবি, তাৎক্ষণিক বুকিং, অটোমেটিক বিকাশ/নগদ পেমেন্ট এবং প্রাইজ মানি। আপনার স্কোয়াড নামান সেরা টিমের বিরুদ্ধে।",
    browse_scrims: "স্ক্রিমস দেখুন",
    view_results: "রেজাল্ট দেখুন",
    scrims_tonight: "আজকের স্ক্রিমস",
    team_slots: "টিম স্লট",
    nightly_prizes: "নাইটলি প্রাইজ মানি",

    // Scrim Explorer
    tonight_schedule_eyebrow: "আজ রাতের সিডিউল",
    tonight_schedule_title: "স্ক্রিম লবি। আপনার পছন্দের সময় বেছে নিন।",
    tonight_schedule_subtitle: "প্রতিটি স্ক্রিম ১ ঘণ্টার মধ্যে শেষ হয় ১২টি টিম স্লটে। স্লট ফুল হওয়ার আগেই বুকিং করুন।",
    todays_scrims_title: "আজকের স্ক্রিমস",
    todays_scrims_subtitle: "প্রতিদিন নির্ধারিত সময়ে লাইভ লবি। স্কোয়াড প্রতি এনট্রি ফি মাত্র ৳৩৫, সর্বোচ্চ ১২টি টিম। লবি ফুল হওয়ার আগেই আপনার স্লট বুক করুন।",
    search_scrims_placeholder: "সময়, ম্যাপ বা মোড খুঁজুন...",
    filter_all: "সবগুলো",
    status_open: "বুকিং খোলা",
    status_filling: "দ্রুত ফুল হচ্ছে",
    status_full: "লবি ফুল",
    status_live: "লাইভ চলছে",
    status_completed: "সম্পন্ন",
    price_label: "এনট্রি ফি",
    prize_label: "প্রাইজ পুল",
    map_label: "ম্যাপ",
    mode_label: "মোড",
    book_now: "বুকিং করুন",
    view_details: "বিস্তারিত দেখুন",
    lobby_full: "লবি ফুল",
    slots_left: "টি স্লট বাকি",
    confirmed_teams: "কনফার্মড টিমস",

    // Scrim Details
    facilities_heading: "সুযোগ সুবিধাসমূহ ও পুরষ্কার",
    facility_1: "টপ ৩ প্রাইজ পুল",
    facility_2: "টপ ৩ ফেস ব্যানার",
    facility_3: "এমভিপি ফেস ব্যানার",
    facility_4: "ওভারঅল স্ট্যান্ডিং ব্যানার",
    facility_5: "৬ ঘণ্টার মধ্যে পেমেন্ট গ্রহণ করুন (সর্বোচ্চ ২৪ ঘণ্টা)",
    rules_heading: "নিয়মকানুন ও ফরম্যাট",
    notes_heading: "গুরুত্বপূর্ণ নির্দেশনা",
    matches_per_scrim: "৩ টি ম্যাচ · বারমুডা, পারগেটরি ও কালাহারি",

    // How it works
    how_eyebrow: "কীভাবে কাজ করে",
    how_title: "বুকিং থেকে বুয়াহ মাত্র ৪টি ধাপে",
    how_subtitle: "সম্পূর্ণ প্রক্রিয়া অটোমেটিক। বুক করুন, পেমেন্ট করুন, খেলুন — অ্যাডমিনের জন্য অপেক্ষা করার ঝামেলা নেই।",
    step1_title: "স্ক্রিম নির্বাচন করুন",
    step1_body: "প্রতি রাতে সন্ধ্যা ৭টা থেকে ১২টা পর্যন্ত ১২টি লবি। সময়, ম্যাপ ও প্রাইজ পুল দেখে পছন্দ করুন।",
    step2_title: "৳৩৫ প্রদান করুন",
    step2_body: "বিকাশ বা নগদ দিয়ে পেমেন্ট করুন। কয়েক সেকেন্ডে পেমেন্ট অটোমেটিক ভেরিফাই হয়ে যাবে।",
    step3_title: "রুম আইডি ও পাসওয়ার্ড পান",
    step3_body: "আপনার স্কোয়াডের তথ্য দিন। ম্যাচের নির্দিষ্ট সময় আগে ড্যাশবোর্ডে রুম আইডি এবং পাসওয়ার্ড পেয়ে যাবেন।",
    step4_title: "খেলুন ও জিতুন",
    step4_body: "ম্যাচে নেমে লবি টপ করুন এবং পুরষ্কার জিতুন। ম্যাচের পরই রেজাল্ট ও প্রাইজ মানি দেওয়া হয়।",

    // Features
    features_eyebrow: "কেন এই প্ল্যাটফর্ম",
    features_title: "সেরা স্কোয়াডদের জন্য তৈরি",
    features_subtitle: "প্রতিযোগিতামূলক ফ্রি ফায়ার টিমের প্রয়োজনীয় সবকিছু — অটোমেটিক, স্বচ্ছ ও দ্রুত।",
    feat1_title: "তাৎক্ষণিক অটো পেমেন্ট",
    feat1_body: "বিকাশ বা নগদের মাধ্যমে অটোমেটিক পেমেন্ট করুন। পেমেন্ট সম্পন্ন হওয়া মাত্রই আপনার স্লট কনফার্মড।",
    feat2_title: "সময়ে রুম আইডি",
    feat2_body: "ম্যাচ শুরুর আগে কনফার্মড টিমের ড্যাশবোর্ডে রুম আইডি ও পাসওয়ার্ড দিয়ে দেওয়া হয়।",
    feat3_title: "আসল ক্যাশ প্রাইজ",
    feat3_body: "প্রতিটি লবিতে রয়েছে নিশ্চিত প্রাইজ পুল (৳৩৩০)। বিজয়ীদের তালিকা ও স্ক্রিনশট প্রুফসহ দ্রুত পুরষ্কার পাঠানো হয়।",
    feat4_title: "ফেয়ার প্লে নিশ্চিতকরণ",
    feat4_body: "কোনো ইমুলেটর, টিমিং বা হ্যাকার গ্রহণযোগ্য নয়। নিয়ম ভাঙলে সাথে সাথে ব্যান।",
    feat5_title: "লাইভ নোটিফিকেশন",
    feat5_body: "রুম আইডি পাবলিশ হওয়া, রেজাল্ট প্রকাশ ও প্রাইজ পেমেন্টের সাথে সাথেই নোটিফিকেশন পাবেন।",
    feat6_title: "স্বচ্ছ হিস্ট্রি",
    feat6_body: "আপনার সমস্ত বুকিং, পেমেন্ট ও ম্যাচের রেজাল্ট ড্যাশবোর্ডে সুরক্ষিত থাকে।",

    // FAQ
    faq_eyebrow: "প্রশ্নোত্তর",
    faq_title: "সাধারণ জিজ্ঞাসাসমূহ",
    faq1_q: "কীভাবে স্ক্রিম স্লট বুক করব?",
    faq1_a: "অ্যাকাউন্ট তৈরি করুন, আজকের সিডিউল থেকে স্ক্রিম বেছে নিয়ে স্কোয়াডের তথ্য দিন এবং বিকাশ বা নগদ দিয়ে ৳৩৫ পেমেন্ট করুন। আপনার স্লট স্বয়ংক্রিয়ভাবে বুক হয়ে যাবে।",
    faq2_q: "কখন রুম আইডি ও পাসওয়ার্ড পাব?",
    faq2_a: "ম্যাচ শুরুর ১০-১৫ মিনিট আগে ড্যাশবোর্ডে রুম আইডি ও পাসওয়ার্ড পেয়ে যাবেন।",
    faq3_q: "লবি ফুল হয়ে গেলে কী হবে?",
    faq3_a: "প্রতিটি লবিতে ১২টি টিম অংশ নিতে পারে। ফুল হয়ে গেলে বুকিং বন্ধ হয়ে যায়। রাতের অন্য লবিগুলোতে বুক করতে পারেন।",
    faq4_q: "প্রাইজ মানি কীভাবে দেওয়া হয়?",
    faq4_a: "রেজাল্ট পেজে কিল ও স্ক্রিনশটসহ বিজয়ীদের নাম প্রকাশ করা হয়। প্রাইজ মানি টিমের লিডারের বিকাশ/নগদ নম্বরে ৬ ঘণ্টার মধ্যে পাঠিয়ে দেওয়া হয়।",
    faq5_q: "পেমেন্ট রিফান্ড পাব কি?",
    faq5_a: "আমাদের পক্ষ থেকে কোনো ম্যাচ ক্যানসেল হলে সম্পূর্ণ টাকা অটোমেটিক রিফান্ড পাবেন। বিস্তারিত আমাদের রিফান্ড পলিসিতে দেখুন।",
    faq6_q: "ইমুলেটর প্লেয়ার কি খেলতে পারবে?",
    faq6_a: "না। Ace Scrims শুধুমাত্র মোবাইল প্লেয়ারদের জন্য। ইমুলেটর ব্যবহারকারী ধরা পড়লে রিফান্ড ছাড়াই ব্যান করা হয়।",

    // Contact
    contact_eyebrow: "যোগাযোগ",
    contact_title: "সাহায্য প্রয়োজন? সরাসরি কথা বলুন।",
    contact_subtitle: "আমাদের অ্যাডমিনরা প্রতি সন্ধ্যায় ডিসকর্ড ও হোয়াটসঅ্যাপে অ্যাক্টিভ থাকেন। যেকোনো পেমেন্ট সমস্যার জন্য ট্রানজেকশন আইডি সহ মেসেজ দিন।",
    join_discord: "আমাদের ডিসকর্ড সার্ভারে যোগ দিন",
    message_facebook: "ফেসবুকে মেসেজ দিন",
    email_us: "ইমেইল সাপোর্ট",

    // Results Page
    results_eyebrow: "প্রমাণিত বিজয়ী",
    results_title: "ম্যাচ রেজাল্ট ও লিডারবোর্ড",
    results_subtitle: "ম্যাচের স্ক্রিনশট প্রুফ ও ভেরিফাইড প্রাইজ পেমেন্ট সহ স্বচ্ছ রেজাল্ট।",
    total_prizes_paid: "মোট প্রদানকৃত প্রাইজ মানি",
    matches_played: "সম্পন্ন ম্যাচ সংখ্যা",
    top_squad: "সেরা চ্যাম্পিয়ন স্কোয়াড",
    view_proof_screenshot: "সম্পূর্ণ প্রুফ স্ক্রিনশট দেখুন",
    winner: "বিজয়ী",
    kills: "কিলস",
    prize: "প্রাইজ মানি",
    match_date: "ম্যাচের তারিখ",
    no_results_yet: "এখনো কোনো ম্যাচের রেজাল্ট প্রকাশ করা হয়নি। আজকের ম্যাচের পর আবার চেক করুন!",

    // Booking Wizard
    step_1_heading: "স্কোয়াড তথ্য",
    step_2_heading: "বিকাশ / নগদ পেমেন্ট",
    step_3_heading: "বুকিং কনফার্মেশন",
    team_name: "টিমের নাম",
    team_tag: "টিম ট্যাগ",
    team_leader: "টিম লিডার / ক্যাপ্টেনের নাম",
    captain_uid: "টিম লিডারের ফ্রি ফায়ার ইউআইডি (UID)",
    player_2_name: "২য় প্লেয়ারের নাম",
    player_2_uid: "২য় প্লেয়ারের ইউআইডি (UID)",
    player_3_name: "৩য় প্লেয়ারের নাম",
    player_3_uid: "৩য় প্লেয়ারের ইউআইডি (UID)",
    player_4_name: "৪র্থ প্লেয়ারের নাম",
    player_4_uid: "৪র্থ প্লেয়ারের ইউআইডি (UID)",
    player_5_name: "এক্সট্রা প্লেয়ারের নাম (ঐচ্ছিক)",
    player_5_uid: "এক্সট্রা প্লেয়ারের ইউআইডি (ঐচ্ছিক)",
    whatsapp_number: "হোয়াটসঅ্যাপ নম্বর (রুম আইডির জন্য)",
    proceed_to_payment: "পেমেন্ট করতে এগিয়ে যান (৳৩৫)",
    payment_method: "পেমেন্ট গেটওয়ে নির্বাচন করুন",
    bkash_nagad: "বিকাশ / নগদ অটোমেটিক গেটওয়ে",
    pay_now: "এখনই ৳৩৫ পেমেন্ট করুন",
    payment_instruction: "আপনাকে সুরক্ষিত পেমেন্ট পোর্টালে নিয়ে যাওয়া হবে। পেমেন্ট সফল হওয়া মাত্রই আপনার স্লট লক হয়ে যাবে।",

    // Dashboard
    dashboard_welcome: "স্বাগতম",
    dashboard_sub: "আপনার স্ক্রিম হাব — বুকিং, রুম আইডি ও রেজাল্ট এক জায়গায়।",
    total_bookings: "মোট বুকিং",
    upcoming_matches: "আসন্ন ম্যাচ",
    wins: "জয়লাভ",
    prize_won: "অর্জিত প্রাইজ মানি",
    no_upcoming_matches: "কোনো আসন্ন ম্যাচ নেই",
    browse_scrims_cta: "স্ক্রিমস দেখুন",
    room_id: "রুম আইডি",
    room_pass: "রুম পাসওয়ার্ড",
    room_not_published: "ম্যাচ শুরুর ১০-১৫ মিনিট আগে রুম আইডি ও পাসওয়ার্ড প্রকাশ করা হবে।",
    view_all: "সবগুলো দেখুন",
    my_bookings: "আমার বুকিং",
    notifications: "নোটিফিকেশন",
    profile: "প্রোফাইল",

    // Auth
    welcome_back: "ফিরে আসার জন্য ধন্যবাদ",
    signin_sub: "স্ক্রিম বুকিং ও স্কোয়াড ম্যানেজ করতে সাইন ইন করুন।",
    join_ace_scrims: "রেজিস্ট্রেশন করুন",
    signup_sub: "আপনার স্কোয়াড রেজিস্টার করতে ও প্রাইজ জিততে একটি অ্যাকাউন্ট তৈরি করুন।",
    email: "ইমেইল",
    password: "পাসওয়ার্ড",
    full_name: "পুরো নাম",
    create_account: "অ্যাকাউন্ট তৈরি করুন",
    signin_button: "সাইন ইন করুন",
    forgot_password: "পাসওয়ার্ড ভুলে গেছেন?",
    or: "অথবা",
    continue_google: "গুগল দিয়ে চালিয়ে যান",
    already_have_account: "আগে থেকেই অ্যাকাউন্ট আছে?",
    new_to_ace_scrims: "নতুন ব্যবহারকারী?",

    // Footer & Legal
    platform: "প্ল্যাটফর্ম",
    support: "সাপোর্ট",
    legal: "লিগ্যাল",
    privacy_policy: "প্রাইভেসি পলিসি",
    terms_conditions: "টার্মস ও কন্ডিশনস",
    refund_policy: "রিফান্ড পলিসি",
    rights_reserved: "Ace Scrims. সর্বস্বত্ব সংরক্ষিত। এটি গ্যারেনার সাথে সম্পর্কিত নয়।",
  },
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  t: (key, defaultText) => defaultText || key,
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("en")

  useEffect(() => {
    const saved = localStorage.getItem("ace_lang") as Language
    if (saved === "en" || saved === "bn") {
      setLangState(saved)
    }
  }, [])

  const setLang = (l: Language) => {
    setLangState(l)
    localStorage.setItem("ace_lang", l)
  }

  const t = (key: string, defaultText?: string) => {
    return translations[lang]?.[key] || defaultText || key
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
