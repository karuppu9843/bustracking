// screens/RouteMapScreen.js  (DRIVER)
//
// - loads real children from  GET  /api/driver/children?user_id=
// - nearest child first, then next nearest, and so on
// - yellow route line to the next child + lighter line for the rest
// - "Picked up" / "Missed" buttons save to  POST /api/driver/pickup
// - tap any child pin to see its card
// - if that child is already picked / missed, the card shows the STATUS
//   (no buttons)
//
// Uses @react-native-community/geolocation (same as ParentTracking)
// so it does NOT touch react-native-geolocation-service (that caused the crash).

import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import MapView, {Marker, Polyline, PROVIDER_GOOGLE} from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';

// ============================================================
// CONFIG
// ============================================================

const API_BASE_URL = 'https://blackpathsoftwaresolutions.com/api';

// Directions API key (restricted key!). Leave as-is to draw straight lines.
const GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_API_KEY';

const CHILDREN_REFRESH_MS = 60000; // reload children every 60 sec
const ARRIVED_M = 50; // within 50 m = "arrived"

const C = {
  sandal: '#FFF6E0',
  yellow: '#FFC400',
  yellowSoft: '#FFD84D',
  amber: '#F29D00',
  brown: '#3A2A00',
  brownSoft: '#7A5A1E',
  muted: '#8A7650',
  green: '#16A34A',
  red: '#DC2626',
};

const DEFAULT_CENTER = {latitude: 13.0827, longitude: 80.2707};

// ============================================================
// HELPERS
// ============================================================

const toRad = x => (x * Math.PI) / 180;

const haversine = (a, b) => {
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

const fmtDist = m =>
  m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`;

// nearest child first, then nearest to that child, and so on
const orderNearestFirst = (start, list) => {
  const left = [...list];
  const out = [];
  let cur = start;
  while (left.length) {
    let bi = 0;
    let bd = Infinity;
    left.forEach((c, i) => {
      const dd = haversine(cur, {latitude: c.lat, longitude: c.lng});
      if (dd < bd) {
        bd = dd;
        bi = i;
      }
    });
    const [n] = left.splice(bi, 1);
    out.push(n);
    cur = {latitude: n.lat, longitude: n.lng};
  }
  return out;
};

const decodePolyline = str => {
  let i = 0, lat = 0, lng = 0;
  const pts = [];
  while (i < str.length) {
    let b, shift = 0, res = 0;
    do {
      b = str.charCodeAt(i++) - 63;
      res |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += res & 1 ? ~(res >> 1) : res >> 1;
    shift = 0;
    res = 0;
    do {
      b = str.charCodeAt(i++) - 63;
      res |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += res & 1 ? ~(res >> 1) : res >> 1;
    pts.push({latitude: lat / 1e5, longitude: lng / 1e5});
  }
  return pts;
};

// road route between two points (straight line if Directions is not available)
const fetchRoad = async (from, to) => {
  const straight = [from, to];

  if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'YOUR_GOOGLE_API_KEY') {
    return straight;
  }

  try {
    const url =
      'https://maps.googleapis.com/maps/api/directions/json' +
      `?origin=${from.latitude},${from.longitude}` +
      `&destination=${to.latitude},${to.longitude}` +
      `&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;

    const res = await fetch(url);
    const json = await res.json();

    if (json.status !== 'OK' || !json.routes?.length) {
      console.log('DIRECTIONS:', json.status, json.error_message);
      return straight;
    }

    // step polylines follow the road exactly
    let coords = [];
    json.routes[0].legs[0].steps.forEach(st => {
      coords = coords.concat(decodePolyline(st.polyline.points));
    });

    return coords.length > 1 ? coords : straight;
  } catch (e) {
    console.log('DIRECTIONS ERROR:', e);
    return straight;
  }
};

// ============================================================
// SCREEN
// ============================================================

