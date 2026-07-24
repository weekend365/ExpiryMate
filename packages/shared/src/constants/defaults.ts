import { ExpirySource, ItemStatus, StorageLocation, UnitCode } from "../enums/app-enums";

export const DEFAULT_OWNER_KEY = "demo-user";
export const DEFAULT_NOTIFICATION_DAYS = [1, 3, 7];
export const DEFAULT_QUIET_HOURS = {
  start: "22:00",
  end: "07:00",
};

export const DEFAULT_INVENTORY_FORM = {
  displayName: "",
  brand: "",
  category: undefined,
  quantity: 1,
  unit: "개",
  quantityBase: 1,
  unitCode: UnitCode.EA,
  storageLocation: StorageLocation.FRIDGE,
  expiryDate: "",
  expirySource: ExpirySource.MANUAL,
  status: ItemStatus.ACTIVE,
  notes: "",
};
