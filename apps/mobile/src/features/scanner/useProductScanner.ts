import TextRecognition, {
  TextRecognitionScript,
  type Frame,
  type TextRecognitionResult,
} from "@react-native-ml-kit/text-recognition";
import { BarcodeLookupSource } from "@expirymate/shared";
import type { BarcodeScanningResult } from "expo-camera";
import type { CameraView } from "expo-camera";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Dimensions, Vibration } from "react-native";
import { lookupBarcodeProduct } from "../../services/api";
import { parseExpirationDate } from "./parseExpirationDate";
import {
  guideFrameToImageRect,
  isBarcodeCenterInGuide,
  isImageFrameCenterInGuide,
  type GuideFrameLayout,
  type ImageFrame,
} from "./scanGuide";

export type ScannerMode = "barcode" | "ocr" | "confirm";
export type ProductLookupStatus = "idle" | "loading" | "success" | "not-found" | "error";

export type ProductInfo = {
  barcode: string;
  name: string | null;
  brand: string | null;
  category: string | null;
  imageUrl?: string | null;
  source: BarcodeLookupSource;
  productMasterId: string | null;
};

export type ScannerConfirmation = {
  barcode: string;
  /** ISO date from OCR, or null when the user will enter expiry manually. */
  expirationDate: string | null;
};

const PRODUCT_BARCODE_TYPES = new Set([
  "ean13",
  "ean8",
  "upc_a",
  "upc_e",
]);
const OCR_SCAN_INTERVAL_MS = 1400;
const OCR_START_DELAY_MS = 900;

