import type { StyleProp, TextStyle } from "react-native";
import { AppText } from "../../components/AppText";
import { splitCookingStepText } from "./cooking-step-text";

export function CookingStepText({
  text,
  highlightTimes = true,
  style,
}: {
  text: string;
  highlightTimes?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const tokens = highlightTimes ? splitCookingStepText(text) : [{ value: text, isTime: false }];

  return (
    <AppText variant="body" style={style}>
      {tokens.map((token, index) =>
        token.isTime ? (
          <AppText key={`${index}-${token.value}`} variant="body" tone="primary">
            {token.value}
          </AppText>
        ) : (
          token.value
        ),
      )}
    </AppText>
  );
}
