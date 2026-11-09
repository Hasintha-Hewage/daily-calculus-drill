import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DIFFICULTY_PROFILES } from '../ai/localMathAIModel';
import { useDrill } from '../context/DrillContext';
import {
  formatNotificationTime,
  sendTestDrillNotification,
} from '../services/notificationService';
import { CalculusTopicKey, SkillDifficulty, ThemeMode } from '../types';

const TIME_PRESETS = [
  { label: '06:30 AM', hour: 6, minute: 30 },
  { label: '07:00 AM', hour: 7, minute: 0 },
  { label: '08:00 AM', hour: 8, minute: 0 },
  { label: '09:00 AM', hour: 9, minute: 0 },
];

const DIFFICULTY_LIST: SkillDifficulty[] = [
  'BEGINNER',
  'INTERMEDIATE',
  'ADVANCED',
  'MASTER',
];

const TOPIC_LABELS: { key: CalculusTopicKey; label: string }[] = [
  { key: 'polynomial', label: 'Power Rule & Polynomials' },
  { key: 'trig', label: 'Trigonometric Functions' },
  { key: 'exponential', label: 'Exponential Functions' },
  { key: 'logarithmic', label: 'Logarithmic Functions' },
  { key: 'product_quotient', label: 'Product, Quotient & U-Sub' },
  { key: 'chain_by_parts', label: 'Chain Rule & Integration by Parts' },
];

