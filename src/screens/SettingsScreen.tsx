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
import { CalculusTopicKey, SkillDifficulty } from '../types';

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
    topicMastery,
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
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {statusBanner && (
        <View style={styles.statusBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#34D399" />
          <Text style={styles.statusBannerText}>{statusBanner}</Text>
        </View>
      )}

      {/* Local AI Experience & Topic Mastery Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="sparkles-outline" size={22} color="#A5B4FC" />
          <Text style={styles.cardTitle}>
            On-Device AI Skill & Difficulty
          </Text>
        </View>
        <Text style={styles.cardSubtitle}>
          Select your calculus experience level. The local Neuro-Symbolic AI model adapts problem difficulty and targets your weakest topics automatically.
        </Text>

        {DIFFICULTY_LIST.map((diffKey) => {
          const cfg = DIFFICULTY_PROFILES[diffKey];
          const active = progress.selected_difficulty === diffKey;
          return (
            <TouchableOpacity
              key={diffKey}
              style={[
                styles.diffOptionCard,
                active && styles.diffOptionCardActive,
              ]}
              onPress={() => handleDifficultyChange(diffKey)}
              activeOpacity={0.8}
            >
              <View style={styles.diffOptionHeader}>
                <Text
                  style={[
                    styles.diffOptionTitle,
                    active && styles.diffOptionTitleActive,
                  ]}
                >
                  {cfg.label}
                </Text>
                {active && (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color="#818CF8"
                  />
                )}
              </View>
              <Text style={styles.diffOptionDesc}>{cfg.description}</Text>
            </TouchableOpacity>
          );
        })}

        {/* Per-Topic Mastery Progress Bars */}
        <View style={styles.masteryBox}>
          <View style={styles.masteryHeaderRow}>
            <Text style={styles.masteryHeaderTitle}>
              AI TOPIC MASTERY PROFILE
            </Text>
            <Text style={styles.masteryEloBadge}>
              Skill Rating: {progress.skill_rating}
            </Text>
          </View>

          {TOPIC_LABELS.map(({ key, label }) => {
            const pct = Math.round((topicMastery[key] ?? 0.4) * 100);
            return (
              <View key={key} style={styles.masteryRow}>
                <View style={styles.masteryLabelRow}>
                  <Text style={styles.masteryTopicText}>{label}</Text>
                  <Text style={styles.masteryPctText}>{pct}%</Text>
                </View>
                <View style={styles.masteryTrack}>
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
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="notifications-outline" size={22} color="#818CF8" />
          <Text style={styles.cardTitle}>Daily Notification Schedule</Text>
        </View>
        <Text style={styles.cardSubtitle}>
          Choose when to receive your morning calculus challenge (Default: 07:00 AM).
        </Text>

        {/* Stepper Time Picker */}
        <View style={styles.pickerContainer}>
          <View style={styles.stepperColumn}>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => adjustHour(1)}
            >
              <Ionicons name="chevron-up" size={20} color="#E2E8F0" />
            </TouchableOpacity>
            <Text style={styles.timeDigits}>
              {String(selectedHour).padStart(2, '0')}
            </Text>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => adjustHour(-1)}
            >
              <Ionicons name="chevron-down" size={20} color="#E2E8F0" />
            </TouchableOpacity>
            <Text style={styles.unitLabel}>HOUR (24H)</Text>
          </View>

          <Text style={styles.colonSeparator}>:</Text>

          <View style={styles.stepperColumn}>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => adjustMinute(5)}
            >
              <Ionicons name="chevron-up" size={20} color="#E2E8F0" />
            </TouchableOpacity>
            <Text style={styles.timeDigits}>
              {String(selectedMinute).padStart(2, '0')}
            </Text>
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => adjustMinute(-5)}
            >
              <Ionicons name="chevron-down" size={20} color="#E2E8F0" />
            </TouchableOpacity>
            <Text style={styles.unitLabel}>MINUTE</Text>
          </View>
        </View>

        <Text style={styles.formattedTimePreview}>
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
                style={[styles.presetChip, active && styles.presetChipActive]}
                onPress={() => handlePresetSelect(preset.hour, preset.minute)}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    active && styles.presetChipTextActive,
                  ]}
                >
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleSaveSchedule}
        >
          <Ionicons name="alarm-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>Save Notification Time</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={handleTestNotification}
        >
          <Ionicons name="paper-plane-outline" size={16} color="#A5B4FC" />
          <Text style={styles.secondaryBtnText}>
            Send Test Notification Now
          </Text>
        </TouchableOpacity>
      </View>

      {/* Data Management Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="server-outline" size={22} color="#38BDF8" />
          <Text style={styles.cardTitle}>Data & Progress Management</Text>
        </View>
        <Text style={styles.cardSubtitle}>
          All progress, AI mastery weights, and history are stored locally in SQLite on your device.
        </Text>

        <TouchableOpacity
          style={styles.backupBtn}
          onPress={handleBackupData}
        >
          <Ionicons name="download-outline" size={18} color="#38BDF8" />
          <Text style={styles.backupBtnText}>
            Export / Backup SQLite Data (JSON)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dangerBtn}
          onPress={handleResetProgress}
        >
          <Ionicons name="trash-outline" size={18} color="#F87171" />
          <Text style={styles.dangerBtnText}>Reset All Progress to Level 1</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
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
    color: '#6EE7B7',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  diffOptionCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 8,
  },
  diffOptionCardActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.16)',
    borderColor: '#6366F1',
  },
  diffOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  diffOptionTitle: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
  diffOptionTitleActive: {
    color: '#A5B4FC',
    fontWeight: '800',
  },
  diffOptionDesc: {
    color: '#94A3B8',
    fontSize: 12,
  },
  masteryBox: {
    marginTop: 10,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  masteryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  masteryHeaderTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  masteryEloBadge: {
    color: '#38BDF8',
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
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  masteryPctText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  masteryTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1E293B',
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
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepperColumn: {
    alignItems: 'center',
    width: 90,
  },
  stepperBtn: {
    padding: 6,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    width: 48,
    alignItems: 'center',
  },
  timeDigits: {
    color: '#F8FAFC',
    fontSize: 32,
    fontWeight: '800',
    marginVertical: 6,
    fontVariant: ['tabular-nums'],
  },
  unitLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
  },
  colonSeparator: {
    color: '#94A3B8',
    fontSize: 30,
    fontWeight: '800',
    marginHorizontal: 10,
    paddingBottom: 18,
  },
  formattedTimePreview: {
    textAlign: 'center',
    color: '#A5B4FC',
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
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  presetChipActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#6366F1',
  },
  presetChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: '#A5B4FC',
    fontWeight: '700',
  },
  primaryBtn: {
    backgroundColor: '#6366F1',
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
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderWidth: 1,
    borderColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryBtnText: {
    color: '#A5B4FC',
    fontSize: 14,
    fontWeight: '600',
  },
  backupBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  backupBtnText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '700',
  },
  dangerBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
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
    color: '#F87171',
    fontSize: 14,
    fontWeight: '700',
  },
});
