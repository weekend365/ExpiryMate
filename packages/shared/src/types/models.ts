import type {
  BarcodeLookupSource,
  ExpirySource,
  ItemStatus,
  ProductCategory,
  ProductMasterSource,
  StorageLocation,
} from "../enums/app-enums";
import type { PushTokenPlatform } from "../schemas/notifications";

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductMaster {
  id: string;
  barcode: string;
  name: string;
  brand: string;
  category: string;
  imageUrl?: string | null;
  source: ProductMasterSource;
  contributedByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BarcodeLookupResult {
  barcode: string;
  name: string | null;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  source: BarcodeLookupSource;
  productMasterId: string | null;
}

export interface ContributeBarcodeProductResponse {
  product: ProductMaster;
  created: boolean;
}

export type AuthUserRole = "user" | "admin";
export type AuthAccountType = "anonymous" | "registered";
export type OAuthProvider = "apple" | "google" | "kakao" | "naver";

export interface AuthUser {
  id: string;
  email?: string | null;
  displayName?: string | null;
  role: AuthUserRole;
  accountType: AuthAccountType;
  emailVerifiedAt?: string | null;
  /** True when the account has a password and email is not verified yet. */
  requiresEmailVerification?: boolean;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
}

/** Returned from register when email verification is required before a session. */
export interface RegisterPendingResponse {
  requiresEmailVerification: true;
  email: string;
}

export type RegisterResponse = RegisterPendingResponse | AuthSession;

export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface OAuthLoginRequest {
  providerToken: string;
  email?: string;
  displayName?: string;
  /** @deprecated Prefer server-stored redirect from /auth/oauth/start. */
  redirectUri?: string;
  /** Opaque server-issued state from /auth/oauth/start (required for Google/Kakao/Naver). */
  state?: string;
}

export interface StartOAuthRequest {
  provider: "google" | "kakao" | "naver";
  returnUri: string;
}

export interface StartOAuthResponse {
  state: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  redirectUri: string;
  expiresAt: string;
}

/** Response entity shape; write contracts live in schemas/inventory.ts. */
export interface InventoryItem {
  id: string;
  productId?: string | null;
  ownerKey?: string;
  displayName: string;
  brand?: string | null;
  category?: ProductCategory | null;
  quantity: number;
  unit?: string | null;
  storageLocation: StorageLocation;
  expiryDate: string;
  expirySource: ExpirySource;
  status: ItemStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryListResponse {
  items: InventoryItem[];
  page: number;
  limit: number;
  totalCount: number;
  hasMore: boolean;
}

export interface NotificationPreference {
  id: string;
  ownerKey: string;
  enabled: boolean;
  reminderDaysBefore: number[];
  remindOnDayOf: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  updatedAt: string;
}

export interface PushToken {
  id: string;
  ownerKey: string;
  token: string;
  platform: PushTokenPlatform;
  deviceId?: string | null;
  appVersion?: string | null;
  enabled: boolean;
  lastSeenAt: string;
  updatedAt: string;
}

export interface DashboardSummary {
  todayExpiryCount: number;
  within3DaysCount: number;
  within7DaysCount: number;
  expiredCount: number;
  totalActiveCount: number;
  recentItems: InventoryItem[];
  expiringItems: InventoryItem[];
  locationCounts: Record<string, number>;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
