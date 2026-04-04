import { useRef, useState, useCallback } from 'react';
import {
  Text, TouchableOpacity, View, ScrollView, Modal,
  Platform, ActivityIndicator,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useReceiptScanner } from '@/hooks/useReceiptScanner';
import { StorePicker } from '@/components/store-picker';
import type { StoreWithDistance } from '@/hooks/useNearbyStores';

const C = {
  bg: '#d8fff0',
  white: '#ffffff',
  low: '#bffee7',
  container: '#b2f6de',
  high: '#a7f1d8',
  primary: '#006947',
  primaryContainer: '#00feb2',
  onPrimaryFixed: '#00472f',
  text: '#00362a',
  textSec: '#2f6555',
  outline: '#81b8a5',
  secondaryContainer: '#5afcd2',
  error: '#b31b25',
  errorBg: '#fff0f0',
  font: "'Plus Jakarta Sans', system-ui, sans-serif",
  fontBody: "'Manrope', system-ui, sans-serif",
};

interface ReceiptScannerProps {
  visible: boolean;
  storeLocationId: string | null;
  storeName: string | null;
  onClose: () => void;
  onSaved: (itemCount: number) => void;
}

export function ReceiptScanner({
  visible,
  storeLocationId: initialStoreLocationId,
  storeName: initialStoreName,
  onClose,
  onSaved,
}: ReceiptScannerProps) {
  const { step, error, items, total, scan, toggleItem, save, reset } = useReceiptScanner();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Allow user to pick/override store inside the modal
  const [selectedStore, setSelectedStore] = useState<StoreWithDistance | null>(null);

  const effectiveStoreId = selectedStore?.id ?? initialStoreLocationId;
  const effectiveStoreName = selectedStore?.name ?? initialStoreName;

  const handleClose = useCallback(() => {
    reset();
    setSelectedStore(null);
    onClose();
  }, [reset, onClose]);

  const handleSave = useCallback(async () => {
    await save(effectiveStoreId);
    const count = items.filter((i) => i.accepted).length;
    onSaved(count);
    reset();
    setSelectedStore(null);
    onClose();
  }, [save, effectiveStoreId, items, onSaved, reset, onClose]);

  // Web: read file as base64
  const processFile = useCallback(async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      // Strip "data:image/...;base64," prefix
      const base64 = dataUrl.split(',')[1];
      if (base64) await scan(base64, effectiveStoreId);
    };
    reader.readAsDataURL(file);
  }, [scan, effectiveStoreId]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input so the same file can be picked again
    if (e.target) e.target.value = '';
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) processFile(file);
  }, [processFile]);

  const isLoading = step === 'ocr' || step === 'parsing' || step === 'saving';
  const acceptedCount = items.filter((i) => i.accepted).length;

  const stepLabel: Record<string, string> = {
    ocr: 'Leser tekst fra bilde...',
    parsing: 'Tolker kvittering med AI...',
    saving: 'Lagrer priser...',
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,54,42,0.4)', justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={isLoading ? undefined : handleClose} />

        <View
          style={[
            {
              backgroundColor: C.white,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              maxHeight: '90%',
            },
            Platform.OS === 'web'
              ? ({ boxShadow: '0px -20px 60px rgba(0,54,42,0.2)' } as any)
              : {},
          ]}
        >
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.outline + '60' }} />
          </View>

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 } as any}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.primaryContainer, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="receipt-long" size={20} color={C.onPrimaryFixed} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, fontFamily: C.font } as any}>
                Skann kvittering
              </Text>
            </View>
            {!isLoading && (
              <TouchableOpacity onPress={handleClose} style={{ padding: 8 }}>
                <MaterialIcons name="close" size={22} color={C.textSec} />
              </TouchableOpacity>
            )}
          </View>

          {/* Store selector — always visible so user can override */}
          <View style={{ marginHorizontal: 24, marginBottom: 8, backgroundColor: C.low, borderRadius: 16, padding: 14 }}>
            <StorePicker
              selectedStoreId={effectiveStoreId}
              onSelect={setSelectedStore}
            />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >

            {/* === IDLE: Upload area === */}
            {step === 'idle' && (
              <>
                {Platform.OS === 'web' ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop as any}
                    style={{
                      border: `2px dashed ${isDragging ? C.primary : C.outline}`,
                      borderRadius: 20,
                      padding: 40,
                      textAlign: 'center',
                      backgroundColor: isDragging ? C.low : C.bg,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef as any}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleFileChange as any}
                    />
                    <MaterialIcons name="add-a-photo" size={40} color={C.primary} />
                    <p style={{ margin: '12px 0 4px', fontWeight: 700, color: C.text, fontFamily: C.font, fontSize: 16 }}>
                      Last opp kvitteringsbilde
                    </p>
                    <p style={{ margin: 0, color: C.textSec, fontFamily: C.fontBody, fontSize: 13 }}>
                      Dra og slipp, eller klikk for å velge
                    </p>
                  </div>
                ) : (
                  <TouchableOpacity
                    style={{
                      borderWidth: 2, borderStyle: 'dashed', borderColor: C.outline,
                      borderRadius: 20, padding: 40, alignItems: 'center', gap: 12,
                      backgroundColor: C.bg,
                    } as any}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="add-a-photo" size={40} color={C.primary} />
                    <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, fontFamily: C.font } as any}>
                      Ta bilde av kvittering
                    </Text>
                    <Text style={{ fontSize: 13, color: C.textSec, textAlign: 'center', fontFamily: C.fontBody } as any}>
                      Native kamera kommer i Fase 2 (iOS)
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* === LOADING === */}
            {isLoading && (
              <View style={{ alignItems: 'center', paddingVertical: 48, gap: 20 } as any}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.primaryContainer, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="large" color={C.primary} />
                </View>
                <View style={{ alignItems: 'center', gap: 6 } as any}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, fontFamily: C.font } as any}>
                    {stepLabel[step] ?? 'Vennligst vent...'}
                  </Text>
                  {step === 'parsing' && (
                    <Text style={{ fontSize: 13, color: C.textSec, fontFamily: C.fontBody } as any}>
                      Claude analyserer produktnavn og priser
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* === ERROR === */}
            {step === 'error' && (
              <View style={{ gap: 16 } as any}>
                <View style={{ backgroundColor: C.errorBg, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.error + '30', gap: 8 } as any}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 } as any}>
                    <MaterialIcons name="error-outline" size={20} color={C.error} />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: C.error, fontFamily: C.font } as any}>Noe gikk galt</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: '#7f1d1d', fontFamily: C.fontBody, lineHeight: 20 } as any}>
                    {error}
                  </Text>
                </View>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 14, backgroundColor: C.low } as any}
                  onPress={reset}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="refresh" size={18} color={C.primary} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: C.primary, fontFamily: C.fontBody } as any}>Prøv igjen</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* === REVIEW === */}
            {step === 'review' && (
              <View style={{ gap: 16 } as any}>
                {/* Summary */}
                <View style={{ backgroundColor: C.low, borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } as any}>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: C.textSec, textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: C.font } as any}>
                      Fant
                    </Text>
                    <Text style={{ fontSize: 28, fontWeight: '800', color: C.text, fontFamily: C.font } as any}>
                      {items.length} varer
                    </Text>
                  </View>
                  {total !== null && (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: C.textSec, textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: C.font } as any}>
                        Total
                      </Text>
                      <Text style={{ fontSize: 28, fontWeight: '800', color: C.primary, fontFamily: C.font } as any}>
                        {total.toFixed(0)} kr
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={{ fontSize: 12, color: C.textSec, fontFamily: C.fontBody } as any}>
                  Trykk for å fjerne varer du ikke vil lagre pris på.
                </Text>

                {/* Item list */}
                <View style={{ gap: 8 } as any}>
                  {items.map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        {
                          flexDirection: 'row', alignItems: 'center', gap: 14,
                          padding: 14, borderRadius: 14,
                          backgroundColor: item.accepted ? C.white : C.high,
                          borderWidth: 1,
                          borderColor: item.accepted ? 'rgba(129,184,165,0.25)' : 'transparent',
                          opacity: item.accepted ? 1 : 0.5,
                        },
                        Platform.OS === 'web' && item.accepted
                          ? ({ boxShadow: '0px 2px 8px rgba(0,54,42,0.04)' } as any)
                          : {},
                      ]}
                      onPress={() => toggleItem(index)}
                      activeOpacity={0.7}
                    >
                      <View style={{
                        width: 22, height: 22, borderRadius: 6,
                        backgroundColor: item.accepted ? C.primary : 'transparent',
                        borderWidth: item.accepted ? 0 : 2, borderColor: C.outline,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        {item.accepted && <MaterialIcons name="check" size={14} color={C.white} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{
                          fontSize: 14, fontWeight: '700', color: C.text, fontFamily: C.fontBody,
                          textDecorationLine: item.accepted ? 'none' : 'line-through',
                          textTransform: 'capitalize',
                        } as any}>
                          {item.name.toLowerCase()}
                        </Text>
                        {item.quantity > 1 && (
                          <Text style={{ fontSize: 11, color: C.textSec, fontFamily: C.fontBody } as any}>
                            {item.quantity} stk
                          </Text>
                        )}
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: C.primary, fontFamily: C.font } as any}>
                        {item.unitPrice.toFixed(2)} kr
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Action buttons */}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 } as any}>
                  <TouchableOpacity
                    style={{ flex: 1, padding: 16, alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(129,184,165,0.3)' }}
                    onPress={handleClose}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '600', color: C.primary, fontFamily: C.fontBody } as any}>Avbryt</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      { flex: 2, padding: 16, alignItems: 'center', borderRadius: 14, backgroundColor: C.primary, gap: 4 },
                      acceptedCount === 0 ? { opacity: 0.4 } : {},
                      Platform.OS === 'web'
                        ? ({ boxShadow: '0px 8px 24px rgba(0,105,71,0.3)' } as any)
                        : {},
                    ] as any}
                    onPress={handleSave}
                    disabled={acceptedCount === 0}
                    activeOpacity={0.85}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '700', color: C.white, fontFamily: C.fontBody } as any}>
                      Lagre {acceptedCount} priser
                    </Text>
                    <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontFamily: C.fontBody } as any}>
                      {effectiveStoreName ? `til ${effectiveStoreName}` : 'uten butikktilknytning'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
