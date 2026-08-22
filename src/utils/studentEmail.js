const AU_STUDENT_EMAIL_PATTERN = /^u\d{7}@au\.edu$/i;
const AU_EMAIL_PATTERN = /^[^\s@]+@au\.edu$/i;

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function isAuStudentEmail(email) {
  return AU_STUDENT_EMAIL_PATTERN.test(normalizeEmail(email));
}

function isAuEmail(email) {
  return AU_EMAIL_PATTERN.test(normalizeEmail(email));
}

module.exports = { normalizeEmail, isAuEmail, isAuStudentEmail };
