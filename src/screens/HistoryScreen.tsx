import React, { useMemo } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MathRenderer } from '../components/MathRenderer';
import { useDrill } from '../context/DrillContext';
import { getLocalDateString } from '../database/db';
import { DrillHistory } from '../types';

export const HistoryScreen: React.FC = () => {
  const { history, progress } = useDrill();

  const stats = useMemo(() => {
    const solvedCount = history.filter((item) => item.status === 'SOLVED').length;
    const completedCount = history.filter(
      (item) => item.status === 'SOLVED' || item.status === 'FAILED'
    ).length;
    const accuracy =
      completedCount > 0 ? Math.round((solvedCount / completedCount) * 100) : 0;

    return {
      solvedCount,
      completedCount,
      accuracy,
    };
  }, [history]);

  // Build 14-day mini calendar strip
  const recentCalendarDays = useMemo(() => {
    const mapByDate = new Map<string, DrillHistory>();
    history.forEach((h) => mapByDate.set(h.date, h));

    const days: { dateStr: string; dayLabel: string; status: string }[] = [];
    const now = new Date();

    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = getLocalDateString(d);
      const record = mapByDate.get(dateStr);
      days.push({
        dateStr,
        dayLabel: String(d.getDate()),
        status: record?.status ?? 'NONE',
      });
    }
    return days;
  }, [history]);

  const formatTimeTaken = (seconds: number | null): string => {
    if (!seconds || seconds <= 0) return '—';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const rem = seconds % 60;
    return `${mins}m ${rem}s`;
  };

  const renderBadge = (status: DrillHistory['status']) => {
    if (status === 'SOLVED') {
      return (
        <View style={[styles.statusBadge, styles.badgeSolved]}>
          <Ionicons name="checkmark-circle" size={14} color="#34D399" />
          <Text style={[styles.statusBadgeText, { color: '#34D399' }]}>
            SOLVED
          </Text>
        </View>
      );
    }
    if (status === 'FAILED' || status === 'SKIPPED') {
      return (
        <View style={[styles.statusBadge, styles.badgeFailed]}>
          <Ionicons name="close-circle" size={14} color="#F87171" />
          <Text style={[styles.statusBadgeText, { color: '#F87171' }]}>
            {status}
          </Text>
        </View>
      );
    }
    return (
      <View style={[styles.statusBadge, styles.badgePending]}>
        <Ionicons name="hourglass-outline" size={14} color="#FBBF24" />
        <Text style={[styles.statusBadgeText, { color: '#FBBF24' }]}>
          IN PROGRESS
        </Text>
      </View>
    );
  };

  const renderHistoryItem = ({ item }: { item: DrillHistory }) => (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <View style={styles.dateLevelWrap}>
          <Text style={styles.cardDate}>{item.date}</Text>
          <View style={styles.levelPill}>
            <Text style={styles.levelPillText}>Level {item.level}</Text>
          </View>
        </View>
        {renderBadge(item.status)}
      </View>

      <View style={styles.equationContainer}>
        <MathRenderer
          latex={item.problem_latex}
          fontSize={20}
          color="#F8FAFC"
          height={62}
          compact
        />
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.answerCol}>
          <Text style={styles.footerLabel}>
            Target: <Text style={styles.footerValue}>{item.correct_answer}</Text>
          </Text>
          {item.user_answer ? (
            <Text style={styles.footerLabel}>
              Your Input:{' '}
              <Text style={styles.footerValue}>{item.user_answer}</Text>
            </Text>
          ) : null}
        </View>

        <View style={styles.timeBox}>
          <Ionicons name="timer-outline" size={14} color="#94A3B8" />
          <Text style={styles.timeText}>
            {formatTimeTaken(item.duration_seconds)}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={history}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {/* Top Summary Metrics */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{stats.solvedCount}</Text>
                <Text style={styles.summaryLabel}>Solved</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{stats.accuracy}%</Text>
                <Text style={styles.summaryLabel}>Solve Rate</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{progress.streak} 🔥</Text>
                <Text style={styles.summaryLabel}>Streak</Text>
              </View>
            </View>

            {/* 14-Day Calendar Activity Strip */}
            <View style={styles.calendarCard}>
              <Text style={styles.sectionTitle}>LAST 14 DAYS</Text>
              <View style={styles.calendarGrid}>
                {recentCalendarDays.map((day) => {
                  const isSolved = day.status === 'SOLVED';
                  const isFailed =
                    day.status === 'FAILED' || day.status === 'SKIPPED';
                  const isPending = day.status === 'PENDING';
                  return (
                    <View
                      key={day.dateStr}
                      style={[
                        styles.calendarCell,
                        isSolved && styles.calendarCellSolved,
                        isFailed && styles.calendarCellFailed,
                        isPending && styles.calendarCellPending,
                      ]}
                    >
                      <Text style={styles.calendarDayText}>{day.dayLabel}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <Text style={styles.sectionTitle}>CHRONOLOGICAL LOG</Text>
          </View>
        }
        renderItem={renderHistoryItem}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="calendar-outline" size={40} color="#475569" />
            <Text style={styles.emptyText}>No calculus drills recorded yet.</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryValue: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  calendarCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'space-between',
  },
  calendarCell: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarCellSolved: {
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
    borderColor: '#10B981',
  },
  calendarCellFailed: {
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
    borderColor: '#EF4444',
  },
  calendarCellPending: {
    backgroundColor: 'rgba(251, 191, 36, 0.18)',
    borderColor: '#F59E0B',
  },
  calendarDayText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateLevelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardDate: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  levelPill: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  levelPillText: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeSolved: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderColor: '#10B981',
  },
  badgeFailed: {
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    borderColor: '#EF4444',
  },
  badgePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderColor: '#F59E0B',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  equationContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  answerCol: {
    flex: 1,
    gap: 2,
  },
  footerLabel: {
    color: '#94A3B8',
    fontSize: 12,
  },
  footerValue: {
    color: '#E2E8F0',
    fontWeight: '600',
  },
  timeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#64748B',
    marginTop: 10,
    fontSize: 14,
  },
});
