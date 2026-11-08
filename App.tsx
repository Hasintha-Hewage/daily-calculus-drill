import React, { useEffect } from 'react';
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
import { DrillProvider } from './src/context/DrillContext';
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

export default function App() {
  useEffect(() => {
    // Handle clicking the daily push notification to navigate directly to DailyDrill
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
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="calculator" size={size} color={color} />
                ),
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
      </DrillProvider>
    </SafeAreaProvider>
  );
}
