function deliverPasswordReset({ email, token }) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

  if (process.env.NODE_ENV !== "production") {
    console.info(`Password reset link for ${email}: ${resetUrl}`);
    return;
  }

  // Replace this branch with the production email provider before launch.
  console.error("Password reset email delivery is not configured in production.");
}

module.exports = { deliverPasswordReset };
