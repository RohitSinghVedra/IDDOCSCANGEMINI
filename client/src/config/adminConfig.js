/**
 * Admin Configuration
 * List of authorized admin email addresses
 */

export const ADMIN_EMAILS = [
  'vijaykaggrawal@gmail.com',
  'rohitsingh2117@gmail.com'
];

/**
 * Check if an email is an admin
 * @param {string} email - Email address to check
 * @returns {boolean} True if email is in admin list
 */
export const isAdminEmail = (email) => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
};

