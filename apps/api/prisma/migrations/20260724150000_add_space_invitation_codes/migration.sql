-- Add one-time invitation codes without changing the existing email invitation API.
CREATE TYPE "SpaceInvitationMethod" AS ENUM ('email', 'code');

ALTER TABLE "SpaceInvitation"
  ADD COLUMN "method" "SpaceInvitationMethod" NOT NULL DEFAULT 'email',
  ALTER COLUMN "email" DROP NOT NULL;

CREATE INDEX "SpaceInvitation_spaceId_method_createdAt_idx"
  ON "SpaceInvitation"("spaceId", "method", "createdAt");

ALTER TABLE "SpaceInvitation"
  ADD CONSTRAINT "SpaceInvitation_method_email_check"
  CHECK (
    ("method" = 'email' AND "email" IS NOT NULL)
    OR ("method" = 'code' AND "email" IS NULL)
  ),
  ADD CONSTRAINT "SpaceInvitation_code_role_check"
  CHECK ("method" <> 'code' OR "role" = 'member');