export function useProductScanner() {
  const cameraRef = useRef<CameraView>(null);
  const modeRef = useRef<ScannerMode>("barcode");
  const barcodeLockedRef = useRef(false);
  const scanProcessingRef = useRef(false);
  const scanTokenRef = useRef(0);
  const lookupAbortRef = useRef<AbortController | null>(null);
  const guideFrameRef = useRef<GuideFrameLayout | null>(null);

  const [mode, setMode] = useState<ScannerMode>("barcode");
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [productLookupStatus, setProductLookupStatus] =
    useState<ProductLookupStatus>("idle");
  const [productErrorMessage, setProductErrorMessage] = useState<string | null>(null);
  const [isScanProcessing, setIsScanProcessing] = useState(false);
  const [ocrErrorMessage, setOcrErrorMessage] = useState<string | null>(null);
  const [cameraErrorMessage, setCameraErrorMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ScannerConfirmation | null>(null);

  const updateMode = useCallback((nextMode: ScannerMode) => {
    modeRef.current = nextMode;
    setMode(nextMode);
  }, []);

  const setGuideFrame = useCallback((frame: GuideFrameLayout | null) => {
    guideFrameRef.current = frame;
  }, []);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(
    () => () => {
      lookupAbortRef.current?.abort();
      scanTokenRef.current += 1;
    },
    [],
  );

  const lookupProduct = useCallback(async (barcode: string, scanToken: number) => {
    lookupAbortRef.current?.abort();

    const controller = new AbortController();
    lookupAbortRef.current = controller;
    setProduct(null);
    setProductErrorMessage(null);
    setProductLookupStatus("loading");

    try {
      const result = await lookupBarcodeProduct(barcode);

      if (controller.signal.aborted || scanTokenRef.current !== scanToken) {
        return;
      }

      setProduct({
        barcode: result.barcode,
        name: result.name,
        brand: result.brand,
        category: result.category,
        imageUrl: result.imageUrl,
        source: result.source,
        productMasterId: result.productMasterId,
      });
      setProductLookupStatus(
        result.source === BarcodeLookupSource.NOT_FOUND ? "not-found" : "success",
      );
    } catch (error) {
      if (controller.signal.aborted || scanTokenRef.current !== scanToken) {
        return;
      }

      setProduct({
        barcode,
        name: null,
        brand: null,
        category: null,
        imageUrl: null,
        source: BarcodeLookupSource.NOT_FOUND,
        productMasterId: null,
      });
      setProductLookupStatus("error");
      setProductErrorMessage(
        error instanceof Error
          ? error.message
          : "상품 정보를 조회하지 못했어요.",
      );
    }
  }, []);

  const handleBarcodeDetected = useCallback(
    (barcode: string) => {
      if (barcodeLockedRef.current || modeRef.current !== "barcode") {
        return;
      }

      const normalizedBarcode = barcode.trim();

      if (!normalizedBarcode) {
        return;
      }

      barcodeLockedRef.current = true;
      const scanToken = scanTokenRef.current + 1;
      scanTokenRef.current = scanToken;

      setScannedBarcode(normalizedBarcode);
      setConfirmation(null);
      setOcrErrorMessage(null);
      setCameraErrorMessage(null);
      updateMode("ocr");
      Vibration.vibrate(80);
      void lookupProduct(normalizedBarcode, scanToken);
    },
    [lookupProduct, updateMode],
  );

  const handleCameraReady = useCallback(() => {
    setIsCameraReady(true);
  }, []);

  const handleMountError = useCallback((event: { message: string }) => {
    setIsCameraReady(false);
    setCameraErrorMessage(event.message);
  }, []);

  const handleBarcodeScanEvent = useCallback(
    (result: BarcodeScanningResult) => {
      if (modeRef.current !== "barcode" || barcodeLockedRef.current) {
        return;
      }

      if (!PRODUCT_BARCODE_TYPES.has(result.type)) {
        return;
      }

      const windowSize = Dimensions.get("window");
      if (
        !isBarcodeCenterInGuide(
          result.bounds,
          guideFrameRef.current,
          windowSize,
        )
      ) {
        return;
      }

      const normalizedBarcode = normalizeProductBarcode(result.data);

      if (!normalizedBarcode) {
        return;
      }

      handleBarcodeDetected(normalizedBarcode);
    },
    [handleBarcodeDetected],
  );

  const scanOcrFrame = useCallback(async () => {
    if (
      modeRef.current !== "ocr" ||
      !scannedBarcode ||
      scanProcessingRef.current ||
      !isCameraReady
    ) {
      return;
    }

    const scanToken = scanTokenRef.current;
    scanProcessingRef.current = true;
    setIsScanProcessing(true);

    try {
      const capture = await captureImage(cameraRef);
      const result = await TextRecognition.recognize(
        capture.uri,
        TextRecognitionScript.KOREAN,
      );
      const guideRect = resolveGuideRectInImage(capture, guideFrameRef.current);
      const expirationDate = findExpirationDate(result, guideRect);

      if (!expirationDate || scanTokenRef.current !== scanToken) {
        return;
      }

      setConfirmation({
        barcode: scannedBarcode,
        expirationDate,
      });
      updateMode("confirm");
      Vibration.vibrate(80);
    } catch (error) {
      if (scanTokenRef.current === scanToken && modeRef.current === "ocr") {
        setOcrErrorMessage(
          error instanceof Error ? error.message : "유통기한을 인식하지 못했어요.",
        );
      }
    } finally {
      scanProcessingRef.current = false;
      setIsScanProcessing(false);
    }
  }, [isCameraReady, scannedBarcode, updateMode]);

  useEffect(() => {
    if (mode !== "ocr" || !isCameraReady) {
      return undefined;
    }

    const startDelayId = setTimeout(() => {
      void scanOcrFrame();
    }, OCR_START_DELAY_MS);
    const intervalId = setInterval(() => {
      void scanOcrFrame();
    }, OCR_SCAN_INTERVAL_MS);

    return () => {
      clearTimeout(startDelayId);
      clearInterval(intervalId);
    };
  }, [isCameraReady, mode, scanOcrFrame]);

  const isCameraActive = mode !== "confirm";

  const confirmWithManualExpiry = useCallback(() => {
    if (!scannedBarcode || modeRef.current !== "ocr") {
      return;
    }

    // Invalidate in-flight OCR captures so the loop cannot reopen confirm.
    scanTokenRef.current += 1;
    scanProcessingRef.current = false;
    setIsScanProcessing(false);
    setOcrErrorMessage(null);
    setConfirmation({
      barcode: scannedBarcode,
      expirationDate: null,
    });
    updateMode("confirm");
    Vibration.vibrate(80);
  }, [scannedBarcode, updateMode]);

  const resetScanner = useCallback(() => {
    lookupAbortRef.current?.abort();
    scanTokenRef.current += 1;
    barcodeLockedRef.current = false;
    scanProcessingRef.current = false;
    setScannedBarcode(null);
    setProduct(null);
    setProductLookupStatus("idle");
    setProductErrorMessage(null);
    setOcrErrorMessage(null);
    setCameraErrorMessage(null);
    setConfirmation(null);
    setIsScanProcessing(false);
    // CameraView stays mounted; onCameraReady won't re-fire on rescan.
    updateMode("barcode");
  }, [updateMode]);

  return {
    cameraRef,
    isCameraActive,
    isCameraReady,
    mode,
    scannedBarcode,
    product,
    productLookupStatus,
    productErrorMessage,
    isOcrProcessing: mode === "ocr" && isScanProcessing,
    ocrErrorMessage,
    cameraErrorMessage,
    confirmation,
    resetScanner,
    confirmWithManualExpiry,
    setGuideFrame,
    handleCameraReady,
    handleMountError,
    handleBarcodeScanEvent,
  };
}

function normalizeProductBarcode(rawValue: string) {
  const digits = rawValue.replace(/\D/g, "");

  if (digits.length === 12) {
    return digits.padStart(13, "0");
  }

  if (digits.length === 8 || digits.length === 13) {
    return digits;
  }

  return null;
}

async function captureImage(cameraRef: RefObject<CameraView | null>) {
  const camera = cameraRef.current;

  if (!camera) {
    throw new Error("Camera is not ready");
  }

  const photo = await camera.takePictureAsync({
    quality: 1,
    shutterSound: false,
  });

  if (!photo.uri) {
    throw new Error("Failed to capture image");
  }

  return {
    uri: photo.uri.startsWith("file://") ? photo.uri : `file://${photo.uri}`,
    width: photo.width,
    height: photo.height,
  };
}

function resolveGuideRectInImage(
  capture: { width: number; height: number },
  guide: GuideFrameLayout | null,
): ImageFrame | null {
  if (!guide || capture.width <= 0 || capture.height <= 0) {
    return null;
  }

  return guideFrameToImageRect(guide, capture, Dimensions.get("window"));
}

function findExpirationDate(
  result: TextRecognitionResult,
  guideRect: ImageFrame | null,
) {
  const guided = getGuidedTextCandidates(result, guideRect);
  const candidates = guided.length > 0 ? guided : getRecognizedTextCandidates(result);

  for (const text of candidates) {
    const parsed = parseExpirationDate(text);

    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function getGuidedTextCandidates(
  result: TextRecognitionResult,
  guideRect: ImageFrame | null,
) {
  if (!guideRect) {
    return [];
  }

  const texts: string[] = [];

  for (const block of result.blocks) {
    if (!isImageFrameCenterInGuide(toImageFrame(block.frame), guideRect)) {
      continue;
    }

    texts.push(block.text);

    for (const line of block.lines) {
      if (
        line.frame &&
        !isImageFrameCenterInGuide(toImageFrame(line.frame), guideRect)
      ) {
        continue;
      }

      texts.push(line.text);

      for (const element of line.elements) {
        texts.push(element.text);
      }
    }
  }

  return texts;
}

function toImageFrame(frame: Frame | undefined): ImageFrame | undefined {
  if (!frame) {
    return undefined;
  }

  return {
    left: frame.left,
    top: frame.top,
    width: frame.width,
    height: frame.height,
  };
}

function getRecognizedTextCandidates(result: TextRecognitionResult) {
  return [
    result.text,
    ...result.blocks.flatMap((block) => [
      block.text,
      ...block.lines.flatMap((line) => [
        line.text,
        ...line.elements.map((element) => element.text),
      ]),
    ]),
  ];
}
