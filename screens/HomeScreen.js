// screens/HomeScreen.js  (SCHOOL DRIVER HOME - YELLOW THEME)

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  useWindowDimensions,
  Alert,
  PermissionsAndroid,
  Platform,
  NativeModules,
  AppState,
  RefreshControl,
} from 'react-native';

import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from 'react-native-geolocation-service';
import {useFocusEffect} from '@react-navigation/native';

// ============================================================
// API
// ============================================================

const API_BASE_URL = 'https://blackpathsoftwaresolutions.com/api';

// ============================================================
// NATIVE ANDROID LOCATION SERVICE
// ============================================================

const {LocationForegroundService} = NativeModules;

// ============================================================
// SCREEN NAMES  (must match your navigator names)
// ============================================================

const ROUTE_MAP_SCREEN = 'RouteMapScreen';
const DAILY_TRIP_SCREEN = 'DailyTripScreen';
const PROFILE_SCREEN = 'Profile';

// ============================================================
// YELLOW THEME
// ============================================================

const C = {
  sandal: '#FFF6E0',
  yellow: '#FFC400',
  yellowSoft: '#FFD84D',
  amber: '#F29D00',
  gold: '#B77A00',
  brown: '#3A2A00',
  brownSoft: '#7A5A1E',
  muted: '#8A7650',
  chip: '#FFF0BF',
  green: '#16A34A',
  red: '#DC2626',
};

const Txt = props => <Text allowFontScaling={false} {...props} />;

// ============================================================
// SAFE PERMISSION REQUEST
// Retries when Android says "not attached to an Activity"
// ============================================================

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const requestWithActivityRetry = async requestFn => {
  const maxTries = 6;

  for (let i = 0; i < maxTries; i++) {
    if (AppState.currentState !== 'active') {
      await sleep(500);
      continue;
    }

    try {
      return await requestFn();
    } catch (error) {
      const notAttached =
        error?.code === 'E_INVALID_ACTIVITY' ||
        String(error?.message || '').includes('not attached to an Activity');

      if (!notAttached || i === maxTries - 1) {
        throw error;
      }

      console.log('ACTIVITY NOT READY, RETRY', i + 1);
      await sleep(700);
    }
  }

  throw new Error('Activity not available for permission request.');
};

// ============================================================
// HOME SCREEN
// ============================================================