export default function RouteMapScreen({navigation}) {
  const {width} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const k = Math.min(width / 411, 1.3);
  const d = n => n * k;

  const mapRef = useRef(null);
  const watchRef = useRef(null);
  const driverIdRef = useRef(null);
  const legReq = useRef(0);
  const restReq = useRef(0);
  const lastLeg = useRef({from: null, id: null, time: 0});

  const [me, setMe] = useState(null);
  const [children, setChildren] = useState([]);
  const [statusMap, setStatusMap] = useState({}); // {childId: 'picked' | 'missed'}
  const [order, setOrder] = useState([]);
  const [nextLine, setNextLine] = useState([]);
  const [laterLine, setLaterLine] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null); // child tapped on the map

  // ----------------------------------------------------------
  // DRIVER GPS
  // ----------------------------------------------------------
  useEffect(() => {
    let alive = true;

    const start = async () => {
      try {
        if (Platform.OS === 'android') {
          const ok = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          );
          if (!ok) {
            const r = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            );
            if (r !== PermissionsAndroid.RESULTS.GRANTED) {
              Alert.alert('Permission', 'Allow location to see your van on the map.');
              return;
            }
          }
        } else {
          Geolocation.requestAuthorization?.();
        }

        watchRef.current = Geolocation.watchPosition(
          p => {
            if (alive) {
              setMe({latitude: p.coords.latitude, longitude: p.coords.longitude});
            }
          },
          e => console.log('MAP GPS ERROR:', e),
          {enableHighAccuracy: true, distanceFilter: 5, interval: 4000, fastestInterval: 3000},
        );
      } catch (e) {
        console.log('GPS START ERROR:', e);
      }
    };

    start();

    return () => {
      alive = false;
      if (watchRef.current !== null) {
        Geolocation.clearWatch(watchRef.current);
      }
    };
  }, []);

  // ----------------------------------------------------------
  // LOAD CHILDREN FROM API
  // ----------------------------------------------------------
  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const id = await AsyncStorage.getItem('userId');
        if (!id) {
          setLoaded(true);
          return;
        }
        driverIdRef.current = Number(id);

        const headers = {Accept: 'application/json'};

        const [res, tripRes] = await Promise.all([
          fetch(`${API_BASE_URL}/driver/children?user_id=${id}`, {headers}),
          fetch(`${API_BASE_URL}/driver/daily-trip?user_id=${id}`, {headers}).catch(
            () => null,
          ),
        ]);

        const data = await res.json();

        // today's saved picked / missed list (from pickup log)
        let trips = [];
        try {
          if (tripRes && tripRes.ok) {
            const t = await tripRes.json();
            if (t?.status === 'success') {
              trips = t.trips || [];
            }
          }
        } catch (e) {
          console.log('TRIPS PARSE ERROR:', e);
        }

        if (!alive) return;

        if (res.ok && data?.status === 'success') {
          const list = (data.children || []).filter(
            c => Number.isFinite(c.lat) && Number.isFinite(c.lng),
          );

          // update only when something changed, so the route does not redraw
          setChildren(prev =>
            JSON.stringify(prev) === JSON.stringify(list) ? prev : list,
          );

          // children already done today (from the server)
          // server can send  today_status: 'picked' | 'missed'
          // (old servers only send picked_today)
          setStatusMap(prev => {
            const n = {...prev};
            list.forEach(c => {
              if (n[c.id]) return;
              if (c.today_status === 'picked' || c.today_status === 'missed') {
                n[c.id] = c.today_status;
              } else if (c.picked_today) {
                n[c.id] = 'picked';
              }
            });

            // saved pickup log: this is what fixes "already picked" showing buttons
            trips.forEach(t => {
              if (t.status === 'picked' || t.status === 'missed') {
                n[t.student_id] = t.status;
              }
            });

            return n;
          });
        }
      } catch (e) {
        console.log('CHILDREN LOAD ERROR:', e);
      } finally {
        if (alive) setLoaded(true);
      }
    };

    load();
    const t = setInterval(load, CHILDREN_REFRESH_MS);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // ----------------------------------------------------------
  // ORDER: nearest first
  // (re-sorted only when children / picked list changes, not on every GPS tick)
  // ----------------------------------------------------------
  const hasFix = !!me;
  const doneKey = Object.keys(statusMap).sort().join(',');
  const childKey = children.map(c => c.id).join(',');

  useEffect(() => {
    if (!me) return;
    const remaining = children.filter(c => !statusMap[c.id]);
    setOrder(orderNearestFirst(me, remaining));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFix, doneKey, childKey]);

  const orderKey = order.map(o => o.id).join(',');
  const next = order[0] || null;
  const nextCoord = next ? {latitude: next.lat, longitude: next.lng} : null;
  const distToNext = me && nextCoord ? haversine(me, nextCoord) : 0;
  const arrived = !!next && distToNext <= ARRIVED_M;

  // ----------------------------------------------------------
  // ACTIVE CHILD for the bottom card
  // = child tapped on the map, otherwise the next pick-up
  // ----------------------------------------------------------
  const selected = selectedId ? children.find(c => c.id === selectedId) : null;
  const active = selected || next;
  const activeStatus = active ? statusMap[active.id] : null; // picked | missed | undefined
  const activeIsNext = !!active && !!next && active.id === next.id;
  const distToActive =
    me && active ? haversine(me, {latitude: active.lat, longitude: active.lng}) : 0;

  // ----------------------------------------------------------
  // ROUTE LINE 1: van -> next child  (updates as the van moves)
  // ----------------------------------------------------------
  useEffect(() => {
    if (!me || !next) {
      setNextLine([]);
      return;
    }

    const last = lastLeg.current;
    const moved = last.from ? haversine(last.from, me) : Infinity;
    const changed = last.id !== next.id;

    if (!changed && (moved < 40 || Date.now() - last.time < 8000)) {
      return;
    }

    lastLeg.current = {from: me, id: next.id, time: Date.now()};
    const reqId = ++legReq.current;

    fetchRoad(me, {latitude: next.lat, longitude: next.lng}).then(line => {
      if (reqId === legReq.current) setNextLine(line);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.latitude, me?.longitude, next?.id]);

  // ----------------------------------------------------------
  // ROUTE LINE 2: child -> child -> child  (lighter parallel line)
  // ----------------------------------------------------------
  useEffect(() => {
    if (order.length < 2) {
      setLaterLine([]);
      return;
    }

    const reqId = ++restReq.current;

    (async () => {
      let rest = [];
      for (let i = 0; i < order.length - 1; i++) {
        const seg = await fetchRoad(
          {latitude: order[i].lat, longitude: order[i].lng},
          {latitude: order[i + 1].lat, longitude: order[i + 1].lng},
        );
        rest = rest.concat(seg);
      }
      if (reqId === restReq.current) setLaterLine(rest);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey]);

  // ----------------------------------------------------------
  // FIT MAP to van + all remaining children
  // ----------------------------------------------------------
  useEffect(() => {
    if (!mapRef.current || !me || order.length === 0) return;

    const pts = [me, ...order.map(o => ({latitude: o.lat, longitude: o.lng}))];

    mapRef.current.fitToCoordinates(pts, {
      edgePadding: {
        top: d(210) + insets.top,
        bottom: d(300) + insets.bottom,
        left: d(50),
        right: d(50),
      },
      animated: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey, hasFix]);

  // ----------------------------------------------------------
  // SAVE "PICKED UP" / "MISSED"
  // ----------------------------------------------------------
  const markStatus = async status => {
    if (!active || saving) return;

    const child = active;

    // already done: never save again
    if (statusMap[child.id]) return;

    setSaving(true);
    setStatusMap(prev => ({...prev, [child.id]: status}));

    try {
      const res = await fetch(`${API_BASE_URL}/driver/pickup`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: driverIdRef.current,
          student_id: child.id,
          status,
          trip_type: 'pickup',
          latitude: me?.latitude,
          longitude: me?.longitude,
        }),
      });

      const data = await res.json();

      if (!res.ok || data?.status !== 'success') {
        throw new Error(data?.message || 'Could not save.');
      }

      // go back to "next pick-up" card
      setSelectedId(null);
    } catch (e) {
      // undo, server did not save
      setStatusMap(prev => {
        const n = {...prev};
        delete n[child.id];
        return n;
      });
      Alert.alert('Error', e?.message || 'Could not save. Check internet and try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmMissed = () => {
    if (!active || statusMap[active.id]) return;
    Alert.alert('Mark as missed?', `${active.name} was not picked up.`, [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Mark missed', style: 'destructive', onPress: () => markStatus('missed')},
    ]);
  };

  const doneCount = Object.keys(statusMap).length;
  const total = Math.max(children.length, doneCount);
  const noChildren = loaded && children.length === 0;
  const allDone = loaded && children.length > 0 && order.length === 0 && !!me;

  // ----------------------------------------------------------
  // UI
  // ----------------------------------------------------------
  return (
    <View style={{flex: 1, backgroundColor: C.sandal}}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        showsCompass={false}
        showsPointsOfInterest={false}
        toolbarEnabled={false}
        onPress={() => setSelectedId(null)}
        initialRegion={{
          ...DEFAULT_CENTER,
          latitudeDelta: 0.06,
          longitudeDelta: 0.06,
        }}>
        {/* later stops: soft parallel line */}
        {laterLine.length > 1 && (
          <>
            <Polyline
              coordinates={laterLine}
              strokeColor="rgba(242,157,0,0.35)"
              strokeWidth={d(11)}
              lineCap="round"
              lineJoin="round"
            />
            <Polyline
              coordinates={laterLine}
              strokeColor={C.yellowSoft}
              strokeWidth={d(6)}
              lineCap="round"
              lineJoin="round"
            />
          </>
        )}

        {/* next child: bold yellow line with amber outline */}
        {nextLine.length > 1 && (
          <>
            <Polyline
              coordinates={nextLine}
              strokeColor={C.amber}
              strokeWidth={d(14)}
              lineCap="round"
              lineJoin="round"
            />
            <Polyline
              coordinates={nextLine}
              strokeColor={C.yellow}
              strokeWidth={d(9)}
              lineCap="round"
              lineJoin="round"
            />
          </>
        )}

        {/* children */}
        {children.map(c => {
          const idx = order.findIndex(o => o.id === c.id);
          const st = statusMap[c.id];
          const isNext = !!next && next.id === c.id;
          const isSel = selectedId === c.id;

          return (
            <Marker
              key={`${c.id}-${st || 'x'}-${isNext ? 'n' : 'o'}-${idx}-${isSel ? 's' : 'u'}`}
              coordinate={{latitude: c.lat, longitude: c.lng}}
              anchor={{x: 0.5, y: 0.5}}
              title={c.name}
              description={
                st === 'picked'
                  ? 'Picked up'
                  : st === 'missed'
                  ? 'Missed'
                  : c.stop
              }
              onPress={() => setSelectedId(c.id)}
              tracksViewChanges={false}>
              <View
                style={[
                  styles.pin,
                  {
                    width: isNext ? d(40) : d(30),
                    height: isNext ? d(40) : d(30),
                    borderRadius: isNext ? d(20) : d(15),
                    borderColor: isSel ? C.amber : '#fff',
                    backgroundColor:
                      st === 'picked'
                        ? C.green
                        : st === 'missed'
                        ? C.red
                        : isNext
                        ? C.brown
                        : C.yellow,
                  },
                ]}>
                {st ? (
                  <Icon
                    name={st === 'picked' ? 'check' : 'close'}
                    size={d(16)}
                    color="#fff"
                  />
                ) : (
                  <Text
                    allowFontScaling={false}
                    style={{
                      fontSize: d(isNext ? 15 : 12),
                      fontWeight: '900',
                      color: isNext ? C.yellow : C.brown,
                    }}>
                    {idx + 1}
                  </Text>
                )}
              </View>
            </Marker>
          );
        })}

        {/* driver / van */}
        {me && (
          <Marker coordinate={me} anchor={{x: 0.5, y: 0.5}} flat tracksViewChanges={false}>
            <View style={styles.vanHalo}>
              <View style={styles.vanDot}>
                <Icon name="bus-school" size={22} color={C.brown} />
              </View>
            </View>
          </Marker>
        )}
      </MapView>

      {/* ---------- TOP ---------- */}
      <View style={{paddingTop: insets.top + d(10), paddingHorizontal: d(16)}}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.goBack()}
            style={[styles.roundBtn, {width: d(44), height: d(44), borderRadius: d(22)}]}>
            <Icon name="chevron-left" size={d(26)} color={C.brown} />
          </TouchableOpacity>

          <Text
            allowFontScaling={false}
            style={{
              flex: 1,
              textAlign: 'center',
              marginRight: d(44),
              fontSize: d(18),
              fontWeight: '800',
              color: C.brown,
            }}>
            Route Map
          </Text>
        </View>

        <View style={[styles.card, {marginTop: d(12), padding: d(14), borderRadius: d(18)}]}>
          {!loaded || (!me && !noChildren) ? (
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <ActivityIndicator color={C.amber} />
              <Text
                allowFontScaling={false}
                style={{marginLeft: d(10), fontSize: d(13), color: C.muted}}>
                {!loaded ? 'Loading children...' : 'Getting your location...'}
              </Text>
            </View>
          ) : noChildren ? (
            <Text allowFontScaling={false} style={{fontSize: d(14), fontWeight: '700', color: C.brown}}>
              No children with a saved pickup location yet.
            </Text>
          ) : allDone ? (
            <Text allowFontScaling={false} style={{fontSize: d(15), fontWeight: '800', color: C.green}}>
              All children done for this trip
            </Text>
          ) : next ? (
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Icon
                name={arrived ? 'map-marker-check' : 'navigation-variant'}
                size={d(38)}
                color={arrived ? C.green : C.brown}
              />
              <View style={{marginLeft: d(12), flex: 1}}>
                <Text
                  allowFontScaling={false}
                  style={{fontSize: d(24), fontWeight: '900', color: C.brown}}>
                  {arrived ? 'You have arrived' : fmtDist(distToNext)}
                </Text>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={{fontSize: d(13), color: C.muted}}>
                  {arrived ? next.stop : `towards ${next.stop}`}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>

      {/* ---------- BOTTOM ---------- */}
      <View
        style={{
          position: 'absolute',
          left: d(16),
          right: d(16),
          bottom: insets.bottom + d(16),
        }}>
        {active && (
          <View style={[styles.card, {borderRadius: d(20), padding: d(14)}]}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <View
                style={{
                  width: d(46),
                  height: d(46),
                  borderRadius: d(23),
                  backgroundColor:
                    activeStatus === 'picked'
                      ? '#DCFCE7'
                      : activeStatus === 'missed'
                      ? '#FCE4E4'
                      : '#FFF0BF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon
                  name={
                    activeStatus === 'picked'
                      ? 'check-circle'
                      : activeStatus === 'missed'
                      ? 'close-circle'
                      : 'account-child'
                  }
                  size={d(26)}
                  color={
                    activeStatus === 'picked'
                      ? C.green
                      : activeStatus === 'missed'
                      ? C.red
                      : '#B77A00'
                  }
                />
              </View>

              <View style={{flex: 1, marginLeft: d(12)}}>
                <Text allowFontScaling={false} style={{fontSize: d(11), color: C.muted}}>
                  {activeStatus ? 'Today' : activeIsNext ? 'Next pick-up' : 'Selected child'}
                </Text>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={{fontSize: d(16), fontWeight: '800', color: C.brown}}>
                  {active.name}
                </Text>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={{fontSize: d(12), color: C.brownSoft}}>
                  {active.stop} · {fmtDist(distToActive)}
                </Text>
              </View>

              <View style={styles.countPill}>
                <Text
                  allowFontScaling={false}
                  style={{fontSize: d(11), fontWeight: '800', color: '#8A5A00'}}>
                  {doneCount}/{total}
                </Text>
              </View>
            </View>

            {/* ALREADY DONE: show status only, NO buttons */}
            {activeStatus ? (
              <View
                style={{
                  marginTop: d(12),
                  height: d(46),
                  borderRadius: d(23),
                  backgroundColor: activeStatus === 'picked' ? '#DCFCE7' : '#FCE4E4',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon
                  name={activeStatus === 'picked' ? 'check-circle' : 'close-circle'}
                  size={d(20)}
                  color={activeStatus === 'picked' ? C.green : C.red}
                />
                <Text
                  allowFontScaling={false}
                  style={{
                    marginLeft: d(8),
                    fontSize: d(15),
                    fontWeight: '800',
                    color: activeStatus === 'picked' ? C.green : C.red,
                  }}>
                  {activeStatus === 'picked' ? 'Picked up' : 'Missed'}
                </Text>
              </View>
            ) : (
              <View style={{flexDirection: 'row', marginTop: d(12)}}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  disabled={saving}
                  onPress={confirmMissed}
                  style={{
                    width: d(96),
                    height: d(46),
                    borderRadius: d(23),
                    backgroundColor: '#FCE4E4',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: saving ? 0.6 : 1,
                  }}>
                  <Text
                    allowFontScaling={false}
                    style={{fontSize: d(14), fontWeight: '800', color: C.red}}>
                    Missed
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.9}
                  disabled={saving}
                  onPress={() => markStatus('picked')}
                  style={{
                    flex: 1,
                    marginLeft: d(10),
                    height: d(46),
                    borderRadius: d(23),
                    backgroundColor: C.yellow,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: saving ? 0.6 : 1,
                  }}>
                  {saving ? (
                    <ActivityIndicator color={C.brown} />
                  ) : (
                    <Text
                      allowFontScaling={false}
                      style={{fontSize: d(15), fontWeight: '800', color: C.brown}}>
                      Picked up
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* re-centre */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() =>
            me &&
            mapRef.current?.animateToRegion(
              {...me, latitudeDelta: 0.01, longitudeDelta: 0.01},
              500,
            )
          }
          style={[
            styles.roundBtn,
            {
              position: 'absolute',
              right: 0,
              top: -d(56),
              width: d(44),
              height: d(44),
              borderRadius: d(22),
            },
          ]}>
          <Icon name="crosshairs-gps" size={d(22)} color={C.brown} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    elevation: 6,
    shadowColor: '#9A6A00',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
  },
  roundBtn: {
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 3},
  },
  pin: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 4,
  },
  vanHalo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,196,0,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vanDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFC400',
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPill: {
    backgroundColor: '#FFF0BF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
});