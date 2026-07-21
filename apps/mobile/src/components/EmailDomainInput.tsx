import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import type { StyleProp, TextInputProps, TextStyle } from "react-native";
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  EMAIL_DOMAIN_MANUAL,
  EMAIL_DOMAINS,
  joinEmail,
  resolveDomainMode,
  splitEmail,
  type EmailDomainMode,
} from "../shared/email-domains";
import { colors, radius, spacing, touchTarget, typography } from "../shared/theme";

type EmailDomainInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  editable?: boolean;
  style?: StyleProp<TextStyle>;
  returnKeyType?: TextInputProps["returnKeyType"];
  onSubmitEditing?: TextInputProps["onSubmitEditing"];
  textContentType?: TextInputProps["textContentType"];
  autoCorrect?: boolean;
};

export function EmailDomainInput({
  value,
  onChangeText,
  placeholder = "아이디",
  placeholderTextColor = colors.mutedText,
  editable = true,
  style,
  returnKeyType,
  onSubmitEditing,
  autoCorrect = false,
}: EmailDomainInputProps) {
  const parsed = splitEmail(value);
  const [localPart, setLocalPart] = useState(parsed.local);
  const [domainPart, setDomainPart] = useState(parsed.domain);
  const [mode, setMode] = useState<EmailDomainMode>(() =>
    resolveDomainMode(parsed.domain),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const localInputRef = useRef<TextInput>(null);
  const domainInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const next = splitEmail(value);
    setLocalPart(next.local);
    setDomainPart(next.domain);
    setMode(resolveDomainMode(next.domain));
  }, [value]);

  const emit = (local: string, domain: string) => {
    onChangeText(joinEmail(local, domain));
  };

  const handleLocalChange = (nextLocal: string) => {
    const sanitized = nextLocal.replace(/@/g, "");
    setLocalPart(sanitized);
    emit(sanitized, domainPart);
  };

  const handleDomainChange = (nextDomain: string) => {
    const sanitized = nextDomain.replace(/@/g, "").toLowerCase();
    setDomainPart(sanitized);
    setMode(EMAIL_DOMAIN_MANUAL);
    emit(localPart, sanitized);
  };

  const focusDomainInput = () => {
    // Wait for manual-mode TextInput to mount after mode switch.
    setTimeout(() => {
      domainInputRef.current?.focus();
    }, 0);
  };

  const handleSelectMode = (nextMode: EmailDomainMode) => {
    setMenuOpen(false);

    if (nextMode === EMAIL_DOMAIN_MANUAL) {
      setMode(EMAIL_DOMAIN_MANUAL);
      focusDomainInput();
      return;
    }

    setMode(nextMode);
    setDomainPart(nextMode);
    emit(localPart, nextMode);
  };

  const toggleMenu = () => {
    if (!editable) {
      return;
    }

    if (menuOpen) {
      setMenuOpen(false);
      return;
    }

    // Blur inputs so keyboard doesn't cover the menu / re-fire onFocus.
    localInputRef.current?.blur();
    domainInputRef.current?.blur();
    Keyboard.dismiss();
    setMenuOpen(true);
  };

  const isManual = mode === EMAIL_DOMAIN_MANUAL;
  const domainLabel = isManual ? domainPart || "직접 입력" : mode;
  const ChevronIcon = menuOpen ? ChevronUp : ChevronDown;

  return (
    <View style={[styles.wrap, menuOpen && styles.wrapElevated]}>
      <View style={[styles.row, style]}>
        <TextInput
          ref={localInputRef}
          value={localPart}
          onChangeText={handleLocalChange}
          autoCapitalize="none"
          autoCorrect={autoCorrect}
          keyboardType="email-address"
          textContentType="username"
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor}
          editable={editable}
          style={styles.localInput}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setMenuOpen(false)}
        />
        <Text style={styles.atSign}>@</Text>
        {isManual ? (
          <TextInput
            ref={domainInputRef}
            value={domainPart}
            onChangeText={handleDomainChange}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="도메인"
            placeholderTextColor={placeholderTextColor}
            editable={editable}
            style={styles.domainInput}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            onFocus={() => setMenuOpen(false)}
          />
        ) : (
          <Pressable
            onPress={toggleMenu}
            disabled={!editable}
            style={({ pressed }) => [
              styles.domainButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.domainButtonText} numberOfLines={1}>
              {domainLabel}
            </Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이메일 도메인 고르기"
          accessibilityState={{ expanded: menuOpen }}
          onPress={toggleMenu}
          disabled={!editable}
          hitSlop={spacing.xs}
          style={({ pressed }) => [
            styles.chevronButton,
            pressed && styles.pressed,
            !editable && styles.disabled,
          ]}
        >
          <ChevronIcon
            color={colors.subtext}
            size={spacing.md}
            strokeWidth={2.4}
          />
        </Pressable>
      </View>

      {menuOpen ? (
        <View style={styles.menu}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            bounces={false}
            style={styles.menuScroll}
          >
            <Pressable
              onPress={() => handleSelectMode(EMAIL_DOMAIN_MANUAL)}
              style={({ pressed }) => [
                styles.optionRow,
                pressed && styles.optionRowPressed,
                isManual && styles.optionRowSelected,
              ]}
            >
              <Text
                style={[
                  styles.optionText,
                  isManual && styles.optionTextSelected,
                ]}
              >
                직접 입력할게요
              </Text>
            </Pressable>
            {EMAIL_DOMAINS.map((domain) => {
              const selected = mode === domain;
              return (
                <Pressable
                  key={domain}
                  onPress={() => handleSelectMode(domain)}
                  style={({ pressed }) => [
                    styles.optionRow,
                    pressed && styles.optionRowPressed,
                    selected && styles.optionRowSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selected && styles.optionTextSelected,
                    ]}
                  >
                    {domain}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
    zIndex: 1,
  },
  wrapElevated: {
    zIndex: 20,
  },
  row: {
    minHeight: touchTarget.cta,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
  },
  localInput: {
    flex: 1,
    minHeight: touchTarget.cta,
    color: colors.text,
    fontSize: typography.body.fontSize,
    fontFamily: typography.body.fontFamily,
    paddingVertical: spacing.sm,
  },
  atSign: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.title.fontFamily,
    color: colors.subtext,
  },
  domainInput: {
    flex: 1.2,
    minHeight: touchTarget.cta,
    color: colors.text,
    fontSize: typography.body.fontSize,
    fontFamily: typography.body.fontFamily,
    paddingVertical: spacing.sm,
  },
  domainButton: {
    flex: 1.2,
    minHeight: touchTarget.min,
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  domainButtonText: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  chevronButton: {
    width: touchTarget.min,
    height: touchTarget.min,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
  },
  disabled: {
    opacity: 0.5,
  },
  menu: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  menuScroll: {
    maxHeight: touchTarget.min * 4 + spacing.xs,
  },
  optionRow: {
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionRowPressed: {
    backgroundColor: colors.surfacePressed,
  },
  optionRowSelected: {
    backgroundColor: colors.primarySoft,
  },
  optionText: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  optionTextSelected: {
    color: colors.primary,
  },
});
