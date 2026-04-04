import { Text, TouchableOpacity, View, Modal, ScrollView, Platform } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCategoryOrder } from '@/hooks/useCategoryOrder';

interface CategoryOrderEditorProps {
  storeLocationId: string | null;
  storeName: string;
  visible: boolean;
  onClose: () => void;
}

export function CategoryOrderEditor({ storeLocationId, storeName, visible, onClose }: CategoryOrderEditorProps) {
  const { orderedCategories, moveCategory, saveOrder, hasCustomOrder } = useCategoryOrder(storeLocationId);

  async function handleSave() {
    await saveOrder();
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        className="flex-1 justify-center px-6"
        style={{ backgroundColor: 'rgba(0,54,42,0.35)' }}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View
            className="bg-surface-container-lowest rounded-3xl p-6 gap-4 max-w-[480px] self-center w-full"
            style={Platform.OS === 'web' ? { boxShadow: '0px 30px 60px rgba(0,54,42,0.18)' } as any : {}}
          >
            <View className="flex-row items-center gap-3 mb-2">
              <MaterialIcons name="sort" size={22} color="#006947" />
              <View>
                <Text className="text-xl font-bold font-headline text-on-surface">
                  Kategorirekkefølge
                </Text>
                <Text className="text-xs text-on-surface-variant font-body">
                  {storeName} — tilpass rekkefølgen til din rute
                </Text>
              </View>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              {orderedCategories.map((cat, index) => (
                <View
                  key={cat.id}
                  className="flex-row items-center py-3 px-2 gap-3"
                  style={index < orderedCategories.length - 1 ? { borderBottomWidth: 1, borderBottomColor: 'rgba(129,184,165,0.15)' } : {}}
                >
                  {/* Position number */}
                  <Text className="text-on-surface-variant text-sm font-bold w-6 text-center font-body">
                    {index + 1}
                  </Text>

                  {/* Category info */}
                  <Text className="text-lg mr-1">{cat.emoji}</Text>
                  <Text className="flex-1 font-bold text-on-surface font-body">{cat.name}</Text>

                  {/* Move buttons */}
                  <View className="flex-row gap-1">
                    <TouchableOpacity
                      className="w-8 h-8 rounded-lg bg-surface-container items-center justify-center"
                      onPress={() => moveCategory(cat.id, 'up')}
                      disabled={index === 0}
                      style={index === 0 ? { opacity: 0.3 } : {}}
                    >
                      <MaterialIcons name="keyboard-arrow-up" size={20} color="#2f6555" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="w-8 h-8 rounded-lg bg-surface-container items-center justify-center"
                      onPress={() => moveCategory(cat.id, 'down')}
                      disabled={index === orderedCategories.length - 1}
                      style={index === orderedCategories.length - 1 ? { opacity: 0.3 } : {}}
                    >
                      <MaterialIcons name="keyboard-arrow-down" size={20} color="#2f6555" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                className="flex-1 py-4 items-center rounded-xl border border-outline-variant/30"
                onPress={onClose}
              >
                <Text className="text-primary text-lg font-semibold font-body">Avbryt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-4 items-center rounded-xl bg-primary"
                onPress={handleSave}
              >
                <Text className="text-white text-lg font-semibold font-body">Lagre</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
