import { router } from "expo-router";
import {
  registrationReturnHref,
  type RegistrationReturnTo,
} from "./registration-return";

export function returnFromRegistration(returnTo: RegistrationReturnTo) {
  const href = registrationReturnHref(returnTo);
  if (returnTo === "recommendations" || returnTo === "shop") {
    // Pop to the existing tab instance so its recipe options and selection survive.
    // Expo Router replaces the current screen with href when it is not in the stack.
    router.dismissTo(href);
    return;
  }
  router.replace(href);
}

export function cancelRegistration(returnTo: RegistrationReturnTo) {
  if (returnTo === "recommendations" || returnTo === "shop") {
    returnFromRegistration(returnTo);
    return;
  }
  router.back();
}
