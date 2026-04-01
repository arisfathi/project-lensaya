INSERT INTO "CmsContent" ("section", "slug", "title", "excerpt", "contentMarkdown", "status", "sortOrder", "publishedAt")
VALUES
  ('LEGAL', 'privacy-policy', 'Privacy Policy', 'How Lensaya collects, uses, and protects personal data.', '## Privacy Policy\n\nDescribe what data Lensaya collects, how it is used, and how photographers and visitors can request updates or deletion.', 'PUBLISHED', 0, CURRENT_TIMESTAMP),
  ('LEGAL', 'terms-of-service', 'Terms of Service', 'Rules and responsibilities for using Lensaya.', '## Terms of Service\n\nDescribe acceptable use, account responsibilities, billing terms, and platform limitations for photographers and visitors.', 'PUBLISHED', 1, CURRENT_TIMESTAMP),
  ('LEGAL', 'cookie-policy', 'Cookie Policy', 'How cookies are used for authentication, analytics, and preferences.', '## Cookie Policy\n\nDescribe which cookies are used for authentication, analytics, and preferences, and how users can control cookie consent.', 'PUBLISHED', 2, CURRENT_TIMESTAMP)
ON CONFLICT ("section", "slug") DO NOTHING;
