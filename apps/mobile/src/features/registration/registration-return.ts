export type RegistrationReturnTo = "inventory" | "home";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseRegistrationReturnTo(
  value: string | string[] | undefined,
): RegistrationReturnTo {
  return firstParam(value) === "inventory" ? "inventory" : "home";
}

export function registrationReturnHref(returnTo: RegistrationReturnTo) {
  return returnTo === "inventory" ? "/(tabs)/inventory" : "/(tabs)/home";
}

export function registerRoute(returnTo: RegistrationReturnTo) {
  return {
    pathname: "/register" as const,
    params: { from: returnTo },
  };
}

export function scannerRoute(returnTo: RegistrationReturnTo) {
  return {
    pathname: "/scanner" as const,
    params: { from: returnTo },
  };
}
