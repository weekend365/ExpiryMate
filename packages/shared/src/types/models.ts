import type {
  BarcodeLookupSource,
  ExpirySource,
  ItemStatus,
  ProductCategory,
  ProductMasterSource,
  StorageLocation,
} from "../enums/app-enums";

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

export interface ContributeBarcodeProductRequest {
  barcode: string;
  name: string;
  brand?: string;
  category?: string;
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
}

export interface PrivacyStatus {
  privacyPolicyUrl: string;
  privacyChoicesUrl: string;
  contactEmail: string;
  aiDataNoticeVersion: string;
  aiDataNoticeAcceptedAt: string | null;
  hasAcceptedCurrentAiDataNotice: boolean;
}

export interface AcceptAiDataNoticeResponse {
  ok: true;
  status: PrivacyStatus;
}

export interface DeleteAccountRequest {
  confirmation: "삭제";
}

export interface DeleteAccountResponse {
  ok: true;
  deletedAt: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
}

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
  /** Required for Naver code → token exchange on the API. */
  redirectUri?: string;
  /** Naver authorize/token exchange state (must match). */
  state?: string;
}

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

export type PushTokenPlatform = "ios" | "android" | "web" | "unknown";

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

export interface RegisterPushTokenRequest {
  token: string;
  platform?: PushTokenPlatform;
  deviceId?: string;
  appVersion?: string;
}

export type SubscriptionStore = "apple_app_store" | "google_play";
export type SubscriptionEntitlementStatus =
  | "active"
  | "grace_period"
  | "billing_retry"
  | "paused"
  | "expired"
  | "revoked"
  | "unknown";

export interface SubscriptionEntitlement {
  hasActiveEntitlement: boolean;
  store: SubscriptionStore | null;
  productId: string | null;
  status: SubscriptionEntitlementStatus;
  expiresAt: string | null;
  willRenew: boolean | null;
  environment: string | null;
  verifiedAt: string | null;
}

export interface SubscriptionVerificationRequest {
  store: SubscriptionStore;
  productId?: string;
  transactionId?: string;
  purchaseToken?: string;
  environment?: "sandbox" | "production";
}

export interface SubscriptionVerificationResponse {
  ok: true;
  entitlement: SubscriptionEntitlement;
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

export type RecipeMealType = "any" | "breakfast" | "lunch" | "dinner" | "snack";

export interface RecipeRecommendationRequest {
  servings: number;
  maxCookingMinutes: number;
  mealType: RecipeMealType;
  useExpiringFirst: boolean;
}

export interface RecipeInventorySnapshotItem {
  inventoryItemId: string;
  name: string;
  category?: ProductCategory | null;
  quantity: number;
  unit?: string | null;
  storageLocation: StorageLocation;
  expiryDate: string;
  daysUntilExpiry: number;
}

export interface RecipeRecommendationDish {
  title: string;
  summary: string;
  cookingTimeMinutes: number;
  difficulty: "easy" | "medium" | "hard";
  servings: number;
  usedIngredients: Array<{
    inventoryItemId: string | null;
    name: string;
  }>;
  optionalMissingIngredients: Array<{
    name: string;
    reason: string;
  }>;
  steps: string[];
  tips: string[];
  safetyNote: string;
}

export interface RecipeRecommendation {
  id: string;
  ownerKey: string;
  createdAt: string;
  request: RecipeRecommendationRequest;
  inventorySnapshot: RecipeInventorySnapshotItem[];
  recommendations: RecipeRecommendationDish[];
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
