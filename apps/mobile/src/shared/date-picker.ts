import { isDateOnlyString } from "@expirymate/shared";

// Native date pickers use the device calendar, independently of KST display dates.
export function toDatePickerDate(value: string) {
  if (!isDateOnlyString(value)) {
    return new Date(value);
  }

  const [yearText, monthText, dayText] = value.split("-");
  return new Date(Number(yearText), Number(monthText) - 1, Number(dayText));
}

export function toDatePickerDateOnly(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
