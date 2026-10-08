// screens/ParentTracking.js
// Opens when parent taps "View Map" on ParentHome.
// Shows: parent location + van location (live, smooth) + yellow route line.
//
// Navigation:  navigation.navigate('ParentTracking', {child})
// child = { name, van: { driverId, driver, phone, number, route, onDuty } }

import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  PermissionsAndroid,
  AppState,
  StatusBar,
  Linking,
} from 'react-native';
import MapView, {
  Marker,
  Polyline,
  AnimatedRegion,
  PROVIDER_GOOGLE,
} from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

// ============================================================
// THEME (Yellow + Sandal)
// ============================================================

const C = {
  sandal: '#FFF6E0',
  yellow: '#FFC400',
  yellowDeep: '#F29D00',
  brown: '#3A2A00',
  brownSoft: '#7A5A1E',
  muted: '#8A7650',
  border: '#EFDDAE',
  green: '#16A34A',
  red: '#DC2626',
};

// ============================================================
// CONFIG
// ============================================================

const API_URL = 'https://blackpathsoftwaresolutions.com';
const REVERB_APP_KEY = 'swzc1oohx2jmjrq9eftw';
const REVERB_HOST = 'blackpathsoftwaresolutions.com';
const REVERB_PORT = 443;

// Directions API must be enabled for this key (+ billing enabled)
// Put your REAL key here
const GOOGLE_API_KEY = 'AIzaSyAIYXornd93q38EIYOELtmWwNtRmxoLaTg';

const ROUTE_COLOR = '#FFC400'; // yellow line
const ROUTE_BORDER_COLOR = '#7A5A1E'; // dark casing so it shows on the map

const MIN_MOVE_M = 4; // ignore GPS noise below this
const MIN_ANIM_MS = 800;
const MAX_ANIM_MS = 4000;
const HEADING_SMOOTH = 0.6;
const MIN_SPEED_FOR_GPS_HEADING = 1;
const SNAP_M = 30; // snap van onto the route within this distance
const OFF_ROUTE_M = 50; // farther than this = fetch a new route
const POLL_MS = 10000; // fallback polling when the socket is down

// ============================================================
// HELPERS
// ============================================================

