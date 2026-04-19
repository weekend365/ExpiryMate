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
  BARCODE_DECODED = "barcode_decoded",
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
