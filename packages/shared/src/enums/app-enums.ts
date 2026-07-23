export enum StorageLocation {
  FRIDGE = "fridge",
  FREEZER = "freezer",
  ROOM = "room",
  BATHROOM = "bathroom",
  KITCHEN = "kitchen",
}

export enum ItemStatus {
  ACTIVE = "active",
  CONSUMED = "consumed",
  DISCARDED = "discarded",
  EXPIRED = "expired",
}

export enum ExpirySource {
  MANUAL = "manual",
  PRESET = "preset",
  OCR_DETECTED = "ocr_detected",
}

export enum ProductCategory {
  DAIRY = "dairy",
  EGG = "egg",
  TOFU = "tofu",
  BEVERAGE = "beverage",
  INSTANT_FOOD = "instant_food",
  PERSONAL_CARE = "personal_care",
  PAPER_GOODS = "paper_goods",
  CLEANING = "cleaning",
  FROZEN_FOOD = "frozen_food",
  PRODUCE = "produce",
  SEASONING = "seasoning",
  SNACK = "snack",
  HOUSEHOLD = "household",
}

export enum ProductMasterSource {
  FOODSAFETY_API = "foodsafety_api",
  OPEN_FOOD_FACTS = "open_food_facts",
  USER_CONTRIBUTED = "user_contributed",
}

export enum BarcodeLookupSource {
  PRODUCT_MASTER = "product_master",
  OPEN_FOOD_FACTS = "open_food_facts",
  NOT_FOUND = "not_found",
}

export enum SupportInquiryCategory {
  BUG = "bug",
  ACCOUNT = "account",
  RECIPE_AI = "recipe_ai",
  OTHER = "other",
}

export enum SupportInquiryStatus {
  OPEN = "open",
  CLOSED = "closed",
}
