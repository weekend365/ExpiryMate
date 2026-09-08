export type RegistrationReturnTo = "inventory" | "home" | "recommendations";

export type RegistrationRouteParams = {
  from?: string | string[];
  returnTo?: string | string[];
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseRegistrationReturnTo(
  value: string | string[] | undefined,
  returnTo?: string | string[],
): RegistrationReturnTo {
  // Keep legacy `from` links (including unknown values) on their existing path.
  if (firstParam(returnTo) === "recommendations") return "recommendations";
  return firstParam(value) === "inventory" ? "inventory" : "home";
}

export function registrationReturnHref(returnTo: RegistrationReturnTo) {
  if (returnTo === "recommendations") return "/(tabs)/recommendations";
  return returnTo === "inventory" ? "/(tabs)/inventory" : "/(tabs)/home";
}

export function registrationReturnLabel(returnTo: RegistrationReturnTo) {
  if (returnTo === "recommendations") return "추천으로 돌아가기";
  return returnTo === "inventory" ? "보관함으로 이동" : "홈으로 돌아가기";
}

function registrationRouteParams(returnTo: RegistrationReturnTo) {
  return returnTo === "recommendations"
    ? { from: "home", returnTo: "recommendations" }
    : { from: returnTo };
}

export function registerRoute(returnTo: RegistrationReturnTo) {
  return {
    pathname: "/register" as const,
    params: registrationRouteParams(returnTo),
  };
}

export function scannerRoute(returnTo: RegistrationReturnTo) {
  return {
    pathname: "/scanner" as const,
    params: registrationRouteParams(returnTo),
  };
}

export function photoParseRoute(returnTo: RegistrationReturnTo) {
  return {
    pathname: "/register-photo" as const,
    params: registrationRouteParams(returnTo),
  };
}