export const SettingsScreen: React.FC = () => {
  const {
    progress,
    themeMode,
    themeColors,
    topicMastery,
    changeThemeMode,
    changeDifficulty,
    updateReminderSchedule,
    exportBackupJson,
    resetProgressData,
  } = useDrill();

  const [selectedHour, setSelectedHour] = useState<number>(
    progress.notification_hour ?? 7
  );
  const [selectedMinute, setSelectedMinute] = useState<number>(
    progress.notification_minute ?? 0
  );
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const adjustHour = (delta: number) => {
    setSelectedHour((prev) => (prev + delta + 24) % 24);
  };

  const adjustMinute = (delta: number) => {
    setSelectedMinute((prev) => (prev + delta + 60) % 60);
  };

  const handleThemeSelect = async (mode: ThemeMode) => {
    await changeThemeMode(mode);
    setStatusBanner(
      `Switched to ${mode === 'DARK' ? 'Dark' : 'Light'} Theme.`
    );
  };

  const handleDifficultyChange = async (diff: SkillDifficulty) => {
    await changeDifficulty(diff);
    setStatusBanner(
      `AI Experience Profile set to ${DIFFICULTY_PROFILES[diff].label}. A new problem is ready!`
    );
  };

  const handleSaveSchedule = async () => {
    await updateReminderSchedule(selectedHour, selectedMinute);
    setStatusBanner(
      `Daily notification scheduled for ${formatNotificationTime(
        selectedHour,
        selectedMinute
      )}.`
    );
  };

  const handlePresetSelect = async (hour: number, minute: number) => {
    setSelectedHour(hour);
    setSelectedMinute(minute);
    await updateReminderSchedule(hour, minute);
    setStatusBanner(
      `Daily notification updated to ${formatNotificationTime(hour, minute)}.`
    );
  };

  const handleTestNotification = async () => {
    await sendTestDrillNotification(progress.current_level);
    setStatusBanner('Sent a test notification to your system tray!');
  };

  const handleBackupData = async () => {
    try {
      const jsonBackup = await exportBackupJson();
      await Share.share({
        title: 'Daily Calculus Drill Backup',
        message: jsonBackup,
      });
    } catch {
      Alert.alert('Backup Error', 'Could not export backup data.');
    }
  };

  const handleResetProgress = () => {
    Alert.alert(
      'Reset All Progress?',
      'This will permanently clear your drill history, reset your streak and AI mastery profile, and return you to Level 1.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            await resetProgressData();
            setStatusBanner('Progress and AI profile reset back to Level 1.');
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      contentContainerStyle={styles.content}
    >
      {statusBanner && (
        <View style={styles.statusBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#10B981" />
          <Text style={styles.statusBannerText}>{statusBanner}</Text>
        </View>
      )}

      {/* App Appearance / Theme Radio Section */}
      <View
        style={[
          styles.card,
          { backgroundColor: themeColors.card, borderColor: themeColors.border },
        ]}
      >
        <View style={styles.cardHeader}>
          <Ionicons
            name={themeMode === 'DARK' ? 'moon-outline' : 'sunny-outline'}
            size={22}
            color={themeColors.primaryText}
          />
          <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>
            App Theme
          </Text>
        </View>
        <Text style={[styles.cardSubtitle, { color: themeColors.textMuted }]}>
          Switch between Dark (default) and Light appearance.
        </Text>

        {/* Radio Option: Dark Theme */}
        <TouchableOpacity
          style={[
            styles.radioOptionRow,
            {
              backgroundColor: themeColors.innerBox,
              borderColor:
                themeMode === 'DARK' ? themeColors.primary : themeColors.border,
            },
          ]}
          onPress={() => handleThemeSelect('DARK')}
          activeOpacity={0.75}
        >
          <View style={styles.radioLeft}>
            <View
              style={[
                styles.radioOuterCircle,
                {
                  borderColor:
                    themeMode === 'DARK'
                      ? themeColors.primary
                      : themeColors.textMuted,
                },
              ]}
            >
              {themeMode === 'DARK' && (
                <View
                  style={[
                    styles.radioInnerDot,
                    { backgroundColor: themeColors.primary },
                  ]}
                />
              )}
            </View>
            <View>
              <Text
                style={[styles.radioLabel, { color: themeColors.textPrimary }]}
              >
                Dark Theme (Default)
              </Text>
              <Text
                style={[styles.radioSublabel, { color: themeColors.textMuted }]}
              >
                Easy on the eyes for early morning drills
              </Text>
            </View>
          </View>
          <Ionicons
            name="moon"
            size={18}
            color={
              themeMode === 'DARK' ? themeColors.primaryText : themeColors.textMuted
            }
          />
        </TouchableOpacity>

        {/* Radio Option: Light Theme */}
        <TouchableOpacity
          style={[
            styles.radioOptionRow,
            {
              backgroundColor: themeColors.innerBox,
              borderColor:
                themeMode === 'LIGHT' ? themeColors.primary : themeColors.border,
            },
          ]}
          onPress={() => handleThemeSelect('LIGHT')}
          activeOpacity={0.75}
        >
          <View style={styles.radioLeft}>
            <View
              style={[
                styles.radioOuterCircle,
                {
                  borderColor:
                    themeMode === 'LIGHT'
                      ? themeColors.primary
                      : themeColors.textMuted,
                },
              ]}
            >
              {themeMode === 'LIGHT' && (
                <View
                  style={[
                    styles.radioInnerDot,
                    { backgroundColor: themeColors.primary },
                  ]}
                />
              )}
            </View>
            <View>
              <Text
                style={[styles.radioLabel, { color: themeColors.textPrimary }]}
              >
                Light Theme
              </Text>
              <Text
                style={[styles.radioSublabel, { color: themeColors.textMuted }]}
              >
                Clean, high-contrast paper look
              </Text>
            </View>
          </View>
          <Ionicons
            name="sunny"
            size={19}
            color={themeMode === 'LIGHT' ? '#F59E0B' : themeColors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* Local AI Experience & Topic Mastery Card */}
      <View
        style={[
          styles.card,
          { backgroundColor: themeColors.card, borderColor: themeColors.border },
        ]}
      >
        <View style={styles.cardHeader}>
          <Ionicons
            name="sparkles-outline"
            size={22}
            color={themeColors.primaryText}
          />
          <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>
            On-Device AI Skill & Difficulty
          </Text>
        </View>
        <Text style={[styles.cardSubtitle, { color: themeColors.textMuted }]}>
          Select your calculus experience level. The local Neuro-Symbolic AI
          model adapts problem difficulty and targets your weakest topics
          automatically.
        </Text>

        {DIFFICULTY_LIST.map((diffKey) => {
          const cfg = DIFFICULTY_PROFILES[diffKey];
          const active = progress.selected_difficulty === diffKey;
          return (
            <TouchableOpacity
              key={diffKey}
              style={[
                styles.diffOptionCard,
                {
                  backgroundColor: themeColors.innerBox,
                  borderColor: active
                    ? themeColors.primary
                    : themeColors.border,
                },
                active && styles.diffOptionCardActive,
              ]}
              onPress={() => handleDifficultyChange(diffKey)}
              activeOpacity={0.8}
            >
              <View style={styles.diffOptionHeader}>
                <Text
                  style={[
                    styles.diffOptionTitle,
                    {
                      color: active
                        ? themeColors.primaryText
                        : themeColors.textPrimary,
                    },
                  ]}
                >
                  {cfg.label}
                </Text>
                {active && (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={themeColors.primary}
                  />
                )}
              </View>
              <Text
                style={[styles.diffOptionDesc, { color: themeColors.textMuted }]}
              >
                {cfg.description}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Per-Topic Mastery Progress Bars */}
        <View
          style={[
            styles.masteryBox,
            {
              backgroundColor: themeColors.innerBox,
              borderColor: themeColors.border,
            },
          ]}
        >
          <View style={styles.masteryHeaderRow}>
            <Text
              style={[
                styles.masteryHeaderTitle,
                { color: themeColors.textMuted },
              ]}
            >
              AI TOPIC MASTERY PROFILE
            </Text>
            <Text
              style={[
                styles.masteryEloBadge,
                { color: themeColors.accentBlue },
              ]}
            >
              Skill Rating: {progress.skill_rating}
            </Text>
          </View>

          {TOPIC_LABELS.map(({ key, label }) => {
            const pct = Math.round((topicMastery[key] ?? 0.4) * 100);
            return (
              <View key={key} style={styles.masteryRow}>
                <View style={styles.masteryLabelRow}>
                  <Text
                    style={[
                      styles.masteryTopicText,
                      { color: themeColors.textSecondary },
                    ]}
                  >
                    {label}
                  </Text>
                  <Text
                    style={[
                      styles.masteryPctText,
                      { color: themeColors.textMuted },
                    ]}
                  >
                    {pct}%
                  </Text>
                </View>
                <View
                  style={[
                    styles.masteryTrack,
                    { backgroundColor: themeColors.card },
                  ]}
                >
                  <View
                    style={[
                      styles.masteryFill,
                      {
                        width: `${pct}%`,
                        backgroundColor:
                          pct >= 70
                            ? '#10B981'
                            : pct >= 45
                            ? '#6366F1'
                            : '#F59E0B',
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Notification Time Picker Card */}
      <View
        style={[
          styles.card,
          { backgroundColor: themeColors.card, borderColor: themeColors.border },
        ]}
      >
        <View style={styles.cardHeader}>
          <Ionicons
            name="notifications-outline"
            size={22}
            color={themeColors.primaryText}
          />
          <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>
            Daily Notification Schedule
          </Text>
        </View>
        <Text style={[styles.cardSubtitle, { color: themeColors.textMuted }]}>
          Choose when to receive your morning calculus challenge (Default: 07:00
          AM).
        </Text>

        {/* Stepper Time Picker */}
        <View
          style={[
            styles.pickerContainer,
            {
              backgroundColor: themeColors.innerBox,
              borderColor: themeColors.border,
            },
          ]}
        >
          <View style={styles.stepperColumn}>
            <TouchableOpacity
              style={[
                styles.stepperBtn,
                { backgroundColor: themeColors.card },
              ]}
              onPress={() => adjustHour(1)}
            >
              <Ionicons
                name="chevron-up"
                size={20}
                color={themeColors.textPrimary}
              />
            </TouchableOpacity>
            <Text
              style={[styles.timeDigits, { color: themeColors.textPrimary }]}
            >
              {String(selectedHour).padStart(2, '0')}
            </Text>
            <TouchableOpacity
              style={[
                styles.stepperBtn,
                { backgroundColor: themeColors.card },
              ]}
              onPress={() => adjustHour(-1)}
            >
              <Ionicons
                name="chevron-down"
                size={20}
                color={themeColors.textPrimary}
              />
            </TouchableOpacity>
            <Text style={[styles.unitLabel, { color: themeColors.textMuted }]}>
              HOUR (24H)
            </Text>
          </View>

          <Text
            style={[styles.colonSeparator, { color: themeColors.textMuted }]}
          >
            :
          </Text>

          <View style={styles.stepperColumn}>
            <TouchableOpacity
              style={[
                styles.stepperBtn,
                { backgroundColor: themeColors.card },
              ]}
              onPress={() => adjustMinute(5)}
            >
              <Ionicons
                name="chevron-up"
                size={20}
                color={themeColors.textPrimary}
              />
            </TouchableOpacity>
            <Text
              style={[styles.timeDigits, { color: themeColors.textPrimary }]}
            >
              {String(selectedMinute).padStart(2, '0')}
            </Text>
            <TouchableOpacity
              style={[
                styles.stepperBtn,
                { backgroundColor: themeColors.card },
              ]}
              onPress={() => adjustMinute(-5)}
            >
              <Ionicons
                name="chevron-down"
                size={20}
                color={themeColors.textPrimary}
              />
            </TouchableOpacity>
            <Text style={[styles.unitLabel, { color: themeColors.textMuted }]}>
              MINUTE
            </Text>
          </View>
        </View>

        <Text
          style={[
            styles.formattedTimePreview,
            { color: themeColors.primaryText },
          ]}
        >
          Selected: {formatNotificationTime(selectedHour, selectedMinute)}
        </Text>

        {/* Quick Presets */}
        <View style={styles.presetsRow}>
          {TIME_PRESETS.map((preset) => {
            const active =
              selectedHour === preset.hour && selectedMinute === preset.minute;
            return (
              <TouchableOpacity
                key={preset.label}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: themeColors.innerBox,
                    borderColor: active
                      ? themeColors.primary
                      : themeColors.border,
                  },
                  active && styles.presetChipActive,
                ]}
                onPress={() => handlePresetSelect(preset.hour, preset.minute)}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    {
                      color: active
                        ? themeColors.primaryText
                        : themeColors.textMuted,
                    },
                  ]}
                >
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: themeColors.primary }]}
          onPress={handleSaveSchedule}
        >
          <Ionicons name="alarm-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>Save Notification Time</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.secondaryBtn,
            { borderColor: themeColors.primary },
          ]}
          onPress={handleTestNotification}
        >
          <Ionicons
            name="paper-plane-outline"
            size={16}
            color={themeColors.primaryText}
          />
          <Text
            style={[
              styles.secondaryBtnText,
              { color: themeColors.primaryText },
            ]}
          >
            Send Test Notification Now
          </Text>
        </TouchableOpacity>
      </View>

      {/* Data Management Card */}
      <View
        style={[
          styles.card,
          { backgroundColor: themeColors.card, borderColor: themeColors.border },
        ]}
      >
        <View style={styles.cardHeader}>
          <Ionicons
            name="server-outline"
            size={22}
            color={themeColors.accentBlue}
          />
          <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>
            Data & Progress Management
          </Text>
        </View>
        <Text style={[styles.cardSubtitle, { color: themeColors.textMuted }]}>
          All progress, AI mastery weights, and history are stored locally in
          SQLite on your device.
        </Text>

        <TouchableOpacity
          style={[
            styles.backupBtn,
            { borderColor: themeColors.accentBlue },
          ]}
          onPress={handleBackupData}
        >
          <Ionicons
            name="download-outline"
            size={18}
            color={themeColors.accentBlue}
          />
          <Text
            style={[styles.backupBtnText, { color: themeColors.accentBlue }]}
          >
            Export / Backup SQLite Data (JSON)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dangerBtn}
          onPress={handleResetProgress}
        >
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
          <Text style={styles.dangerBtnText}>Reset All Progress to Level 1</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  statusBannerText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  card: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    marginBottom: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  radioOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  radioLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  radioOuterCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInnerDot: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
  },
  radioLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  radioSublabel: {
    fontSize: 12,
    marginTop: 2,
  },
  diffOptionCard: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  diffOptionCardActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  diffOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  diffOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  diffOptionDesc: {
    fontSize: 12,
  },
  masteryBox: {
    marginTop: 10,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  masteryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  masteryHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  masteryEloBadge: {
    fontSize: 12,
    fontWeight: '700',
  },
  masteryRow: {
    marginBottom: 8,
  },
  masteryLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  masteryTopicText: {
    fontSize: 12,
    fontWeight: '600',
  },
  masteryPctText: {
    fontSize: 12,
    fontWeight: '700',
  },
  masteryTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  masteryFill: {
    height: '100%',
    borderRadius: 3,
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  stepperColumn: {
    alignItems: 'center',
    width: 90,
  },
  stepperBtn: {
    padding: 6,
    borderRadius: 8,
    width: 48,
    alignItems: 'center',
  },
  timeDigits: {
    fontSize: 32,
    fontWeight: '800',
    marginVertical: 6,
    fontVariant: ['tabular-nums'],
  },
  unitLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
  },
  colonSeparator: {
    fontSize: 30,
    fontWeight: '800',
    marginHorizontal: 10,
    paddingBottom: 18,
  },
  formattedTimePreview: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 16,
  },
  presetChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  presetChipActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.14)',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  backupBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  backupBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  dangerBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dangerBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
});
