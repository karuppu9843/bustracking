// screens/HomeScreen.js

import React, {useEffect, useRef, useState} from 'react';
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
} from 'react-native';

import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from 'react-native-geolocation-service';

// ============================================================
// API
// ============================================================

const API_BASE_URL = 'https://blackpathsoftwaresolutions.com/api';

// ============================================================
// NATIVE ANDROID LOCATION SERVICE
// ============================================================

const {LocationForegroundService} = NativeModules;

// ============================================================
// SCREEN NAMES
// ============================================================

const SHOP_SCREEN = 'Shop';

const TAB_ROUTES = {
  Home: null,
  Shops: SHOP_SCREEN,
  Map: null,
  Collection: null,
  Profile: 'Profile',
};

// ============================================================
// DATA
// ============================================================

const DATA = {
  driverName: 'Ramesh',
  notifications: 3,

  route: {
    name: 'Route 1',
    shops: 14,
    area: 'Anna Nagar Area',
  },

  milk: 120,
  curd: 60,
  totalShops: 14,
  delivered: 8,
  pending: 6,
  notVisited: 0,

  nextShop: {
    name: 'Sri Murugan Stores',
    address: 'Anna Nagar, Coimbatore',
    distance: '1.2 km',
    milk: 10,
    curd: 5,
  },
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
    // wait until app is in foreground
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

  const p = n => n * (width / 941);
  const k = Math.min(width / 411, 1.3);
  const d = n => n * k;

  // ==========================================================
  // STATE
  // ==========================================================

  const [onDuty, setOnDuty] = useState(false);
  const [loadingDuty, setLoadingDuty] = useState(false);
  const [driverId, setDriverId] = useState(null);
  const [tab, setTab] = useState('Home');

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
  }, []);

  // ==========================================================
  // GET DRIVER ID
  // ==========================================================

  const loadDriver = async () => {
    try {
      const storedUserId = await AsyncStorage.getItem('userId');

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

      // UPDATE DUTY ON SERVER
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

      // START LOCATION
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
        // STOP LOCATION
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
      // 1. REQUEST LOCATION PERMISSION FIRST
      const hasPermission = await requestLocationPermission();

      if (!hasPermission) {
        Alert.alert(
          'Location Permission Required',
          'Please allow Precise Location permission to start vehicle tracking.',
        );
        return false;
      }

      console.log('LOCATION PERMISSION GRANTED');

      // 2. ANDROID NATIVE FOREGROUND SERVICE
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

      // 3. IOS LOCATION WATCHER
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
      // ANDROID
      if (Platform.OS === 'android') {
        if (LocationForegroundService && LocationForegroundService.stopService) {
          await LocationForegroundService.stopService();

          console.log('ANDROID FOREGROUND LOCATION SERVICE STOPPED');
        }

        return;
      }

      // IOS
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
      // IOS
      if (Platform.OS !== 'android') {
        return true;
      }

      // ANDROID
      const fineLocation = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
      const coarseLocation =
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;

      const fineAlreadyGranted = await PermissionsAndroid.check(fineLocation);
      const coarseAlreadyGranted = await PermissionsAndroid.check(
        coarseLocation,
      );

      // FINE ALREADY GRANTED
      if (fineAlreadyGranted) {
        console.log('FINE LOCATION ALREADY GRANTED');

        // Android 13+ notification permission
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

      // ONLY COARSE GRANTED
      if (coarseAlreadyGranted) {
        Alert.alert(
          'Precise Location Required',
          'Please enable Precise location for accurate vehicle tracking.',
        );

        return false;
      }

      // REQUEST FINE + COARSE
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

      // NOTIFICATION PERMISSION
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

  const total = DATA.delivered + DATA.pending + DATA.notVisited;

  const percent = total ? Math.round((DATA.delivered / total) * 100) : 0;

  const hour = new Date().getHours();

  const greeting =
    hour < 12
      ? 'Good Morning,'
      : hour < 17
      ? 'Good Afternoon,'
      : 'Good Evening,';

  const topOff = Math.max(insets.top - p(60), 0);

  const navH = d(70) + insets.bottom;

  const shadow = {
    elevation: 3,
    shadowColor: '#1B3A6B',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 3},
  };

  // ==========================================================
  // QUICK ACTIONS
  // ==========================================================

  const quick = [
    {
      t: "Today's\nShop List",
      go: SHOP_SCREEN,
      icon: 'clipboard-list',
      bg: '#DCEBFA',
      c: '#1265D6',
    },
    {
      t: 'Route\nMap',
      icon: 'map',
      bg: '#EBDDF7',
      c: '#6B2FBF',
    },
    {
      t: 'Collection\nEntry',
      icon: 'currency-inr',
      bg: '#FDEBC8',
      c: '#D9770A',
      circle: true,
    },
    {
      t: 'Return\nEntry',
      icon: 'package-variant',
      bg: '#FBDDE3',
      c: '#D9203F',
    },
  ];

  // ==========================================================
  // BOTTOM TABS
  // ==========================================================

  const tabs = [
    {k: 'Home', icon: 'home'},
    {k: 'Shops', icon: 'storefront'},
    {k: 'Map', icon: 'map-marker'},
    {k: 'Collection', icon: 'currency-inr', circle: true},
    {k: 'Profile', icon: 'account'},
  ];

  const onTab = key => {
    setTab(key);

    const r = TAB_ROUTES[key];

    if (r) {
      navigation.navigate(r);
    }
  };

  // ==========================================================
  // STATS
  // ==========================================================

  const stats = [
    {
      l: "Today's Milk",
      v: `${DATA.milk} Ltr`,
      icon: 'bottle-tonic-outline',
      bg: '#EEF6FF',
      bd: '#CDE2F8',
      cc: '#DCEBFB',
      ic: '#1B78F0',
    },
    {
      l: "Today's Curd",
      v: `${DATA.curd} Cup`,
      icon: 'bowl-mix-outline',
      bg: '#EEF8EF',
      bd: '#CBE7CF',
      cc: '#D9F0DC',
      ic: '#1B9A3A',
    },
    {
      l: 'Total Shops',
      v: `${DATA.totalShops}`,
      icon: 'storefront-outline',
      bg: '#FFF7EA',
      bd: '#F6E2C0',
      cc: '#FDE6C4',
      ic: '#F07A10',
    },
  ];

  // ==========================================================
  // STATUS
  // ==========================================================

  const status = [
    {l: 'Delivered', v: DATA.delivered, icon: 'check', bg: '#16A34A'},
    {l: 'Pending', v: DATA.pending, icon: 'clock-outline', bg: '#F59E0B'},
    {l: 'Not Visited', v: DATA.notVisited, icon: 'close', bg: '#EF4444'},
  ];

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <View style={{flex: 1, backgroundColor: '#F4F8FD'}}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: navH + d(16)}}>
        {/* ==================================================
            HEADER
        ================================================== */}

        <View style={{width, height: p(358) + topOff}}>
          <Image
            source={require('../assets/home_header.png')}
            style={{width, height: p(358) + topOff}}
            resizeMode="cover"
          />

          {/* NOTIFICATION */}

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {}}
            style={[
              styles.whiteBtn,
              {
                left: p(706),
                top: p(85) + topOff,
                width: p(80),
                height: p(80),
                borderRadius: p(40),
              },
            ]}>
            <Icon name="bell" size={p(44)} color="#0B2A6B" />
          </TouchableOpacity>

          {DATA.notifications > 0 && (
            <View
              style={[
                styles.badge,
                {
                  left: p(752),
                  top: p(85) + topOff,
                  width: p(34),
                  height: p(34),
                  borderRadius: p(17),
                },
              ]}>
              <Txt style={{color: '#fff', fontSize: p(20), fontWeight: '700'}}>
                {DATA.notifications}
              </Txt>
            </View>
          )}

          {/* PROFILE */}

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('Profile')}
            style={[
              styles.avatarRing,
              {
                left: p(803),
                top: p(83) + topOff,
                width: p(106),
                height: p(106),
                borderRadius: p(53),
                borderWidth: p(5),
              },
            ]}>
            <Image
              source={require('../assets/driver.png')}
              style={{width: '100%', height: '100%', borderRadius: p(50)}}
            />
          </TouchableOpacity>

          <View
            style={{
              position: 'absolute',
              left: p(878),
              top: p(160) + topOff,
              width: p(28),
              height: p(28),
              borderRadius: p(14),
              backgroundColor: '#16A34A',
              borderWidth: p(3),
              borderColor: '#fff',
            }}
          />

          <View
            style={{
              position: 'absolute',
              right: p(48),
              top: p(218) + topOff,
              alignItems: 'flex-end',
            }}>
            <Txt style={{fontSize: p(26), color: '#374151'}}>{greeting}</Txt>

            <Txt
              style={{
                fontSize: p(38),
                fontWeight: '800',
                color: '#0F172A',
                marginTop: p(-2),
              }}>
              {DATA.driverName}
            </Txt>

            <Txt style={{fontSize: p(24), color: '#4B5563'}}>Driver</Txt>
          </View>
        </View>

        {/* ==================================================
            BODY
        ================================================== */}

        <View style={{paddingHorizontal: d(14)}}>
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
              <Icon name="truck" size={d(30)} color="#fff" />
            </View>

            <View style={{flex: 1, marginLeft: d(12)}}>
              <Txt style={{fontSize: d(13), color: '#1F2937'}}>You are</Txt>

              <Txt
                style={{
                  fontSize: d(23),
                  fontWeight: '800',
                  color: onDuty ? '#15803D' : '#DC2626',
                }}>
                {onDuty ? 'On Duty' : 'Off Duty'}
              </Txt>

              <Txt
                style={{fontSize: d(11.5), color: '#4B5563'}}
                numberOfLines={1}>
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
              ROUTE
          ================================================= */}

          <LinearGradient
            colors={['#023684', '#0450B5', '#0B72E0']}
            start={{x: 0, y: 1}}
            end={{x: 1, y: 0}}
            style={{
              marginTop: d(12),
              height: d(118),
              borderRadius: d(18),
              overflow: 'hidden',
            }}>
            <Image
              source={require('../assets/route_truck.png')}
              style={{
                position: 'absolute',
                right: 0,
                bottom: 0,
                width: d(170),
                height: d(118),
              }}
              resizeMode="stretch"
            />

            <View style={{flexDirection: 'row', padding: d(14)}}>
              <View
                style={{
                  width: d(46),
                  height: d(46),
                  borderRadius: d(23),
                  backgroundColor: '#1B6EF3',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon name="map-marker" size={d(26)} color="#fff" />
              </View>

              <View style={{marginLeft: d(12)}}>
                <Txt style={{fontSize: d(13), color: '#E6EEFF'}}>
                  Your Assigned Route
                </Txt>

                <Txt
                  style={{
                    fontSize: d(32),
                    fontWeight: '800',
                    color: '#fff',
                    marginTop: d(-2),
                  }}>
                  {DATA.route.name}
                </Txt>
              </View>
            </View>

            <View
              style={{
                position: 'absolute',
                left: d(14),
                bottom: d(12),
                flexDirection: 'row',
                alignItems: 'center',
              }}>
              <Icon name="storefront-outline" size={d(22)} color="#fff" />

              <Txt
                style={{
                  fontSize: d(14.5),
                  fontWeight: '700',
                  color: '#fff',
                  marginLeft: d(6),
                }}>
                {DATA.route.shops} Shops
              </Txt>

              <Txt
                style={{
                  fontSize: d(16),
                  color: '#BFD3FF',
                  marginHorizontal: d(8),
                }}>
                |
              </Txt>

              <Txt style={{fontSize: d(13.5), color: '#fff'}}>
                {DATA.route.area}
              </Txt>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {}}
              style={{
                position: 'absolute',
                left: d(200),
                top: d(14),
                height: d(34),
                paddingHorizontal: d(12),
                borderRadius: d(9),
                backgroundColor: '#fff',
                flexDirection: 'row',
                alignItems: 'center',
              }}>
              <Icon name="map-outline" size={d(19)} color="#1650C8" />

              <Txt
                style={{
                  fontSize: d(13.5),
                  fontWeight: '700',
                  color: '#1650C8',
                  marginLeft: d(6),
                }}>
                View Map
              </Txt>
            </TouchableOpacity>
          </LinearGradient>

          {/* =================================================
              STATS
          ================================================= */}

          <View style={{flexDirection: 'row', marginTop: d(12)}}>
            {stats.map((it, i) => (
              <View
                key={it.l}
                style={{
                  flex: 1,
                  height: d(74),
                  borderRadius: d(14),
                  backgroundColor: it.bg,
                  borderWidth: 1,
                  borderColor: it.bd,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: d(8),
                  marginLeft: i === 0 ? 0 : d(8),
                }}>
                <View
                  style={{
                    width: d(36),
                    height: d(36),
                    borderRadius: d(18),
                    backgroundColor: it.cc,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Icon name={it.icon} size={d(21)} color={it.ic} />
                </View>

                <View style={{flex: 1, marginLeft: d(7)}}>
                  <Txt
                    style={{
                      fontSize: d(11.5),
                      fontWeight: '700',
                      color: '#1F2937',
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit>
                    {it.l}
                  </Txt>

                  <Txt
                    style={{
                      fontSize: d(19),
                      fontWeight: '800',
                      color: '#0F172A',
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit>
                    {it.v}
                  </Txt>
                </View>
              </View>
            ))}
          </View>

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
                flexDirection: 'row',
                alignItems: 'center',
              },
            ]}>
            <View style={{flex: 1}}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                <Txt
                  style={{
                    fontSize: d(16),
                    fontWeight: '800',
                    color: '#101828',
                  }}>
                  Today's Progress
                </Txt>

                <Txt
                  style={{
                    fontSize: d(18),
                    fontWeight: '800',
                    color: '#0E9440',
                  }}>
                  {percent}%
                </Txt>
              </View>

              <View
                style={{
                  height: d(10),
                  backgroundColor: '#E6EEF7',
                  borderRadius: d(5),
                  marginTop: d(10),
                  overflow: 'hidden',
                }}>
                <View
                  style={{
                    width: `${percent}%`,
                    height: '100%',
                    backgroundColor: '#16A34A',
                    borderRadius: d(5),
                  }}
                />
              </View>
            </View>
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
                    style={{
                      fontSize: d(11),
                      color: '#667085',
                      fontWeight: '600',
                    }}
                    numberOfLines={1}>
                    {it.l}
                  </Txt>

                  <Txt
                    style={{
                      fontSize: d(22),
                      color: '#101828',
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

          <View style={{marginTop: d(14)}}>
            <Txt
              style={{
                fontSize: d(17),
                fontWeight: '800',
                color: '#101828',
                marginBottom: d(10),
              }}>
              Quick Actions
            </Txt>

            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
              }}>
              {quick.map(item => (
                <TouchableOpacity
                  key={item.t}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (item.go) {
                      navigation.navigate(item.go);
                    }
                  }}
                  style={{
                    width: '48.5%',
                    minHeight: d(84),
                    borderRadius: d(15),
                    backgroundColor: '#fff',
                    marginBottom: d(10),
                    padding: d(12),
                    flexDirection: 'row',
                    alignItems: 'center',
                    ...shadow,
                  }}>
                  <View
                    style={{
                      width: d(42),
                      height: d(42),
                      borderRadius: item.circle ? d(21) : d(12),
                      backgroundColor: item.bg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Icon name={item.icon} size={d(22)} color={item.c} />
                  </View>

                  <Txt
                    style={{
                      flex: 1,
                      fontSize: d(12.5),
                      fontWeight: '700',
                      color: '#1F2937',
                      marginLeft: d(10),
                    }}>
                    {item.t}
                  </Txt>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* =================================================
              NEXT SHOP
          ================================================= */}

          <View
            style={[
              shadow,
              {
                marginTop: d(2),
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
              <Txt
                style={{
                  fontSize: d(17),
                  fontWeight: '800',
                  color: '#101828',
                }}>
                Next Shop
              </Txt>

              <View
                style={{
                  backgroundColor: '#E8F7EE',
                  paddingHorizontal: d(10),
                  paddingVertical: d(5),
                  borderRadius: d(10),
                }}>
                <Txt
                  style={{
                    color: '#15803D',
                    fontSize: d(11),
                    fontWeight: '700',
                  }}>
                  {DATA.nextShop.distance}
                </Txt>
              </View>
            </View>

            <View
              style={{
                flexDirection: 'row',
                marginTop: d(14),
                alignItems: 'center',
              }}>
              <View
                style={{
                  width: d(48),
                  height: d(48),
                  borderRadius: d(24),
                  backgroundColor: '#EAF2FF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon name="storefront" size={d(25)} color="#1664D9" />
              </View>

              <View style={{flex: 1, marginLeft: d(12)}}>
                <Txt
                  style={{
                    fontSize: d(15),
                    fontWeight: '800',
                    color: '#101828',
                  }}
                  numberOfLines={1}>
                  {DATA.nextShop.name}
                </Txt>

                <Txt
                  style={{
                    fontSize: d(11.5),
                    color: '#667085',
                    marginTop: d(3),
                  }}
                  numberOfLines={1}>
                  {DATA.nextShop.address}
                </Txt>
              </View>
            </View>

            <View style={{flexDirection: 'row', marginTop: d(12)}}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: '#EEF6FF',
                  borderRadius: d(10),
                  padding: d(9),
                }}>
                <Txt style={{fontSize: d(10), color: '#667085'}}>Milk</Txt>

                <Txt
                  style={{
                    fontSize: d(16),
                    fontWeight: '800',
                    color: '#1265D6',
                    marginTop: d(2),
                  }}>
                  {DATA.nextShop.milk} Ltr
                </Txt>
              </View>

              <View
                style={{
                  flex: 1,
                  backgroundColor: '#EEF8EF',
                  borderRadius: d(10),
                  padding: d(9),
                  marginLeft: d(8),
                }}>
                <Txt style={{fontSize: d(10), color: '#667085'}}>Curd</Txt>

                <Txt
                  style={{
                    fontSize: d(16),
                    fontWeight: '800',
                    color: '#159447',
                    marginTop: d(2),
                  }}>
                  {DATA.nextShop.curd} Cup
                </Txt>
              </View>
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
          borderTopColor: '#E8EEF5',
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
              onPress={() => onTab(item.k)}
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
                  borderRadius: item.circle ? d(20) : d(12),
                  backgroundColor: active ? '#E9F2FF' : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon
                  name={item.icon}
                  size={d(23)}
                  color={active ? '#1265D6' : '#667085'}
                />
              </View>

              <Txt
                style={{
                  marginTop: d(1),
                  fontSize: d(10.5),
                  fontWeight: active ? '800' : '600',
                  color: active ? '#1265D6' : '#667085',
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
  whiteBtn: {
    position: 'absolute',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 3},
  },

  badge: {
    position: 'absolute',
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },

  avatarRing: {
    position: 'absolute',
    borderColor: '#fff',
    backgroundColor: '#fff',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 3},
  },
});