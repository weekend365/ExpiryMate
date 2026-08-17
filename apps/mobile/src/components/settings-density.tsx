import { createContext, useContext, type ReactNode } from "react";

export type SettingsDensity = "default" | "compact";

const SettingsDensityContext = createContext<SettingsDensity>("default");

export function SettingsDensityProvider({
  density,
  children,
}: {
  density: SettingsDensity;
  children: ReactNode;
}) {
  return (
    <SettingsDensityContext.Provider value={density}>
      {children}
    </SettingsDensityContext.Provider>
  );
}

export function useSettingsDensity(): SettingsDensity {
  return useContext(SettingsDensityContext);
}