export default function HomeScreen({navigation}) {
  const {width} = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const k = Math.min(width / 411, 1.3);
  const d = n => n * k;

  // ==========================================================
  // STATE
  // ==========================================================

  const [onDuty, setOnDuty] = useState(false);
  const [loadingDuty, setLoadingDuty] = useState(false);
  const [driverId, setDriverId] = useState(null);
  const [driverName, setDriverName] = useState('Driver');
  const [tab, setTab] = useState('Home');
  const [refreshing, setRefreshing] = useState(false);

  // today's school trip numbers
  const [totalKids, setTotalKids] = useState(0);
  const [picked, setPicked] = useState(0);
  const [missed, setMissed] = useState(0);

  const watchIdRef = useRef(null);

  // ==========================================================
  // LOAD DRIVER
  // ==========================================================

  useEffect(() => {
    loadDriver();

    return () => {
      // Android foreground service must continue when this
      // screen unmounts.
      if (Platform.OS === 'ios') {
        stopLocationTracking();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDriver = async () => {
    try {
      const storedUserId = await AsyncStorage.getItem('userId');
      const storedName = await AsyncStorage.getItem('userName');

      if (storedName) {
        setDriverName(storedName);
      }

      if (!storedUserId) {
        Alert.alert('Login Required', 'Driver login information not found.');
        return;
      }

      const id = Number(storedUserId);

      if (!id || id <= 0) {
        Alert.alert('Driver Error', 'Invalid driver ID.');
        return;
      }

      setDriverId(id);

      await getDutyStatus(id);
    } catch (error) {
      console.log('LOAD DRIVER ERROR:', error);
    }
  };

  // ==========================================================
  // TODAY'S TRIP NUMBERS  (refreshes every time Home is opened)
  // ==========================================================

  const loadTripNumbers = useCallback(async () => {
    try {
      const id = await AsyncStorage.getItem('userId');
      if (!id) {
        return;
      }

      const [kidsRes, tripRes] = await Promise.all([
        fetch(`${API_BASE_URL}/driver/children?user_id=${id}`, {
          headers: {Accept: 'application/json'},
        }),
        fetch(`${API_BASE_URL}/driver/daily-trip?user_id=${id}`, {
          headers: {Accept: 'application/json'},
        }),
      ]);

      const kids = await kidsRes.json();
      const trip = await tripRes.json();

      if (kidsRes.ok && kids?.status === 'success') {
        setTotalKids((kids.children || []).length);
      }

      if (tripRes.ok && trip?.status === 'success') {
        setPicked(trip.summary?.picked || 0);
        setMissed(trip.summary?.missed || 0);
      }
    } catch (error) {
      console.log('TRIP NUMBERS ERROR:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTripNumbers();
    }, [loadTripNumbers]),
  );

  // ==========================================================
  // GET DUTY STATUS
  // ==========================================================

  const getDutyStatus = async userId => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/driver/status?user_id=${userId}`,
        {
          method: 'GET',
          headers: {Accept: 'application/json'},
        },
      );

      const data = await response.json();

      console.log('DUTY STATUS:', data);

      if (response.ok && data.status === 'success') {
        const status =
          data.on_duty === true || data.on_duty === 1 || data.on_duty === '1';

        setOnDuty(status);

        if (status) {
          await startLocationTracking(userId);
        }
      }
    } catch (error) {
      console.log('DUTY STATUS ERROR:', error);
    }
  };

  // ==========================================================
  // DUTY TOGGLE
  // ==========================================================

  const toggleDuty = async () => {
    console.log('DUTY BUTTON PRESSED, driverId =', driverId);

    if (loadingDuty) {
      return;
    }

    if (!driverId) {
      Alert.alert(
        'Driver not found',
        'userId is missing in storage. Please log in again.',
      );
      return;
    }

    const newDutyStatus = !onDuty;

    try {
      setLoadingDuty(true);

      const response = await fetch(`${API_BASE_URL}/driver/duty`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: driverId,
          status: newDutyStatus ? 'on' : 'off',
        }),
      });

      const data = await response.json();

      console.log('DUTY RESPONSE:', data);

      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || 'Duty update failed');
      }

      if (newDutyStatus) {
        const started = await startLocationTracking(driverId);

        if (!started) {
          // ROLLBACK BACKEND DUTY
          try {
            await fetch(`${API_BASE_URL}/driver/duty`, {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                user_id: driverId,
                status: 'off',
              }),
            });
          } catch (rollbackError) {
            console.log('DUTY ROLLBACK ERROR:', rollbackError);
          }

          setOnDuty(false);

          throw new Error('Location tracking could not be started.');
        }

        setOnDuty(true);
      } else {
        await stopLocationTracking();

        setOnDuty(false);
      }
    } catch (error) {
      console.log('TOGGLE DUTY ERROR:', error);

      Alert.alert(
        'Duty Update Failed',
        error?.message || 'Unable to update duty status.',
      );
    } finally {
      setLoadingDuty(false);
    }
  };

  // ==========================================================
  // START LOCATION TRACKING
  // ==========================================================

  const startLocationTracking = async userId => {
    if (!userId || Number(userId) <= 0) {
      console.log('INVALID DRIVER ID FOR LOCATION SERVICE');
      return false;
    }

    try {
      const hasPermission = await requestLocationPermission();

      if (!hasPermission) {
        Alert.alert(
          'Location Permission Required',
          'Please allow Precise Location permission to start vehicle tracking.',
        );
        return false;
      }

      console.log('LOCATION PERMISSION GRANTED');

      // ANDROID NATIVE FOREGROUND SERVICE
      if (Platform.OS === 'android') {
        if (
          !LocationForegroundService ||
          !LocationForegroundService.startService
        ) {
          console.log('LocationForegroundService NativeModule not available');

          Alert.alert(
            'Tracking Error',
            'Location foreground service is not connected to the app.',
          );

          return false;
        }

        console.log('STARTING ANDROID FOREGROUND LOCATION SERVICE', userId);

        await LocationForegroundService.startService(Number(userId));

        console.log('ANDROID FOREGROUND LOCATION SERVICE STARTED', userId);

        return true;
      }

      // IOS LOCATION WATCHER
      if (Platform.OS === 'ios') {
        if (watchIdRef.current !== null) {
          return true;
        }

        console.log('STARTING IOS GPS TRACKING');

        watchIdRef.current = Geolocation.watchPosition(
          position => {
            const {latitude, longitude, accuracy, speed} = position.coords;

            console.log('IOS DRIVER LOCATION:', {
              latitude,
              longitude,
              accuracy,
              speed,
            });

            sendLocationToServer({latitude, longitude, accuracy, speed});
          },

          error => {
            console.log('IOS GPS ERROR:', error);

            if (error?.code === 1) {
              Alert.alert(
                'Location Permission',
                'Please allow location permission in Settings to send live location.',
              );
            }
          },

          {
            enableHighAccuracy: true,
            distanceFilter: 10,
            interval: 10000,
            fastestInterval: 5000,
            showsBackgroundLocationIndicator: true,
            forceRequestLocation: true,
            useSignificantChanges: false,
          },
        );

        return true;
      }

      return false;
    } catch (error) {
      console.log('START LOCATION SERVICE ERROR:', error);

      Alert.alert(
        'Tracking Error',
        error?.message || 'Unable to start live location tracking.',
      );

      return false;
    }
  };

  // ==========================================================
  // STOP LOCATION TRACKING
  // ==========================================================

  const stopLocationTracking = async () => {
    try {
      if (Platform.OS === 'android') {
        if (LocationForegroundService && LocationForegroundService.stopService) {
          await LocationForegroundService.stopService();

          console.log('ANDROID FOREGROUND LOCATION SERVICE STOPPED');
        }

        return;
      }

      if (watchIdRef.current !== null) {
        console.log('STOPPING IOS GPS TRACKING');

        Geolocation.clearWatch(watchIdRef.current);

        watchIdRef.current = null;
      }
    } catch (error) {
      console.log('STOP LOCATION SERVICE ERROR:', error);
    }
  };

  // ==========================================================
  // LOCATION PERMISSION
  // ==========================================================

  const requestLocationPermission = async () => {
    try {
      if (Platform.OS !== 'android') {
        return true;
      }

      const fineLocation = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
      const coarseLocation =
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;

      const fineAlreadyGranted = await PermissionsAndroid.check(fineLocation);
      const coarseAlreadyGranted = await PermissionsAndroid.check(
        coarseLocation,
      );

      if (fineAlreadyGranted) {
        console.log('FINE LOCATION ALREADY GRANTED');

        if (Platform.Version >= 33) {
          try {
            const notificationGranted = await PermissionsAndroid.check(
              PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            );

            if (!notificationGranted) {
              await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
              );
            }
          } catch (notificationError) {
            console.log('NOTIFICATION PERMISSION ERROR:', notificationError);
          }
        }

        return true;
      }

      if (coarseAlreadyGranted) {
        Alert.alert(
          'Precise Location Required',
          'Please enable Precise location for accurate vehicle tracking.',
        );

        return false;
      }

      const result = await requestWithActivityRetry(() =>
        PermissionsAndroid.requestMultiple([fineLocation, coarseLocation]),
      );

      console.log('LOCATION PERMISSION RESULT:', result);

      const fineGranted =
        result[fineLocation] === PermissionsAndroid.RESULTS.GRANTED;

      if (!fineGranted) {
        Alert.alert(
          'Location Permission Required',
          'Precise location permission is required for vehicle tracking.',
        );

        return false;
      }

      if (Platform.Version >= 33) {
        try {
          const notificationResult = await requestWithActivityRetry(() =>
            PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            ),
          );

          console.log('NOTIFICATION PERMISSION:', notificationResult);
        } catch (notificationError) {
          console.log('NOTIFICATION PERMISSION ERROR:', notificationError);
        }
      }

      return true;
    } catch (error) {
      console.log('LOCATION PERMISSION ERROR:', error);

      return false;
    }
  };

  // ==========================================================
  // SEND LOCATION - IOS ONLY
  // ==========================================================

  const sendLocationToServer = async ({
    latitude,
    longitude,
    accuracy,
    speed,
  }) => {
    if (!driverId) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/driver/location`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: driverId,
          latitude: latitude,
          longitude: longitude,
          accuracy: accuracy,
          speed: speed || 0,
        }),
      });

      const data = await response.json();

      console.log('LOCATION API:', data);

      if (!response.ok) {
        console.log('LOCATION UPDATE FAILED:', data.message || 'Unknown error');
      } else {
        console.log('LIVE LOCATION SENT SUCCESSFULLY');
      }
    } catch (error) {
      console.log('LOCATION API ERROR:', error);
    }
  };

  // ==========================================================
  // UI DATA
  // ==========================================================

  const doneCount = picked + missed;
  const total = Math.max(totalKids, doneCount);
  const pending = Math.max(total - doneCount, 0);
  const percent = total ? Math.round((doneCount / total) * 100) : 0;

  const hour = new Date().getHours();

  const greeting =
    hour < 12
      ? 'Good Morning,'
      : hour < 17
      ? 'Good Afternoon,'
      : 'Good Evening,';

  const navH = d(70) + insets.bottom;

  const shadow = {
    elevation: 3,
    shadowColor: '#9A6A00',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 3},
  };

  // ==========================================================
  // STATUS CARDS
  // ==========================================================

  const status = [
    {l: 'Picked', v: picked, icon: 'check', bg: C.green},
    {l: 'Pending', v: pending, icon: 'clock-outline', bg: C.amber},
    {l: 'Missed', v: missed, icon: 'close', bg: C.red},
  ];

  // ==========================================================
  // QUICK ACTIONS
  // ==========================================================

  const quick = [
    {
      t: 'Route\nMap',
      go: ROUTE_MAP_SCREEN,
      icon: 'map-marker-path',
      bg: '#FFE7A3',
      c: '#8A5A00',
    },
    {
      t: 'Daily\nTrip',
      go: DAILY_TRIP_SCREEN,
      icon: 'bus-clock',
      bg: '#FFEFB8',
      c: '#A66A00',
    },
  ];

  // ==========================================================
  // BOTTOM TABS
  // ==========================================================

  const tabs = [
    {k: 'Home', icon: 'home', go: null},
    {k: 'Route', icon: 'map-marker-path', go: ROUTE_MAP_SCREEN},
    {k: 'Trip', icon: 'bus-clock', go: DAILY_TRIP_SCREEN},
    {k: 'Profile', icon: 'account', go: PROFILE_SCREEN},
  ];

  const onTab = item => {
    setTab(item.k);

    if (item.go) {
      navigation.navigate(item.go);
    }
  };

  // when we come back to Home, highlight Home tab again
  useFocusEffect(
    useCallback(() => {
      setTab('Home');
    }, []),
  );

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <View style={{flex: 1, backgroundColor: C.sandal}}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />

      {/* solid yellow behind the status bar: no black can show here */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top + d(40),
          backgroundColor: C.yellow,
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        style={{backgroundColor: 'transparent'}}
        contentContainerStyle={{paddingBottom: navH + d(16)}}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            progressViewOffset={insets.top}
            onRefresh={() => {
              setRefreshing(true);
              loadTripNumbers();
            }}
          />
        }>
        {/* ==================================================
            HEADER
        ================================================== */}

        <View
          style={{
            backgroundColor: C.yellow,
            borderBottomLeftRadius: d(28),
            borderBottomRightRadius: d(28),
            overflow: 'hidden',
          }}>
          <LinearGradient
            colors={[C.yellowSoft, C.yellow, C.amber]}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={StyleSheet.absoluteFill}
          />

          <View
            style={{
              paddingTop: insets.top + d(16),
              paddingBottom: d(26),
              paddingHorizontal: d(18),
              flexDirection: 'row',
              alignItems: 'center',
            }}>
            <View style={{flex: 1}}>
              <Txt style={{fontSize: d(14), color: C.brownSoft}}>
                {greeting}
              </Txt>

              <Txt
                numberOfLines={1}
                style={{
                  fontSize: d(26),
                  fontWeight: '900',
                  color: C.brown,
                  marginTop: d(2),
                }}>
                {driverName}
              </Txt>

              <View style={styles.rolePill}>
                <Icon name="bus-school" size={d(15)} color={C.brown} />
                <Txt
                  style={{
                    fontSize: d(12),
                    fontWeight: '800',
                    color: C.brown,
                    marginLeft: d(5),
                  }}>
                  School Van Driver
                </Txt>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => navigation.navigate(PROFILE_SCREEN)}
              style={[
                styles.avatarRing,
                {
                  width: d(64),
                  height: d(64),
                  borderRadius: d(32),
                  borderWidth: d(3),
                },
              ]}>
              <Image
                source={require('../assets/driver.png')}
                style={{width: '100%', height: '100%', borderRadius: d(30)}}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* ==================================================
            BODY
        ================================================== */}

        <View style={{paddingHorizontal: d(14), marginTop: d(14)}}>
          {/* =================================================
              ON DUTY
          ================================================= */}

          <View
            style={[
              shadow,
              {
                backgroundColor: '#fff',
                height: d(82),
                borderRadius: d(18),
                paddingHorizontal: d(14),
                flexDirection: 'row',
                alignItems: 'center',
              },
            ]}>
            <View
              style={{
                width: d(54),
                height: d(54),
                borderRadius: d(27),
                backgroundColor: onDuty ? '#16903A' : '#8B95A3',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name="bus-school" size={d(30)} color="#fff" />
            </View>

            <View style={{flex: 1, marginLeft: d(12)}}>
              <Txt style={{fontSize: d(13), color: C.brownSoft}}>You are</Txt>

              <Txt
                style={{
                  fontSize: d(23),
                  fontWeight: '800',
                  color: onDuty ? '#15803D' : C.red,
                }}>
                {onDuty ? 'On Duty' : 'Off Duty'}
              </Txt>

              <Txt style={{fontSize: d(11.5), color: C.muted}} numberOfLines={1}>
                {onDuty
                  ? 'Tap to go Off Duty when you finish'
                  : 'Tap to go On Duty to start'}
              </Txt>
            </View>

            {/* DUTY BUTTON */}

            <TouchableOpacity
              activeOpacity={0.9}
              disabled={loadingDuty}
              onPress={toggleDuty}
              style={{
                width: d(104),
                height: d(44),
                borderRadius: d(22),
                backgroundColor: onDuty ? '#0E9440' : '#9AA5B1',
                justifyContent: 'center',
                opacity: loadingDuty ? 0.6 : 1,
              }}>
              <Txt
                style={{
                  position: 'absolute',
                  [onDuty ? 'left' : 'right']: d(12),
                  color: '#fff',
                  fontSize: d(13),
                  fontWeight: '700',
                }}>
                {loadingDuty ? '...' : onDuty ? 'On Duty' : 'Off Duty'}
              </Txt>

              <View
                style={{
                  position: 'absolute',
                  [onDuty ? 'right' : 'left']: d(4),
                  width: d(36),
                  height: d(36),
                  borderRadius: d(18),
                  backgroundColor: '#fff',
                }}
              />
            </TouchableOpacity>
          </View>

          {/* =================================================
              START ROUTE CARD
          ================================================= */}

          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => navigation.navigate(ROUTE_MAP_SCREEN)}
            style={{marginTop: d(12), borderRadius: d(18), overflow: 'hidden'}}>
            <LinearGradient
              colors={['#3A2A00', '#6B4A00', '#B77A00']}
              start={{x: 0, y: 1}}
              end={{x: 1, y: 0}}
              style={{
                minHeight: d(104),
                padding: d(16),
                flexDirection: 'row',
                alignItems: 'center',
              }}>
              <View
                style={{
                  width: d(52),
                  height: d(52),
                  borderRadius: d(26),
                  backgroundColor: C.yellow,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon name="map-marker-path" size={d(28)} color={C.brown} />
              </View>

              <View style={{flex: 1, marginLeft: d(14)}}>
                <Txt style={{fontSize: d(12.5), color: '#FFE9A8'}}>
                  Today's pick-up route
                </Txt>
                <Txt
                  style={{
                    fontSize: d(20),
                    fontWeight: '900',
                    color: '#fff',
                    marginTop: d(2),
                  }}>
                  {total} {total === 1 ? 'Child' : 'Children'}
                </Txt>
                <Txt style={{fontSize: d(12), color: '#FFE9A8', marginTop: d(2)}}>
                  Nearest child first
                </Txt>
              </View>

              <View style={styles.openBtn}>
                <Txt style={{fontSize: d(13), fontWeight: '800', color: C.brown}}>
                  Open Map
                </Txt>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* =================================================
              PROGRESS
          ================================================= */}

          <View
            style={[
              shadow,
              {
                marginTop: d(12),
                backgroundColor: '#fff',
                borderRadius: d(18),
                padding: d(14),
              },
            ]}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
              <Txt style={{fontSize: d(16), fontWeight: '800', color: C.brown}}>
                Today's Progress
              </Txt>

              <Txt style={{fontSize: d(18), fontWeight: '800', color: C.gold}}>
                {percent}%
              </Txt>
            </View>

            <View
              style={{
                height: d(10),
                backgroundColor: C.chip,
                borderRadius: d(5),
                marginTop: d(10),
                overflow: 'hidden',
              }}>
              <View
                style={{
                  width: `${percent}%`,
                  height: '100%',
                  backgroundColor: C.yellow,
                  borderRadius: d(5),
                }}
              />
            </View>

            <Txt style={{fontSize: d(11.5), color: C.muted, marginTop: d(8)}}>
              {doneCount} of {total} children done
            </Txt>
          </View>

          {/* =================================================
              STATUS CARDS
          ================================================= */}

          <View style={{flexDirection: 'row', marginTop: d(12)}}>
            {status.map((it, i) => (
              <View
                key={it.l}
                style={{
                  flex: 1,
                  minHeight: d(86),
                  borderRadius: d(14),
                  backgroundColor: '#fff',
                  padding: d(10),
                  marginLeft: i === 0 ? 0 : d(8),
                  flexDirection: 'row',
                  alignItems: 'center',
                  ...shadow,
                }}>
                <View
                  style={{
                    width: d(34),
                    height: d(34),
                    borderRadius: d(17),
                    backgroundColor: it.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Icon name={it.icon} size={d(20)} color="#fff" />
                </View>

                <View style={{flex: 1, marginLeft: d(7)}}>
                  <Txt
                    style={{fontSize: d(11), color: C.muted, fontWeight: '600'}}
                    numberOfLines={1}>
                    {it.l}
                  </Txt>

                  <Txt
                    style={{
                      fontSize: d(22),
                      color: C.brown,
                      fontWeight: '800',
                      marginTop: d(2),
                    }}>
                    {it.v}
                  </Txt>
                </View>
              </View>
            ))}
          </View>

          {/* =================================================
              QUICK ACTIONS
          ================================================= */}

          <View style={{marginTop: d(16)}}>
            <Txt
              style={{
                fontSize: d(17),
                fontWeight: '800',
                color: C.brown,
                marginBottom: d(10),
              }}>
              Quick Actions
            </Txt>

            <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
              {quick.map(item => (
                <TouchableOpacity
                  key={item.t}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate(item.go)}
                  style={{
                    width: '48.5%',
                    minHeight: d(84),
                    borderRadius: d(15),
                    backgroundColor: '#fff',
                    padding: d(12),
                    flexDirection: 'row',
                    alignItems: 'center',
                    ...shadow,
                  }}>
                  <View
                    style={{
                      width: d(42),
                      height: d(42),
                      borderRadius: d(12),
                      backgroundColor: item.bg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Icon name={item.icon} size={d(22)} color={item.c} />
                  </View>

                  <Txt
                    style={{
                      flex: 1,
                      fontSize: d(13),
                      fontWeight: '700',
                      color: C.brown,
                      marginLeft: d(10),
                    }}>
                    {item.t}
                  </Txt>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* =====================================================
          BOTTOM NAVIGATION
      ===================================================== */}

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: navH,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#F3E3B5',
          flexDirection: 'row',
          paddingBottom: insets.bottom,
          elevation: 18,
        }}>
        {tabs.map(item => {
          const active = tab === item.k;

          return (
            <TouchableOpacity
              key={item.k}
              activeOpacity={0.8}
              onPress={() => onTab(item)}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingTop: d(5),
              }}>
              <View
                style={{
                  width: d(40),
                  height: d(40),
                  borderRadius: d(12),
                  backgroundColor: active ? C.yellow : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon
                  name={item.icon}
                  size={d(23)}
                  color={active ? C.brown : C.muted}
                />
              </View>

              <Txt
                style={{
                  marginTop: d(1),
                  fontSize: d(10.5),
                  fontWeight: active ? '800' : '600',
                  color: active ? C.brown : C.muted,
                }}>
                {item.k}
              </Txt>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  avatarRing: {
    borderColor: '#fff',
    backgroundColor: '#fff',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 3},
  },

  rolePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  openBtn: {
    backgroundColor: '#FFC400',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
});