// Opt-in native regression fixture; example text only, no API calls or server mutations.
import React, { useState } from 'react';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { ScrollView, Text, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '../../src/components/AppText';
import { AppTextInput } from '../../src/components/AppTextInput';
import { Button } from '../../src/components/Button';
import { MascotSpeechBubble } from '../../src/components/MascotSpeechBubble';
import { pretendardFonts } from '../../src/shared/fonts';
import { colors, controlSize, spacing } from '../../src/shared/theme';
import { enableFontScaleChangesUpdatingLayout } from 'react-native/src/private/featureflags/ReactNativeFeatureFlags';
const h = React.createElement;
const copy = '토마토, 먼저 살펴볼까요? 개봉한 재료도 함께 확인해 주세요. 필요한 내용을 끝까지 읽을 수 있어요.';
function App() {
  const [instance] = useState(() => Date.now());
  const { fontScale, width } = useWindowDimensions();
  const [loaded, error] = useFonts(pretendardFonts);
  const [count, setCount] = useState(0);
  const [value, setValue] = useState('보존 확인');
  const [height, setHeight] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);
  const [selection, setSelection] = useState(null);
  const [lines, setLines] = useState([]);
  if (!loaded && !error) return h(Text,null,'글꼴 로딩 중');
  return h(SafeAreaProvider,null,h(SafeAreaView,{style:{flex:1,backgroundColor:colors.background}},
    h(ScrollView,{contentContainerStyle:{padding:spacing.lg,gap:spacing.lg}},
      h(Text,{allowFontScaling:false,testID:'qa-diagnostics',accessibilityLabel:JSON.stringify({instance,nativeFontUpdates:enableFontScaleChangesUpdatingLayout(),fontScale,width,height,count,value,inputFocused,selection,lines})},'네이티브 글자 배율 검증'),
      h(AppText,{variant:'bodySmall'},'임시 네이티브 검증 · 예시 문구 · 실제 서버 처리 아님'),
      h(AppText,{testID:'qa-measured-copy',onLayout:({nativeEvent:{layout}})=>setHeight(layout.height),onTextLayout:({nativeEvent})=>setLines(nativeEvent.lines.map(({text,width,height})=>({text,width,height})))},copy),
      h(AppTextInput,{value,onChangeText:setValue,onFocus:()=>setInputFocused(true),onBlur:()=>setInputFocused(false),onSelectionChange:({nativeEvent})=>setSelection(nativeEvent.selection),testID:'qa-input',style:{minHeight:controlSize.minimum,padding:spacing.sm,borderWidth:1,borderColor:colors.borderControl}}),
      h(Button,{testID:'qa-counter',onPress:()=>setCount(c=>c+1)},'반응 확인'),
      h(MascotSpeechBubble,{message:copy,supportingMessage:'개봉한 재료도 함께 살펴보세요.',appearance:'crayon'}),
      h(AppText,null,'기존 컴포넌트의 글자 상한과 문구는 유지합니다.'),
      h(Text,{allowFontScaling:false,testID:'qa-line-layout',accessibilityLabel:JSON.stringify(lines)},'측정 기록')
    )));
}
registerRootComponent(App);
