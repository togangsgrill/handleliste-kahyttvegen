import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Spacing, Radius } from '@/constants/theme';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<HTMLDivElement | null>(null);
  const html5QrCodeRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const destructive = useThemeColor({}, 'destructive');
  const cardBg = useThemeColor({}, 'card');
  const textSecondary = useThemeColor({}, 'textSecondary');

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let mounted = true;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!mounted) return;

        const scanner = new Html5Qrcode('barcode-reader');
        html5QrCodeRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText: string) => {
            onScan(decodedText);
            scanner.stop().catch(() => {});
          },
          () => {} // ignore scan failures
        );
      } catch (e: any) {
        if (mounted) {
          setError(e?.message ?? 'Kunne ikke starte kamera');
        }
      }
    }

    startScanner();

    return () => {
      mounted = false;
      html5QrCodeRef.current?.stop().catch(() => {});
    };
  }, [onScan]);

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <Text style={[styles.errorText, { color: textSecondary }]}>
          Strekkodeskanning er kun tilgjengelig på web for øyeblikket
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: cardBg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textSecondary }]}>Skann strekkode</Text>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
          <Text style={[styles.closeBtn, { color: destructive }]}>Lukk</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: destructive }]}>{error}</Text>
        </View>
      ) : (
        <View
          style={styles.scannerContainer}
          // @ts-ignore - web-only ref
          ref={scannerRef}
        >
          <div id="barcode-reader" style={{ width: '100%' }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: { fontSize: 17, fontWeight: '600' },
  closeBtn: { fontSize: 17, fontWeight: '500' },
  scannerContainer: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    minHeight: 250,
  },
  errorContainer: { padding: Spacing.lg, alignItems: 'center' },
  errorText: { fontSize: 15, textAlign: 'center' },
});
