import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Project } from '../lib/projectsApi';
import { colors } from '../lib/theme';

type ProjectPickerProps = {
  projects: Project[];
  value: string | null;
  onChange: (projectId: string | null) => void;
};

const NONE_LABEL = 'Pa projekt';

export function ProjectPicker({ projects, value, onChange }: ProjectPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = value === null ? NONE_LABEL : projects.find((project) => project.id === value)?.name ?? NONE_LABEL;

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setIsOpen(true)}>
        <Ionicons name="briefcase-outline" size={14} color="#374151" />
        <Text style={styles.triggerText} numberOfLines={1}>
          {selectedLabel}
        </Text>
        <Ionicons name="chevron-down" size={12} color="#6b7280" />
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <View style={styles.menuWrapper} pointerEvents="box-none">
            <View style={styles.menu}>
              <ScrollView bounces={false}>
                <Pressable
                  style={styles.menuItem}
                  onPress={() => {
                    onChange(null);
                    setIsOpen(false);
                  }}
                >
                  <Text style={[styles.menuItemText, value === null && styles.menuItemTextActive]}>{NONE_LABEL}</Text>
                  {value === null && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                </Pressable>
                {projects.map((project) => (
                  <Pressable
                    key={project.id}
                    style={styles.menuItem}
                    onPress={() => {
                      onChange(project.id);
                      setIsOpen(false);
                    }}
                  >
                    <Text
                      style={[styles.menuItemText, value === project.id && styles.menuItemTextActive]}
                      numberOfLines={1}
                    >
                      {project.name}
                    </Text>
                    {value === project.id && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                  </Pressable>
                ))}
                {projects.length === 0 && <Text style={styles.emptyText}>Nuk ka projekte të krijuara.</Text>}
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
    maxWidth: 180,
  },
  backdrop: {
    flex: 1,
  },
  menuWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menu: {
    minWidth: 240,
    maxWidth: 300,
    maxHeight: 380,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    boxShadow: '0px 6px 16px rgba(0,0,0,0.2)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
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
