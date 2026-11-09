import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import {
  DarkTheme,
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { HowToPlayModal } from './src/components/HowToPlayModal';
import { DrillProvider, useDrill } from './src/context/DrillContext';
import { DailyDrillScreen } from './src/screens/DailyDrillScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { RootTabParamList } from './src/types';

const Tab = createBottomTabNavigator<RootTabParamList>();
export const navigationRef = createNavigationContainerRef<RootTabParamList>();

const AppTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0F172A',
    card: '#1E293B',
    text: '#F8FAFC',
    border: '#334155',
    primary: '#6366F1',
  },
};

const MainNavigation: React.FC = () => {
  const {
    progress,
    isHelpModalVisible,
    openHelpModal,
    closeHelpModal,
  } = useDrill();

  return (
    <>
      <NavigationContainer ref={navigationRef} theme={AppTheme}>
        <StatusBar style="light" />
        <Tab.Navigator
          initialRouteName="DailyDrill"
          screenOptions={({ route }) => ({
            headerStyle: {
              backgroundColor: '#0F172A',
              borderBottomWidth: 1,
              borderBottomColor: '#1E293B',
            },
            headerTitleStyle: {
              color: '#F8FAFC',
              fontWeight: '800',
              fontSize: 18,
            },
            headerRight: () => (
              <TouchableOpacity
                style={styles.helpButton}
                onPress={openHelpModal}
                activeOpacity={0.75}
                accessibilityLabel="How to play"
              >
                <Text style={styles.helpButtonText}>?</Text>
              </TouchableOpacity>
            ),
            tabBarStyle: {
              backgroundColor: '#1E293B',
              borderTopColor: '#334155',
              height: 62,
              paddingBottom: 8,
              paddingTop: 6,
            },
            tabBarActiveTintColor: '#818CF8',
            tabBarInactiveTintColor: '#64748B',
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: '600',
            },
            tabBarIcon: ({ color, size }) => {
              if (route.name === 'DailyDrill') {
                return <Ionicons name="calculator" size={size} color={color} />;
              }
              if (route.name === 'History') {
                return <Ionicons name="calendar" size={size} color={color} />;
              }
              return <Ionicons name="settings" size={size} color={color} />;
            },
          })}
        >
          <Tab.Screen
            name="DailyDrill"
            component={DailyDrillScreen}
            options={{
              title: 'Daily Calculus Drill 📐',
              tabBarLabel: 'Daily Drill',
            }}
          />
          <Tab.Screen
            name="History"
            component={HistoryScreen}
            options={{
              title: 'Drill History',
              tabBarLabel: 'History',
            }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              title: 'Settings & Backup',
              tabBarLabel: 'Settings',
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>

      {/* First-Time / "?" How-To-Play Popup Modal */}
      <HowToPlayModal
        visible={isHelpModalVisible}
        initialDoNotShowAgain={Number(progress.hide_onboarding_modal ?? 0) === 1}
        onClose={closeHelpModal}
      />
    </>
  );
};

export default function App() {
  useEffect(() => {
    const subscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const targetScreen =
          response.notification.request.content.data?.screen;
        if (targetScreen === 'DailyDrill' && navigationRef.isReady()) {
          navigationRef.navigate('DailyDrill');
        }
      });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <DrillProvider>
        <MainNavigation />
      </DrillProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  helpButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    borderWidth: 1.5,
    borderColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  helpButtonText: {
    color: '#A5B4FC',
    fontSize: 16,
    fontWeight: '800',
  },
});
