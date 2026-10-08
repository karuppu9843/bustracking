import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  PermissionsAndroid,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import MaterialIcons from '@react-native-vector-icons/material-icons';

const API_URL = 'https://blackpathsoftwaresolutions.com';

const COLORS = {
  yellow: '#FFC400',
  yellowDark: '#F2AA00',
  yellowLight: '#FFD84D',

  sandal: '#FFF4D9',
  sandalLight: '#FFF9EC',
  sandalDark: '#EBD5A3',

  brown: '#5A3B00',
  brownDark: '#3E2900',
  brownLight: '#866A35',

  white: '#FFFFFF',
  green: '#18A957',
  greenLight: '#DDF7E7',

  red: '#D64545',
  redLight: '#FCE4E4',

  border: '#E9D9B5',
};

const ParentHome = ({navigation}) => {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [driverStatus, setDriverStatus] = useState({});
  const [loadingStatus, setLoadingStatus] = useState({});

  // pickup location
  const [pickupSaved, setPickupSaved] = useState(false);
  const [savingPickup, setSavingPickup] = useState(false);
  const askedRef = useRef(false);

  // --------------------------------------------------
  // SAVE PICKUP LOCATION (parent's current GPS)
  // --------------------------------------------------
  const savePickupLocation = useCallback(async () => {
    try {
      const parentId = await AsyncStorage.getItem('parent_id');

      if (!parentId) {
        Alert.alert('Login Required', 'Parent ID not found. Please login again.');
        return;
      }

      // permission
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );

        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(
            'Permission Required',
            'Please allow location so the van can find your pickup point.',
          );
          return;
        }
      } else {
        Geolocation.requestAuthorization?.();
      }

      setSavingPickup(true);

      Geolocation.getCurrentPosition(
        async position => {
          try {
            const {latitude, longitude} = position.coords;

            console.log('Saving pickup location:', latitude, longitude);

            const response = await fetch(
              `${API_URL}/api/parent/${parentId}/location`,
              {
                method: 'POST',
                headers: {
                  Accept: 'application/json',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({latitude, longitude}),
              },
            );

            const data = await response.json();

            console.log('Save pickup response:', data);

            if (response.ok && data?.status === 'success') {
              await AsyncStorage.setItem('pickup_saved', '1');
              setPickupSaved(true);
              Alert.alert('Saved', 'Your pickup location has been saved.');
            } else {
              Alert.alert(
                'Error',
                data?.message || 'Unable to save pickup location.',
              );
            }
          } catch (error) {
            console.log('Save pickup error:', error);
            Alert.alert('Error', 'Unable to save pickup location.');
          } finally {
            setSavingPickup(false);
          }
        },
        error => {
          console.log('Pickup GPS error:', error);
          setSavingPickup(false);
          Alert.alert(
            'Location Error',
            'Unable to get your current location. Please turn on GPS and try again.',
          );
        },
        {enableHighAccuracy: true, timeout: 20000, maximumAge: 10000},
      );
    } catch (error) {
      console.log('Pickup location error:', error);
      setSavingPickup(false);
    }
  }, []);

  // --------------------------------------------------
  // ASK ONCE ON FIRST LOGIN
  // --------------------------------------------------
  useEffect(() => {
    const checkPickup = async () => {
      try {
        const saved = await AsyncStorage.getItem('pickup_saved');

        if (saved === '1') {
          setPickupSaved(true);
          return;
        }

        if (askedRef.current) {
          return;
        }

        askedRef.current = true;

        Alert.alert(
          'Set Pickup Location',
          "Are you at your child's pickup point right now? The van will use this location to pick up your child.",
          [
            {text: 'Later', style: 'cancel'},
            {text: 'Yes, save here', onPress: savePickupLocation},
          ],
        );
      } catch (error) {
        console.log('Pickup check error:', error);
      }
    };

    checkPickup();
  }, [savePickupLocation]);

  // --------------------------------------------------
  // CONFIRM BEFORE UPDATING (button)
  // --------------------------------------------------
  const confirmUpdatePickup = () => {
    Alert.alert(
      'Update Pickup Location',
      'Save your current location as the pickup point? Make sure you are at the exact pickup place.',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Save here', onPress: savePickupLocation},
      ],
    );
  };

  // --------------------------------------------------
  // DRIVER LIVE STATUS
  // --------------------------------------------------
  const checkDriverStatus = useCallback(async driverId => {
    if (!driverId) {
      return;
    }

    try {
      setLoadingStatus(prev => ({...prev, [driverId]: true}));

      const response = await fetch(
        `${API_URL}/api/admin/drivers/${driverId}/location`,
        {
          method: 'GET',
          headers: {Accept: 'application/json'},
        },
      );

      const data = await response.json();

      console.log(`Driver ${driverId} location:`, data);

      if (
        response.ok &&
        data?.status === 'success' &&
        data?.location?.latitude != null &&
        data?.location?.longitude != null
      ) {
        setDriverStatus(prev => ({...prev, [driverId]: true}));
      } else {
        setDriverStatus(prev => ({...prev, [driverId]: false}));
      }
    } catch (error) {
      console.log(`Driver ${driverId} status error:`, error);
      setDriverStatus(prev => ({...prev, [driverId]: false}));
    } finally {
      setLoadingStatus(prev => ({...prev, [driverId]: false}));
    }
  }, []);

  // --------------------------------------------------
  // LOAD CHILDREN
  // --------------------------------------------------
  const loadChildren = useCallback(async () => {
    try {
      const parentId = await AsyncStorage.getItem('parent_id');

      console.log('Parent ID:', parentId);

      if (!parentId) {
        setLoading(false);

        Alert.alert(
          'Login Required',
          'Parent ID not found. Please login again.',
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.replace('Login');
              },
            },
          ],
        );

        return;
      }

      const url = `${API_URL}/api/parent/${parentId}/children`;

      console.log('Parent Children API:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      console.log('Parent Children Response:', data);

      if (!response.ok) {
        throw new Error(data?.message || 'Unable to load children');
      }

      if (data?.status === 'success') {
        const list = Array.isArray(data?.children) ? data.children : [];

        setChildren(list);

        // Check driver live status
        list.forEach(child => {
          const driverId = Number(child?.van?.driverId || 0);

          if (driverId > 0) {
            checkDriverStatus(driverId);
          }
        });
      } else {
        setChildren([]);
      }
    } catch (error) {
      console.log('Parent Home Error:', error);

      Alert.alert('Error', error?.message || 'Unable to load children.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigation, checkDriverStatus]);

  // --------------------------------------------------
  // FIRST LOAD
  // --------------------------------------------------
  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  // --------------------------------------------------
  // REFRESH WHEN SCREEN COMES INTO FOCUS
  // --------------------------------------------------
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadChildren();
    });

    return unsubscribe;
  }, [navigation, loadChildren]);

  // --------------------------------------------------
  // PULL REFRESH
  // --------------------------------------------------
  const onRefresh = () => {
    setRefreshing(true);
    loadChildren();
  };

  // --------------------------------------------------
  // CALL DRIVER
  // --------------------------------------------------
  const callDriver = phone => {
    if (!phone) {
      Alert.alert('Phone Number', 'Driver phone number not available.');
      return;
    }

    const phoneNumber =
      Platform.OS === 'android' ? `tel:${phone}` : `telprompt:${phone}`;

    Linking.openURL(phoneNumber).catch(() => {
      Alert.alert('Error', 'Unable to open phone app.');
    });
  };

  // --------------------------------------------------
  // LIVE MAP
  // --------------------------------------------------
  const openLiveMap = child => {
    if (!child?.van?.driverId) {
      Alert.alert('Live Map', 'Driver is not assigned to this van.');
      return;
    }

    navigation.navigate('ParentTracking', {
      child: child,
    });
  };

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.yellow} />

        <View style={styles.loadingBusCircle}>
          <MaterialIcons
            name="directions-bus"
            size={58}
            color={COLORS.brown}
          />
        </View>

        <ActivityIndicator
          size="large"
          color={COLORS.brown}
          style={{marginTop: 20}}
        />

        <Text style={styles.loadingText}>Loading your children...</Text>
      </SafeAreaView>
    );
  }

  // --------------------------------------------------
  // MAIN UI
  // --------------------------------------------------
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.yellow} />

      {/* ================= TOP HEADER ================= */}
      <View style={styles.header}>
        <View style={styles.headerCircleOne} />
        <View style={styles.headerCircleTwo} />

        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Parent Home</Text>

            <Text style={styles.headerSubtitle}>
              Track your child's school van
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.refreshButton}
            onPress={loadChildren}>
            <MaterialIcons name="refresh" size={30} color={COLORS.brown} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ================= BUS ICON ================= */}
      <View style={styles.busIconWrapper}>
        <View style={styles.busOuterCircle}>
          <View style={styles.busInnerCircle}>
            <MaterialIcons
              name="directions-bus"
              size={62}
              color={COLORS.brown}
            />
          </View>
        </View>
      </View>

      {/* ================= CONTENT ================= */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.brown}
            colors={[COLORS.yellowDark]}
          />
        }>
        {/* TITLE */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>My Children</Text>

            <Text style={styles.sectionSubtitle}>School van tracking</Text>
          </View>

          <View style={styles.childCountBadge}>
            <Text style={styles.childCountText}>{children.length}</Text>

            <Text style={styles.childCountLabel}>
              {children.length === 1 ? 'Child' : 'Children'}
            </Text>
          </View>
        </View>

        {/* ================= PICKUP LOCATION ================= */}
        <View style={styles.pickupCard}>
          <View style={styles.pickupLeft}>
            <View
              style={[
                styles.pickupIcon,
                {
                  backgroundColor: pickupSaved
                    ? COLORS.greenLight
                    : COLORS.redLight,
                },
              ]}>
              <MaterialIcons
                name={pickupSaved ? 'check-circle' : 'location-off'}
                size={26}
                color={pickupSaved ? COLORS.green : COLORS.red}
              />
            </View>

            <View style={{flex: 1, marginLeft: 12}}>
              <Text style={styles.pickupTitle}>Pickup Location</Text>

              <Text style={styles.pickupSub} numberOfLines={2}>
                {pickupSaved
                  ? 'Saved. The van will pick up from here.'
                  : 'Not set. Stand at the pickup point and save it.'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={savingPickup}
            onPress={confirmUpdatePickup}
            style={[styles.pickupButton, savingPickup && {opacity: 0.6}]}>
            {savingPickup ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.pickupButtonText}>
                {pickupSaved ? 'Update' : 'Set'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ================= EMPTY ================= */}
        {children.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <MaterialIcons
                name="directions-bus"
                size={48}
                color={COLORS.brown}
              />
            </View>

            <Text style={styles.emptyTitle}>No Children Found</Text>

            <Text style={styles.emptyText}>
              No child has been assigned to your parent account yet.
            </Text>

            <TouchableOpacity
              style={styles.emptyRefreshButton}
              onPress={loadChildren}>
              <MaterialIcons name="refresh" size={22} color={COLORS.white} />

              <Text style={styles.emptyRefreshText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          children.map((child, index) => {
            const van = child?.van || {};

            const driverId = Number(van?.driverId || 0);

            const apiLive = driverId > 0 ? driverStatus[driverId] : false;

            const isLive = apiLive === true || van?.onDuty === true;

            const checking = loadingStatus[driverId];

            return (
              <View
                key={child?.id ? String(child.id) : String(index)}
                style={styles.childCard}>
                {/* ================= CHILD TOP ================= */}
                <View style={styles.childTopRow}>
                  <View style={styles.childInfoRow}>
                    <View style={styles.childAvatar}>
                      <MaterialIcons
                        name="person"
                        size={40}
                        color={COLORS.brown}
                      />
                    </View>

                    <View style={styles.childNameArea}>
                      <Text style={styles.childName} numberOfLines={1}>
                        {child?.name || 'Child'}
                      </Text>

                      <Text style={styles.classText}>
                        {child?.className
                          ? `Class: ${child.className}`
                          : 'Class not available'}
                      </Text>
                    </View>
                  </View>

                  {/* LIVE */}
                  <View
                    style={[
                      styles.liveBadge,
                      isLive
                        ? styles.liveBadgeActive
                        : styles.liveBadgeOffline,
                    ]}>
                    <View
                      style={[
                        styles.liveDot,
                        isLive ? styles.liveDotActive : styles.liveDotOffline,
                      ]}
                    />

                    <Text
                      style={[
                        styles.liveText,
                        isLive ? styles.liveTextActive : styles.liveTextOffline,
                      ]}>
                      {checking ? 'Checking' : isLive ? 'Live' : 'Offline'}
                    </Text>
                  </View>
                </View>

                {/* ================= DETAILS ================= */}
                <View style={styles.detailsBox}>
                  {/* VAN */}
                  <View style={styles.detailRow}>
                    <View style={styles.detailLeft}>
                      <View style={styles.detailIcon}>
                        <MaterialIcons
                          name="directions-bus"
                          size={23}
                          color={COLORS.brown}
                        />
                      </View>

                      <Text style={styles.detailLabel}>Van Number</Text>
                    </View>

                    <Text style={styles.detailValue} numberOfLines={1}>
                      {van?.number || 'Not Assigned'}
                    </Text>
                  </View>

                  <View style={styles.divider} />

                  {/* ROUTE */}
                  <View style={styles.detailRow}>
                    <View style={styles.detailLeft}>
                      <View style={styles.detailIcon}>
                        <MaterialIcons
                          name="alt-route"
                          size={23}
                          color={COLORS.brown}
                        />
                      </View>

                      <Text style={styles.detailLabel}>Route</Text>
                    </View>

                    <Text style={styles.detailValueRoute} numberOfLines={2}>
                      {van?.route || 'Not Assigned'}
                    </Text>
                  </View>

                  <View style={styles.divider} />

                  {/* DRIVER */}
                  <View style={styles.detailRow}>
                    <View style={styles.detailLeft}>
                      <View style={styles.detailIcon}>
                        <MaterialIcons
                          name="person"
                          size={23}
                          color={COLORS.brown}
                        />
                      </View>

                      <Text style={styles.detailLabel}>Driver</Text>
                    </View>

                    <Text style={styles.detailValue} numberOfLines={1}>
                      {van?.driver || 'Not Assigned'}
                    </Text>
                  </View>

                  <View style={styles.divider} />

                  {/* DUTY */}
                  <View style={styles.detailRow}>
                    <View style={styles.detailLeft}>
                      <View style={styles.detailIcon}>
                        <MaterialIcons
                          name="radio-button-checked"
                          size={23}
                          color={isLive ? COLORS.green : COLORS.red}
                        />
                      </View>

                      <Text style={styles.detailLabel}>Duty</Text>
                    </View>

                    <Text
                      style={[
                        styles.dutyText,
                        isLive ? styles.dutyOn : styles.dutyOff,
                      ]}>
                      {isLive ? 'On Duty' : 'Off Duty'}
                    </Text>
                  </View>
                </View>

                {/* ================= BUTTONS ================= */}
                <View style={styles.buttonRow}>
                  {/* MAP */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[styles.mapButton, !driverId && styles.disabledButton]}
                    disabled={!driverId}
                    onPress={() => openLiveMap(child)}>
                    <MaterialIcons
                      name="location-on"
                      size={25}
                      color={COLORS.white}
                    />

                    <Text style={styles.mapButtonText}>View Live Map</Text>
                  </TouchableOpacity>

                  {/* CALL */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                      styles.callButton,
                      !van?.phone && styles.disabledCallButton,
                    ]}
                    disabled={!van?.phone}
                    onPress={() => callDriver(van?.phone)}>
                    <MaterialIcons
                      name="phone"
                      size={24}
                      color={COLORS.white}
                    />

                    <Text style={styles.callButtonText}>Call</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        {/* Bottom spacing */}
        <View style={{height: 100}} />
      </ScrollView>

      {/* ================= ROAD FOOTER ================= */}
      <View style={styles.roadFooter}>
        <View style={styles.roadLine}>
          {Array.from({length: 12}).map((_, index) => (
            <View key={index} style={styles.roadDash} />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default ParentHome;

// =====================================================
// STYLES
// =====================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.sandal,
  },

  // HEADER

  header: {
    height: 205,
    backgroundColor: COLORS.yellow,
    borderBottomLeftRadius: 70,
    borderBottomRightRadius: 70,
    overflow: 'hidden',
    position: 'relative',
  },

  headerCircleOne: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(255,255,255,0.13)',
    right: -70,
    top: 55,
  },

  headerCircleTwo: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.10)',
    left: -75,
    bottom: -95,
  },

  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 38,
  },

  headerTitle: {
    color: COLORS.brownDark,
    fontSize: 31,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  headerSubtitle: {
    color: COLORS.brown,
    fontSize: 16,
    marginTop: 6,
    fontWeight: '500',
  },

  refreshButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // BUS ICON

  busIconWrapper: {
    alignItems: 'center',
    marginTop: -46,
    zIndex: 10,
  },

  busOuterCircle: {
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: 'rgba(255,255,255,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8A6500',
    shadowOffset: {width: 0, height: 5},
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 7,
  },

  busInnerCircle: {
    width: 126,
    height: 126,
    borderRadius: 63,
    backgroundColor: COLORS.yellow,
    borderWidth: 6,
    borderColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // SCROLL

  scrollView: {
    flex: 1,
    marginTop: -2,
  },

  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 22,
  },

  // SECTION HEADER

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  sectionTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: COLORS.brownDark,
  },

  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.brownLight,
    marginTop: 2,
  },

  childCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  childCountText: {
    color: COLORS.brownDark,
    fontSize: 20,
    fontWeight: '800',
  },

  childCountLabel: {
    color: COLORS.brownLight,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },

  // PICKUP LOCATION CARD

  pickupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#F0E2C5',
    shadowColor: '#6B4A00',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },

  pickupLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },

  pickupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pickupTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.brownDark,
  },

  pickupSub: {
    fontSize: 12.5,
    color: COLORS.brownLight,
    marginTop: 2,
  },

  pickupButton: {
    minWidth: 76,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: COLORS.yellowDark,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pickupButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
  },

  // CHILD CARD

  childCard: {
    backgroundColor: COLORS.white,
    borderRadius: 28,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#F0E2C5',
    shadowColor: '#6B4A00',
    shadowOffset: {width: 0, height: 5},
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 5,
  },

  childTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  childInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },

  childAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF0C2',
    borderWidth: 2,
    borderColor: '#FFE08A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  childNameArea: {
    marginLeft: 13,
    flex: 1,
  },

  childName: {
    fontSize: 23,
    fontWeight: '800',
    color: COLORS.brownDark,
  },

  classText: {
    fontSize: 16,
    color: COLORS.brownLight,
    marginTop: 3,
    fontWeight: '500',
  },

  // LIVE BADGE

  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 22,
  },

  liveBadgeActive: {
    backgroundColor: COLORS.greenLight,
  },

  liveBadgeOffline: {
    backgroundColor: COLORS.redLight,
  },

  liveDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 7,
  },

  liveDotActive: {
    backgroundColor: COLORS.green,
  },

  liveDotOffline: {
    backgroundColor: COLORS.red,
  },

  liveText: {
    fontSize: 14,
    fontWeight: '800',
  },

  liveTextActive: {
    color: COLORS.green,
  },

  liveTextOffline: {
    color: COLORS.red,
  },

  // DETAILS

  detailsBox: {
    backgroundColor: COLORS.sandalLight,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#F3E5C8',
  },

  detailRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  detailIcon: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  detailLabel: {
    color: COLORS.brownLight,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 5,
  },

  detailValue: {
    maxWidth: '48%',
    color: COLORS.brownDark,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'right',
  },

  detailValueRoute: {
    maxWidth: '55%',
    color: COLORS.brownDark,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
  },

  divider: {
    height: 1,
    backgroundColor: '#E8D9B9',
  },

  dutyText: {
    fontSize: 16,
    fontWeight: '800',
  },

  dutyOn: {
    color: COLORS.green,
  },

  dutyOff: {
    color: COLORS.red,
  },

  // BUTTONS

  buttonRow: {
    flexDirection: 'row',
    marginTop: 15,
    gap: 10,
  },

  mapButton: {
    flex: 1,
    minHeight: 55,
    borderRadius: 17,
    backgroundColor: COLORS.yellowDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#9A6900',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },

  mapButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 7,
  },

  callButton: {
    width: 105,
    minHeight: 55,
    borderRadius: 17,
    backgroundColor: COLORS.green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  callButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 6,
  },

  disabledButton: {
    backgroundColor: '#C7B98F',
  },

  disabledCallButton: {
    backgroundColor: '#A8B9AD',
  },

  // EMPTY

  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 28,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#6B4A00',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },

  emptyIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FFF0C2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },

  emptyTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: COLORS.brownDark,
  },

  emptyText: {
    textAlign: 'center',
    color: COLORS.brownLight,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },

  emptyRefreshButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: COLORS.yellowDark,
    flexDirection: 'row',
    alignItems: 'center',
  },

  emptyRefreshText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 6,
  },

  // LOADING

  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.sandal,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingBusCircle: {
    width: 125,
    height: 125,
    borderRadius: 63,
    backgroundColor: COLORS.yellow,
    borderWidth: 7,
    borderColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#765100',
    shadowOffset: {width: 0, height: 5},
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },

  loadingText: {
    marginTop: 14,
    color: COLORS.brown,
    fontSize: 15,
    fontWeight: '600',
  },

  // ROAD FOOTER

  roadFooter: {
    height: 38,
    backgroundColor: COLORS.brown,
    borderTopWidth: 3,
    borderTopColor: COLORS.sandalDark,
    justifyContent: 'center',
  },

  roadLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },

  roadDash: {
    width: 34,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFF1B9',
  },
});