import { resolveAbsoluteMediaUrl } from "@/features/auth/services/auth-api";

export const DEFAULT_PROFILE_AVATAR_URI =
  "https://ui-avatars.com/api/?name=User&background=E5E7EB&color=6B7280&size=128";

type ProfileImageSource = {
  profileImageUrl?: string | null;
  profileImage?: string | null;
  googleProfileImage?: string | null;
  avatar?: string | null;
  name?: string | null;
};

function pickFirstValidUri(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return resolveAbsoluteMediaUrl(value.trim()) ?? value.trim();
    }
  }
  return null;
}

export function resolveProfileImageUri(
  user?: ProfileImageSource | null,
  fallbackName?: string,
) {
  const resolved = pickFirstValidUri(
    user?.profileImageUrl,
    user?.profileImage,
    user?.googleProfileImage,
    user?.avatar,
  );

  if (resolved) {
    return resolved;
  }

  const label = user?.name?.trim() || fallbackName?.trim() || "User";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}&background=27BB97&color=fff&size=128`;
}
