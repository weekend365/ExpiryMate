import type {
  ExpirySource,
  ItemStatus,
  ProductCategory,
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
