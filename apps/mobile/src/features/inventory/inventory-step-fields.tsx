import { ExpirySource, quantityInputStep } from "@expirymate/shared";
import type { ReactNode, Ref } from "react";
import { View } from "react-native";
import { AppText } from "../../components/AppText";
import {
  DatePickerField,
  type DatePickerFieldHandle,
} from "../../components/DatePickerField";
import { FormField } from "../../components/FormField";
import { QuantityStepper } from "../../components/QuantityStepper";
import { QuantityUnitPills } from "./QuantityUnitPills";
import {
  ExtraDetailsRow,
  QuickExpiryPills,
  StorageLocationField,
  inventoryFormStyles,
} from "./inventory-form-ui";

export function InventoryProductNameStep({
  control,
  header,
  children,
}: {
  control: any;
  header?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <View style={inventoryFormStyles.stepSections}>
      {header}
      <View
        style={[
          inventoryFormStyles.sectionCard,
          inventoryFormStyles.sectionCardTight,
        ]}
      >
        <AppText style={inventoryFormStyles.sectionTitle}>재료 이름</AppText>
        <FormField
          control={control}
          name="displayName"
          label="재료 이름"
          hideLabel
          placeholder="예: 서울우유 1L"
        />
        {children}
      </View>
    </View>
  );
}

export function InventoryQuantityStep({
  quantityLabel,
  quantityUnitSuffix,
  quantity,
  unit,
  quantityError,
  onChangeQuantity,
  onChangeUnit,
  showLocationPicker,
  selectedLocationKey,
  selectedLocationLabel,
  locationOptions,
  onExpandLocation,
  onSelectLocation,
  onAddLocation,
  extraDetailsLabel,
  onOpenExtraDetails,
}: {
  quantityLabel: string;
  quantityUnitSuffix?: string;
  quantity: number;
  unit?: string | null;
  quantityError?: string;
  onChangeQuantity: (nextQuantity: number) => void;
  onChangeUnit: (nextUnit: string) => void;
  showLocationPicker: boolean;
  selectedLocationKey: string;
  selectedLocationLabel: string;
  locationOptions: Array<{ key: string; label: string }>;
  onExpandLocation: () => void;
  onSelectLocation: (key: string) => void;
  onAddLocation: () => void;
  extraDetailsLabel: string;
  onOpenExtraDetails: () => void;
}) {
  return (
    <View style={inventoryFormStyles.stepSections}>
      <View
        style={[
          inventoryFormStyles.sectionCard,
          inventoryFormStyles.sectionCardTight,
        ]}
      >
        <AppText style={inventoryFormStyles.sectionTitle}>
          {quantityLabel}
        </AppText>
        <QuantityStepper
          presentation="hero"
          label={quantityLabel}
          unitSuffix={quantityUnitSuffix}
          value={quantity}
          step={quantityInputStep(unit)}
          onChange={onChangeQuantity}
          error={quantityError}
        />
        <View style={inventoryFormStyles.unitChipBlock}>
          <AppText style={inventoryFormStyles.sectionCaption}>단위</AppText>
          <QuantityUnitPills unit={unit} onChange={onChangeUnit} />
        </View>
      </View>

      <StorageLocationField
        expanded={showLocationPicker}
        selectedKey={selectedLocationKey}
        selectedLabel={selectedLocationLabel}
        options={locationOptions}
        onExpand={onExpandLocation}
        onSelect={onSelectLocation}
        onAddLocation={onAddLocation}
      />

      <ExtraDetailsRow
        label={extraDetailsLabel}
        onPress={onOpenExtraDetails}
      />
    </View>
  );
}

export function InventoryExpiryStep({
  expiryDate,
  expirySource,
  expiryError,
  onChangeDate,
  onSelectPreset,
  pickerRef,
  children,
}: {
  expiryDate?: string;
  expirySource?: ExpirySource;
  expiryError?: string;
  onChangeDate: (nextDate: string) => void;
  onSelectPreset: (isoDate: string) => void;
  pickerRef?: Ref<DatePickerFieldHandle>;
  children?: ReactNode;
}) {
  return (
    <View style={inventoryFormStyles.stepSections}>
      <View
        style={[
          inventoryFormStyles.sectionCard,
          inventoryFormStyles.sectionCardTight,
        ]}
      >
        <AppText style={inventoryFormStyles.sectionTitle}>유통기한</AppText>
        <DatePickerField
          ref={pickerRef}
          presentation="hero"
          heroEyebrow={null}
          actionLabel={expiryDate ? "다른 날짜 고르기" : "달력에서 고르기"}
          value={expiryDate}
          onChange={onChangeDate}
          error={expiryError}
        >
          <QuickExpiryPills
            isSelected={(isoDate) =>
              expiryDate === isoDate && expirySource === ExpirySource.PRESET
            }
            onSelect={onSelectPreset}
          />
        </DatePickerField>
      </View>
      {children}
    </View>
  );
}
