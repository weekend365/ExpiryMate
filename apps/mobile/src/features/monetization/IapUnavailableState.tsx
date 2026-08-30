import { EmptyState } from "../../components/EmptyState";
import { SettingsScreen } from "../../components/SettingsScreen";

export function IapUnavailableState({ feature }: { feature: string }) {
  return (
    <SettingsScreen>
      <EmptyState
        mood="idle"
        title="스토어 결제를 연결할 수 없어요"
        description={`현재 실행 중인 앱에는 ${feature}에 필요한 결제 모듈이 없어요. Expo Go 대신 최신 개발 빌드나 배포 앱에서 다시 열어 주세요.`}
      />
    </SettingsScreen>
  );
}