const getBearing = (from, to) => {
  const toRad = d => (d * Math.PI) / 180;
  const toDeg = r => (r * 180) / Math.PI;
  const dLon = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

const distanceMeters = (a, b) => {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

const smoothHeading = (prev, next) => {
  const diff = ((next - prev + 540) % 360) - 180;
  return (prev + diff * HEADING_SMOOTH + 360) % 360;
};

const angleDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

// project a coordinate onto the nearest segment of the route
const projectOnRoute = (coord, coords) => {
  if (!coords || coords.length < 2) return null;

  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos((coord.latitude * Math.PI) / 180);
  const toXY = p => ({
    x: (p.longitude - coord.longitude) * mPerDegLon,
    y: (p.latitude - coord.latitude) * mPerDegLat,
  });

  let best = null;

  for (let i = 0; i < coords.length - 1; i++) {
    const A = coords[i];
    const B = coords[i + 1];
    const a = toXY(A);
    const b = toXY(B);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;

    let t = len2 === 0 ? 0 : -(a.x * dx + a.y * dy) / len2;
    t = Math.max(0, Math.min(1, t));

    const px = a.x + t * dx;
    const py = a.y + t * dy;
    const dist = Math.sqrt(px * px + py * py);

    if (!best || dist < best.dist) {
      best = {
        index: i,
        dist,
        point: {
          latitude: A.latitude + t * (B.latitude - A.latitude),
          longitude: A.longitude + t * (B.longitude - A.longitude),
        },
      };
    }
  }
  return best;
};

const decodePolyline = encoded => {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({latitude: lat / 1e5, longitude: lng / 1e5});
  }
  return points;
};

const formatDistance = m =>
  m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;

const formatTime = d =>
  d
    ? d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
    : null;

// ============================================================
// SCREEN
// ============================================================

export default function ParentTracking({navigation, route}) {
  const insets = useSafeAreaInsets();

  const child = route?.params?.child;
  const van = child?.van || {};
  const driverId = Number(van.driverId ?? route?.params?.driverId);

  const mapRef = useRef(null);
  const echoRef = useRef(null);
  const markerRef = useRef(null);
  const animRef = useRef(null); // {coordinate, last, recvAt}
  const headingRef = useRef(undefined);
  const routeRef = useRef([]);
  const lastRouteRef = useRef({from: null, to: null, time: 0});
  const fitStageRef = useRef(0); // 0 none, 1 points, 2 route
  const centeredOnVanRef = useRef(false);
  const watchIdRef = useRef(null);
  const mountedRef = useRef(true);
  const connectedRef = useRef(false);

  const [vanLocation, setVanLocation] = useState(null);
  const [heading, setHeading] = useState(0);
  const [parentLocation, setParentLocation] = useState(null);
  const [connected, setConnected] = useState(false);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [trackView, setTrackView] = useState(true);

  const setConn = value => {
    connectedRef.current = value;
    if (mountedRef.current) setConnected(value);
  };

  // ----------------------------------------------------------
  // INIT
  // ----------------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;

    if (!driverId) {
      Alert.alert('Van not found', 'No van is assigned to this student yet.');
    } else {
      loadVanLocation();
      setupReverb();
    }

    startParentLocation();

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, []);

  // marker bitmaps: draw for a moment, then stop re-rendering
  useEffect(() => {
    setTrackView(true);
    const t = setTimeout(() => setTrackView(false), 1200);
    return () => clearTimeout(t);
  }, [!!vanLocation, !!parentLocation]);

  // refresh when the app comes back to the foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && driverId) {
        loadVanLocation();
      }
    });
    return () => sub.remove();
  }, []);

  // fallback: poll the API while the live socket is not connected
  useEffect(() => {
    if (!driverId) return undefined;
    const timer = setInterval(() => {
      if (!connectedRef.current) {
        loadVanLocation();
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [driverId]);

  // ----------------------------------------------------------
  // PARENT LOCATION
  // ----------------------------------------------------------

  const startParentLocation = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(
            'Permission',
            'Allow location to see the route to your stop.',
          );
          return;
        }
      } else {
        Geolocation.requestAuthorization?.();
      }

      watchIdRef.current = Geolocation.watchPosition(
        pos => {
          setParentLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        error => console.log('Parent location error:', error),
        {
          enableHighAccuracy: true,
          distanceFilter: 20,
          interval: 5000,
          fastestInterval: 3000,
        },
      );
    } catch (error) {
      console.log('Parent location setup error:', error);
    }
  };

  // ----------------------------------------------------------
  // VAN LOCATION (API snapshot + live socket)
  // ----------------------------------------------------------

  const loadVanLocation = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/admin/drivers/${driverId}/location`,
        {method: 'GET', headers: {Accept: 'application/json'}},
      );
      const data = await response.json();

      if (data.status === 'success' && data.location) {
        updateLocation(data.location, true);
      }
    } catch (error) {
      console.log('Van location error:', error);
    }
  };

  const setupReverb = () => {
    try {
      window.Pusher = Pusher;

      const echo = new Echo({
        broadcaster: 'reverb',
        key: REVERB_APP_KEY,
        wsHost: REVERB_HOST,
        wsPort: REVERB_PORT,
        wssPort: REVERB_PORT,
        forceTLS: true,
        enabledTransports: ['wss'],
        disableStats: true,
      });

      echoRef.current = echo;

      const connection = echo.connector.pusher.connection;
      connection.bind('connected', () => {
        setConn(true);
        loadVanLocation();
      });
      connection.bind('disconnected', () => setConn(false));
      connection.bind('error', () => setConn(false));

      echo
        .channel(`driver-location.${driverId}`)
        .listen('.location.updated', event => {
          if (event && event.location) {
            updateLocation(event.location);
          }
        });
    } catch (error) {
      console.log('Reverb setup error:', error);
      setConn(false);
    }
  };

  const updateLocation = (location, isSnapshot = false) => {
    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    let newCoord = {latitude, longitude};
    const now = Date.now();
    const ex = animRef.current;

    // keep the van ON the route line (Rapido style)
    let segHeading = null;
    if (routeRef.current.length > 1) {
      const proj = projectOnRoute(newCoord, routeRef.current);
      if (proj && proj.dist <= SNAP_M) {
        newCoord = proj.point;
        const A = routeRef.current[proj.index];
        const B = routeRef.current[proj.index + 1];
        if (distanceMeters(A, B) > 1) {
          segHeading = getBearing(A, B);
        }
      }
    }

    if (!ex) {
      animRef.current = {
        coordinate: new AnimatedRegion({
          latitude: newCoord.latitude,
          longitude: newCoord.longitude,
          latitudeDelta: 0,
          longitudeDelta: 0,
        }),
        last: newCoord,
        recvAt: now,
      };
    } else {
      const dist = distanceMeters(ex.last, newCoord);

      if (dist >= MIN_MOVE_M) {
        let duration = Math.min(
          Math.max(now - ex.recvAt, MIN_ANIM_MS),
          MAX_ANIM_MS,
        );
        const teleport = isSnapshot && dist > 150;

        const gpsHeading =
          location.heading !== null &&
          location.heading !== undefined &&
          Number.isFinite(Number(location.heading)) &&
          Number(location.heading) >= 0 &&
          Number(location.speed || 0) >= MIN_SPEED_FOR_GPS_HEADING
            ? Number(location.heading)
            : null;

        const moveHeading = getBearing(ex.last, newCoord);
        let rawHeading;
        if (gpsHeading !== null) {
          rawHeading = gpsHeading;
        } else if (segHeading !== null) {
          rawHeading =
            angleDiff(segHeading, moveHeading) > 100 && dist > 8
              ? (segHeading + 180) % 360
              : segHeading;
        } else {
          rawHeading = moveHeading;
        }

        const nextHeading =
          headingRef.current === undefined
            ? rawHeading
            : smoothHeading(headingRef.current, rawHeading);
        headingRef.current = nextHeading;
        setHeading(nextHeading);

        if (teleport) duration = 1;

        if (Platform.OS === 'android' && markerRef.current) {
          markerRef.current.animateMarkerToCoordinate(newCoord, duration);
        } else if (Platform.OS === 'android') {
          ex.coordinate.setValue({
            ...newCoord,
            latitudeDelta: 0,
            longitudeDelta: 0,
          });
        } else {
          ex.coordinate
            .timing({...newCoord, duration, useNativeDriver: false})
            .start();
        }

        ex.last = newCoord;
      }
      ex.recvAt = now;
    }

    if (mountedRef.current) {
      setVanLocation({
        ...location,
        latitude: newCoord.latitude,
        longitude: newCoord.longitude,
        speed: Number(location.speed || 0),
      });
      setLastUpdated(new Date());
    }
  };

  // ----------------------------------------------------------
  // ROUTE: VAN -> PARENT
  // ----------------------------------------------------------

  // Road route only: van -> home along the real driving road (Rapido style).
  // No fake straight line. If Directions fails, no line is drawn and the
  // reason is printed in the Metro console.
  const fetchRoute = async (from, to) => {
    try {
      if (!GOOGLE_API_KEY || GOOGLE_API_KEY === 'AIzaSyAIYXornd93q38EIYOELtmWwNtRmxoLaTg') {
        console.log('Directions skipped: GOOGLE_API_KEY is still the placeholder');
        return;
      }

      const url =
        `https://maps.googleapis.com/maps/api/directions/json` +
        `?origin=${from.latitude},${from.longitude}` +
        `&destination=${to.latitude},${to.longitude}` +
        `&mode=driving&alternatives=false&key=${GOOGLE_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' || !data.routes?.length) {
        console.log('Directions error:', data.status, data.error_message);
        return;
      }

      const r = data.routes[0];
      const leg = r.legs[0];

      // step-by-step polylines follow the road exactly
      // (overview_polyline is simplified and cuts corners at turns)
      let coords = [];
      leg.steps.forEach(step => {
        coords = coords.concat(decodePolyline(step.polyline.points));
      });
      if (coords.length < 2) {
        coords = decodePolyline(r.overview_polyline.points);
      }

      if (!mountedRef.current) return;

      routeRef.current = coords;
      setRouteCoords(coords);
      setRouteInfo({
        distance: leg.distance.text,
        duration: leg.duration.text,
      });

      if (fitStageRef.current < 2 && coords.length > 1 && mapRef.current) {
        fitStageRef.current = 2;
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: {top: 150, right: 60, bottom: 330, left: 60},
          animated: true,
        });
      }
    } catch (error) {
      console.log('Route fetch error:', error);
    }
  };

  // only the van is known (parent GPS off / denied): centre on the van once
  useEffect(() => {
    if (
      vanLocation &&
      !parentLocation &&
      !centeredOnVanRef.current &&
      mapRef.current
    ) {
      centeredOnVanRef.current = true;
      mapRef.current.animateToRegion(
        {
          latitude: vanLocation.latitude,
          longitude: vanLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        600,
      );
    }
  }, [vanLocation?.latitude, vanLocation?.longitude, parentLocation]);

  useEffect(() => {
    if (!vanLocation || !parentLocation) return;

    const from = {
      latitude: vanLocation.latitude,
      longitude: vanLocation.longitude,
    };

    // first fit: show both points right away (works even without API key)
    if (fitStageRef.current === 0 && mapRef.current) {
      fitStageRef.current = 1;
      mapRef.current.fitToCoordinates([from, parentLocation], {
        edgePadding: {top: 150, right: 70, bottom: 330, left: 70},
        animated: true,
      });
    }

    const last = lastRouteRef.current;
    const now = Date.now();

    const firstTime = !last.from;
    const parentMoved = last.to
      ? distanceMeters(last.to, parentLocation) > 40
      : true;
    const proj = projectOnRoute(from, routeRef.current);
    const offRoute = !proj || proj.dist > OFF_ROUTE_M;
    const waitedEnough = now - last.time > 8000;

    if (firstTime || ((parentMoved || offRoute) && waitedEnough)) {
      lastRouteRef.current = {from, to: parentLocation, time: now};
      fetchRoute(from, parentLocation);
    }
  }, [
    vanLocation?.latitude,
    vanLocation?.longitude,
    parentLocation?.latitude,
    parentLocation?.longitude,
  ]);

  // ----------------------------------------------------------
  // CLEANUP
  // ----------------------------------------------------------

  const cleanup = () => {
    const echo = echoRef.current;

    if (echo) {
      try {
        echo.leave(`driver-location.${driverId}`);
        echo.disconnect();
      } catch (error) {
        console.log(error);
      }
    }

    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
    }

    echoRef.current = null;
  };

  // ----------------------------------------------------------
  // ACTIONS
  // ----------------------------------------------------------

  const recenter = () => {
    const pts = [];
    if (vanLocation) {
      pts.push({
        latitude: vanLocation.latitude,
        longitude: vanLocation.longitude,
      });
    }
    if (parentLocation) pts.push(parentLocation);

    if (pts.length > 1) {
      mapRef.current?.fitToCoordinates(
        routeCoords.length > 1 ? routeCoords : pts,
        {
          edgePadding: {top: 150, right: 60, bottom: 330, left: 60},
          animated: true,
        },
      );
    } else if (pts.length === 1) {
      mapRef.current?.animateToRegion(
        {...pts[0], latitudeDelta: 0.01, longitudeDelta: 0.01},
        600,
      );
    }
  };

  const callDriver = () => {
    if (van.phone) Linking.openURL(`tel:${van.phone}`);
  };

  // ----------------------------------------------------------
  // DERIVED
  // ----------------------------------------------------------

  const anim = animRef.current;

  // only the route AHEAD of the van (line starts at the van)
  let visibleRoute = routeCoords;
  if (routeCoords.length > 1 && anim) {
    const proj = projectOnRoute(anim.last, routeCoords);
    if (proj) {
      visibleRoute = [proj.point, ...routeCoords.slice(proj.index + 1)];
    }
  }

  const speedKmh = vanLocation
    ? (Number(vanLocation.speed) * 3.6).toFixed(1)
    : '0.0';

  const straightDist =
    vanLocation && parentLocation
      ? formatDistance(
          distanceMeters(
            {latitude: vanLocation.latitude, longitude: vanLocation.longitude},
            parentLocation,
          ),
        )
      : null;

  const offDuty = van.onDuty === false;
  const updatedAt = formatTime(lastUpdated);

  const initialRegion = {
    latitude: parentLocation?.latitude ?? vanLocation?.latitude ?? 13.0827,
    longitude: parentLocation?.longitude ?? vanLocation?.longitude ?? 80.2707,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  // ----------------------------------------------------------
  // UI
  // ----------------------------------------------------------

  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />

      {/* same map setup as the owner screen (works on Android) */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        zoomEnabled
        rotateEnabled
        onMapReady={() => console.log('PARENT MAP READY')}
        onMapLoaded={() => console.log('PARENT MAP LOADED')}>
        {/* ROUTE casing (dark border) - drawn first */}
        {visibleRoute.length > 1 && (
          <Polyline
            coordinates={visibleRoute}
            strokeColor={ROUTE_BORDER_COLOR}
            strokeWidth={10}
            lineCap="round"
            lineJoin="round"
            zIndex={1}
          />
        )}

        {/* ROUTE yellow line - on top */}
        {visibleRoute.length > 1 && (
          <Polyline
            coordinates={visibleRoute}
            strokeColor={ROUTE_COLOR}
            strokeWidth={6}
            lineCap="round"
            lineJoin="round"
            zIndex={2}
          />
        )}

        {/* PARENT / HOME STOP */}
        {parentLocation && (
          <Marker
            coordinate={parentLocation}
            anchor={{x: 0.5, y: 1}}
            title="You"
            zIndex={5}
            tracksViewChanges={trackView}>
            <View style={styles.homePin}>
              <View style={styles.homePinHead}>
                <Icon name="home" size={20} color={C.yellow} />
              </View>
              <View style={styles.homePinTip} />
            </View>
          </Marker>
        )}

        {/* VAN (top-down, rotates along the road) */}
        {anim && (
          <Marker.Animated
            ref={markerRef}
            coordinate={anim.coordinate}
            anchor={{x: 0.5, y: 0.5}}
            flat
            rotation={heading % 360}
            tracksViewChanges={trackView}
            zIndex={10}
            title={van.driver || 'School Van'}
            description={`Speed: ${speedKmh} km/h`}>
            <View style={styles.vanWrap}>
              <View style={[styles.wheel, {left: 2, top: 10}]} />
              <View style={[styles.wheel, {right: 2, top: 10}]} />
              <View style={[styles.wheel, {left: 2, bottom: 10}]} />
              <View style={[styles.wheel, {right: 2, bottom: 10}]} />

              <View style={styles.vanBody}>
                <View style={styles.vanWindshield} />
                <View style={styles.vanRoof}>
                  <View style={styles.vanRoofLine} />
                </View>
                <View style={styles.vanRearWindow} />
              </View>
            </View>
          </Marker.Animated>
        )}
      </MapView>

      {/* TOP BAR */}
      <View style={[styles.top, {top: insets.top + 10}]}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.85}
          onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color={C.brown} />
        </TouchableOpacity>

        <View style={styles.titleBox}>
          <Text style={styles.title} numberOfLines={1}>
            {child?.name ? `${child.name}'s Van` : 'School Van'}
          </Text>
          <Text style={styles.sub}>Live location</Text>
        </View>

        <View
          style={[
            styles.liveBadge,
            {backgroundColor: connected ? C.green : C.red},
          ]}>
          <Text style={styles.liveText}>{connected ? 'LIVE' : 'OFFLINE'}</Text>
        </View>
      </View>

      {/* RECENTER */}
      <TouchableOpacity
        style={[styles.recenter, {bottom: 270 + insets.bottom}]}
        activeOpacity={0.85}
        onPress={recenter}>
        <Icon name="crosshairs-gps" size={22} color={C.brown} />
      </TouchableOpacity>

      {/* BOTTOM CARD */}
      <View style={[styles.card, {paddingBottom: insets.bottom + 16}]}>
        <View style={styles.row}>
          <View style={styles.vanIconBig}>
            <Icon name="bus-school" size={28} color={C.brown} />
          </View>

          <View style={{flex: 1, marginLeft: 12}}>
            <Text style={styles.cardName} numberOfLines={1}>
              {van.driver || 'Driver'}
            </Text>
            <Text style={styles.cardSub} numberOfLines={1}>
              {van.number || 'School Van'}
              {van.route ? ` • ${van.route}` : ''}
            </Text>
          </View>

          {van.onDuty !== undefined && (
            <View
              style={[
                styles.dutyChip,
                {backgroundColor: offDuty ? '#F1E6CC' : '#DCFCE7'},
              ]}>
              <Text
                style={[
                  styles.dutyText,
                  {color: offDuty ? C.muted : C.green},
                ]}>
                {offDuty ? 'OFF DUTY' : 'ON DUTY'}
              </Text>
            </View>
          )}

          {van.phone ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={callDriver}
              style={styles.callBtn}>
              <Icon name="phone" size={20} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.etaBox}>
          {vanLocation ? (
            <>
              <View style={{flex: 1}}>
                <Text style={styles.etaMain}>
                  {routeInfo ? routeInfo.duration : straightDist || '--'}
                </Text>
                <Text style={styles.etaSub}>
                  {routeInfo
                    ? `${routeInfo.distance} away • ${speedKmh} km/h`
                    : `Van is on the way • ${speedKmh} km/h`}
                  {updatedAt ? `  • ${updatedAt}` : ''}
                </Text>
              </View>
              <Icon name="map-marker-distance" size={28} color={C.yellowDeep} />
            </>
          ) : (
            <View style={{flex: 1}}>
              <Text style={styles.etaMain}>
                {offDuty ? 'Driver is off duty' : 'Waiting for van...'}
              </Text>
              <Text style={styles.etaSub}>
                {offDuty
                  ? 'Van location will appear when the trip starts.'
                  : 'Looking for the van location...'}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.goBack()}
          style={{marginTop: 12}}>
          <LinearGradient
            colors={[C.yellow, C.yellowDeep]}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.backHome}>
            <Icon name="home" size={20} color={C.brown} />
            <Text style={styles.backHomeText}>Back to Home</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: C.sandal},
  map: {flex: 1},

  top: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 3},
  },
  titleBox: {
    flex: 1,
    marginHorizontal: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 3},
  },
  title: {fontSize: 16, fontWeight: '800', color: C.brown},
  sub: {fontSize: 11.5, color: C.muted, marginTop: 1},

  liveBadge: {paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20},
  liveText: {color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5},

  recenter: {
    position: 'absolute',
    right: 14,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 3},
  },

  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.sandal,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 16,
    elevation: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: -3},
  },
  row: {flexDirection: 'row', alignItems: 'center'},
  vanIconBig: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: {fontSize: 17, fontWeight: '800', color: C.brown},
  cardSub: {marginTop: 3, fontSize: 12.5, color: C.muted},
  dutyChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    marginRight: 8,
  },
  dutyText: {fontSize: 10, fontWeight: '800'},
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },

  etaBox: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  etaMain: {fontSize: 21, fontWeight: '900', color: C.brown},
  etaSub: {marginTop: 2, fontSize: 12, color: C.muted},

  backHome: {
    height: 50,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backHomeText: {marginLeft: 8, fontSize: 16, fontWeight: '800', color: C.brown},

  // ---------- parent / home pin ----------
  homePin: {width: 44, height: 56, alignItems: 'center'},
  homePinHead: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.brown,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  homePinTip: {
    width: 0,
    height: 0,
    marginTop: -2,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: C.brown,
  },

  // ---------- top-down van ----------
  vanWrap: {
    width: 40,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheel: {
    position: 'absolute',
    width: 6,
    height: 14,
    borderRadius: 3,
    backgroundColor: '#1F1700',
  },
  vanBody: {
    width: 28,
    height: 58,
    borderRadius: 9,
    backgroundColor: C.yellow,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: {width: 0, height: 2},
  },
  vanWindshield: {
    width: 20,
    height: 11,
    marginTop: 5,
    borderRadius: 4,
    backgroundColor: C.brown,
  },
  vanRoof: {
    width: 20,
    height: 24,
    marginTop: 4,
    borderRadius: 4,
    backgroundColor: '#FFE27A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vanRoofLine: {width: 2, height: 18, backgroundColor: '#E0A800'},
  vanRearWindow: {
    width: 18,
    height: 5,
    marginTop: 4,
    borderRadius: 2,
    backgroundColor: C.brown,
    opacity: 0.7,
  },
});