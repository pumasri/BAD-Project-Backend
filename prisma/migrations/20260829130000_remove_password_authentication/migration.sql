-- Microsoft OIDC is the only authentication method. Password and verification
-- data are no longer read or written by the application.
DROP TABLE "PasswordResetToken";

ALTER TABLE "User"
DROP COLUMN "passwordHash",
DROP COLUMN "verificationCode",
DROP COLUMN "verificationExpiresAt";
