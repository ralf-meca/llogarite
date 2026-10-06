import { AirplaneTiltIcon, FolderIcon, CaretDownIcon, CheckIcon } from 'phosphor-react-native';
import { useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from '../lib/i18n';
import type { Project } from '../lib/projectsApi';
import { colors } from '../lib/theme';

type ProjectPickerProps = {
  projects: Project[];
  value: string | null;
  onChange: (projectId: string | null) => void;
  // A small pill as wide as its label, the same pill stretched to fill the space it
  // is given (half a row, beside another), or a field as wide as the text inputs it
  // sits under.
  variant?: 'pill' | 'wide-pill' | 'field';
};

const MENU_GAP = 6;
const MENU_MIN_WIDTH = 220;
const MENU_MAX_HEIGHT = 320;
const SCREEN_MARGIN = 16;
// One row of the menu, used to guess its height before it is laid out.
const MENU_ROW_HEIGHT = 44;

type Anchor = { x: number; y: number; width: number; height: number };

export function ProjectPicker({ projects, value, onChange, variant = 'pill' }: ProjectPickerProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const window = useWindowDimensions();
  // The modal's own height, once laid out: the window's can leave the system bars out.
  const [modalHeight, setModalHeight] = useState(0);
  const screenHeight = modalHeight || window.height;

  // The menu drops from the trigger, so where the trigger is on screen has to be
  // known before it opens.
  const open = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      // Android measures from under the status bar, while the modal is drawn from the
      // very top of the screen: without this the menu sits a status bar too high.
      const statusBarOffset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
      setAnchor({ x, y: y + statusBarOffset, width, height });
      setIsOpen(true);
    });
  };

  // As wide as the trigger (but never too narrow to read), kept on screen, and below
  // the trigger unless there is more room above it.
  const menuWidth = Math.min(Math.max(anchor?.width ?? 0, MENU_MIN_WIDTH), window.width - SCREEN_MARGIN * 2);
  const menuLeft = Math.min(Math.max(anchor?.x ?? 0, SCREEN_MARGIN), window.width - SCREEN_MARGIN - menuWidth);
  const spaceBelow = screenHeight - ((anchor?.y ?? 0) + (anchor?.height ?? 0)) - MENU_GAP - SCREEN_MARGIN;
  const spaceAbove = (anchor?.y ?? 0) - MENU_GAP - SCREEN_MARGIN;
  const wantedHeight = Math.min(MENU_MAX_HEIGHT, (projects.length + 1) * MENU_ROW_HEIGHT + 16);
  const opensUp = spaceBelow < wantedHeight && spaceAbove > spaceBelow;
  const menuPosition = opensUp
    ? { bottom: screenHeight - (anchor?.y ?? 0) + MENU_GAP, maxHeight: Math.min(MENU_MAX_HEIGHT, spaceAbove) }
    : { top: (anchor?.y ?? 0) + (anchor?.height ?? 0) + MENU_GAP, maxHeight: Math.min(MENU_MAX_HEIGHT, spaceBelow) };
  const noneLabel = t('projectPicker.none');
  const selected = value === null ? undefined : projects.find((project) => project.id === value);
  const selectedLabel = selected?.name ?? noneLabel;
  // A trip wears the airplane everywhere else it appears, so it does here too.
  const SelectedIcon = selected?.kind === 'trip' ? AirplaneTiltIcon : FolderIcon;

  return (
    <>
      {variant === 'field' ? (
        <Pressable ref={triggerRef} style={styles.fieldTrigger} onPress={open}>
          <SelectedIcon size={18} color={colors.textMuted} />
          <Text style={styles.fieldTriggerText} numberOfLines={1}>
            {selectedLabel}
          </Text>
          <CaretDownIcon size={14} color={colors.textMuted} />
        </Pressable>
      ) : (
        <Pressable
          ref={triggerRef}
          style={[styles.trigger, variant === 'wide-pill' && styles.triggerWide]}
          onPress={open}
        >
          <SelectedIcon size={14} color="#374151" />
          <Text style={[styles.triggerText, variant === 'wide-pill' && styles.triggerTextWide]} numberOfLines={1}>
            {selectedLabel}
          </Text>
          <CaretDownIcon size={12} color="#6b7280" />
        </Pressable>
      )}

      {/* Drawn under the status bar too, so the trigger's place in the window is also
          its place in the modal. */}
      <Modal
        visible={isOpen}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <View
            style={styles.menuWrapper}
            pointerEvents="box-none"
            onLayout={(event) => setModalHeight(event.nativeEvent.layout.height)}
          >
            <View style={[styles.menu, { left: menuLeft, width: menuWidth }, menuPosition]}>
              <ScrollView bounces={false}>
                <Pressable
                  style={styles.menuItem}
                  onPress={() => {
                    onChange(null);
                    setIsOpen(false);
                  }}
                >
                  <Text style={[styles.menuItemText, value === null && styles.menuItemTextActive]}>{noneLabel}</Text>
                  {value === null && <CheckIcon size={16} weight="bold" color={colors.primary} />}
                </Pressable>
                {projects.map((project) => {
                  const isSelected = value === project.id;
                  const KindIcon = project.kind === 'trip' ? AirplaneTiltIcon : FolderIcon;
                  return (
                    <Pressable
                      key={project.id}
                      style={styles.menuItem}
                      onPress={() => {
                        onChange(project.id);
                        setIsOpen(false);
                      }}
                    >
                      <View style={styles.menuItemLabel}>
                        <KindIcon size={16} color={isSelected ? colors.primary : '#6b7280'} />
                        <Text style={[styles.menuItemText, isSelected && styles.menuItemTextActive]} numberOfLines={1}>
                          {project.name}
                        </Text>
                      </View>
                      {isSelected && <CheckIcon size={16} weight="bold" color={colors.primary} />}
                    </Pressable>
                  );
                })}
                {projects.length === 0 && <Text style={styles.emptyText}>{t('projectPicker.empty')}</Text>}
              </ScrollView>
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    boxShadow: '0px 1px 3px rgba(0,0,0,0.15)',
  },
  triggerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    flexShrink: 1,
  },
  triggerWide: {
    alignSelf: 'stretch',
  },
  // Takes the slack, so the arrow sits at the far end.
  triggerTextWide: {
    flex: 1,
  },
  // Matches GlassTextInput, so it lines up with the fields above it.
  fieldTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.primaryTint,
  },
  fieldTriggerText: {
    flex: 1,
    fontSize: 16,
    color: colors.textDark,
  },
  backdrop: {
    flex: 1,
  },
  menuWrapper: {
    flex: 1,
  },
  menu: {
    position: 'absolute',
    paddingVertical: 6,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    boxShadow: '0px 6px 16px rgba(0,0,0,0.2)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    flexShrink: 1,
  },
  menuItemTextActive: {
    color: colors.primary,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 13,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
});
