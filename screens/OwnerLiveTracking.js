import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
    PermissionsAndroid,
    AppState,
    BackHandler,
    ScrollView,
    RefreshControl,
    StatusBar,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ============================================================
// THEME (Yellow + Sandal)
// ============================================================

const C = {
    sandal: '#FFF6E0',
    sandalMid: '#F6E7C8',
    yellow: '#FFC400',
    yellowSoft: '#FFD84D',
    yellowDeep: '#F29D00',
    brown: '#3A2A00',
    brownSoft: '#7A5A1E',
    muted: '#8A7650',
    border: '#EFDDAE',
    green: '#16A34A',
};

// ============================================================
// CONFIG
// ============================================================

const API_URL = 'https://blackpathsoftwaresolutions.com';
const REVERB_APP_KEY = 'swzc1oohx2jmjrq9eftw';
const REVERB_HOST = 'blackpathsoftwaresolutions.com'; // hostname only
const REVERB_PORT = 443;

const GOOGLE_API_KEY = 'YOUR_GOOGLE_API_KEY'; // Directions API enabled

// Route colors (yellow line with a dark casing so it is visible on the map)
const ROUTE_COLOR = '#FFC400';
const ROUTE_BORDER_COLOR = '#7A5A1E';

// Movement tuning
const MIN_MOVE_M = 4; // ignore GPS noise below this (meters)
const MIN_ANIM_MS = 800; // shortest marker animation
const MAX_ANIM_MS = 4000; // longest marker animation
const HEADING_SMOOTH = 0.6; // 0..1, higher = faster turn
const MIN_SPEED_FOR_GPS_HEADING = 1; // m/s, below this use 2-point bearing
// The van icon is drawn top-down with its FRONT pointing UP (north),
// so no rotation offset is needed.
const ICON_ROTATION_OFFSET = 0;
const SNAP_M = 30; // snap van onto the route if closer than this (meters)
const OFF_ROUTE_M = 50; // van farther than this from the route = re-route

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

// distance in meters
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

// shortest-path angle smoothing (350 -> 10 turns 20deg, not 340deg)
const smoothHeading = (prev, next) => {
    const diff = ((next - prev + 540) % 360) - 180;
    return (prev + diff * HEADING_SMOOTH + 360) % 360;
};

// smallest difference between two angles (0..180)
const angleDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

// Project a coordinate onto the nearest segment of a route.
// Returns { point, index, dist } (dist in meters) or null.
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

// Google encoded polyline decoder
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

        points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
};

// ============================================================
// COMPONENT
// ============================================================

const OwnerLiveTracking = ({ navigation }) => {
    const insets = useSafeAreaInsets();

    const mapRef = useRef(null);
    const echoRef = useRef(null);
    const channelsRef = useRef({});
    const animationRefs = useRef({});
    const markerRefs = useRef({});
    const headingRefs = useRef({});
    const lastRouteRef = useRef({ from: null, to: null, time: 0 });
    const fitDoneForRef = useRef(null);
    const watchIdRef = useRef(null);
    const driversRef = useRef([]);
    const mountedRef = useRef(true);
    const routeRef = useRef([]); // full route: van -> owner
    const selectedIdRef = useRef(null);

    const [drivers, setDrivers] = useState([]);
    const [driverLocations, setDriverLocations] = useState({});
    const [headings, setHeadings] = useState({});
    const [selectedDriver, setSelectedDriver] = useState(null);
    const [mapOpen, setMapOpen] = useState(false); // list first, map on tap
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [connected, setConnected] = useState(false);
    const [echoReady, setEchoReady] = useState(false);
    // marker bitmap is only re-rendered briefly when a marker is added
    const [trackView, setTrackView] = useState(true);

    const [ownerLocation, setOwnerLocation] = useState(null);
    const [routeCoords, setRouteCoords] = useState([]);
    const [routeInfo, setRouteInfo] = useState(null); // { distance, duration }

    // ========================================================
    // INITIAL LOAD
    // ========================================================

    useEffect(() => {
        mountedRef.current = true;
        initialize();
        startOwnerLocation();
        return () => {
            mountedRef.current = false;
            cleanup();
        };
    }, []);

    const initialize = async () => {
        try {
            await loadDrivers();
            setupReverb();
        } catch (error) {
            console.log('Initialize error:', error);
        }
    };

    // ========================================================
    // ANDROID BACK: map -> list
    // ========================================================

    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (mapOpen) {
                closeMap();
                return true;
            }
            return false;
        });
        return () => sub.remove();
    }, [mapOpen]);

    // ========================================================
    // APP STATE: refresh locations when app returns to foreground
    // ========================================================

    useEffect(() => {
        const sub = AppState.addEventListener('change', state => {
            if (state === 'active' && driversRef.current.length > 0) {
                loadDriverLocations(driversRef.current);
            }
        });
        return () => sub.remove();
    }, []);

    // ========================================================
    // MARKER BITMAP: stop re-rendering after markers are drawn
    // ========================================================

    const markerCount = Object.keys(driverLocations).length;

    useEffect(() => {
        setTrackView(true);
        const t = setTimeout(() => setTrackView(false), 1000);
        return () => clearTimeout(t);
    }, [markerCount, mapOpen]);

    // ========================================================
    // OWNER LOCATION
    // ========================================================

    const startOwnerLocation = async () => {
        try {
            if (Platform.OS === 'android') {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
                );
                if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                    Alert.alert('Permission', 'Location permission is required.');
                    return;
                }
            } else {
                Geolocation.requestAuthorization?.();
            }

            watchIdRef.current = Geolocation.watchPosition(
                pos => {
                    setOwnerLocation({
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                    });
                },
                error => console.log('Owner location error:', error),
                {
                    enableHighAccuracy: true,
                    distanceFilter: 20,
                    interval: 5000,
                    fastestInterval: 3000,
                }
            );
        } catch (error) {
            console.log('Owner location setup error:', error);
        }
    };

    // ========================================================
    // LOAD DRIVERS
    // ========================================================

    const loadDrivers = async (silent = false) => {
        try {
            if (!silent) setLoading(true);

            const response = await fetch(`${API_URL}/api/admin/drivers`, {
                method: 'GET',
                headers: { Accept: 'application/json' },
            });
            const data = await response.json();

            if (!response.ok || data.status !== 'success') {
                throw new Error(data.message || 'Failed to load drivers');
            }

            const driverList = data.drivers || [];
            driversRef.current = driverList;
            setDrivers(driverList);
            await loadDriverLocations(driverList);
        } catch (error) {
            console.log('Driver API error:', error);
            Alert.alert('Error', 'Unable to load vans');
        } finally {
            if (mountedRef.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadDrivers(true);
    };

    const loadDriverLocations = async driverList => {
        await Promise.all(
            driverList.map(async driver => {
                const driverId = Number(driver.id);
                try {
                    const response = await fetch(
                        `${API_URL}/api/admin/drivers/${driverId}/location`,
                        { method: 'GET', headers: { Accept: 'application/json' } }
                    );
                    const data = await response.json();

                    if (data.status === 'success' && data.location) {
                        updateLocation(data.location, true);
                    }
                } catch (error) {
                    console.log(`Location error ${driverId}:`, error);
                }
            })
        );
    };

    // ========================================================
    // REVERB
    // ========================================================

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
                setConnected(true);
                // socket may have been down: re-sync latest positions
                if (driversRef.current.length > 0) {
                    loadDriverLocations(driversRef.current);
                }
            });
            connection.bind('disconnected', () => setConnected(false));
            connection.bind('error', () => setConnected(false));

            // triggers the subscribe effect below
            setEchoReady(true);
        } catch (error) {
            console.log('Reverb setup error:', error);
            setConnected(false);
        }
    };

    // Subscribe once BOTH echo and drivers are ready
    useEffect(() => {
        if (echoReady && drivers.length > 0) {
            subscribeDrivers();
        }
    }, [drivers, echoReady]);

    const subscribeDrivers = () => {
        const echo = echoRef.current;
        if (!echo) return;

        drivers.forEach(driver => {
            const driverId = Number(driver.id);
            if (!driverId) return;
            if (channelsRef.current[driverId]) return;

            const channelName = `driver-location.${driverId}`;

            try {
                const channel = echo.channel(channelName);
                channel.listen('.location.updated', event => {
                    if (event && event.location) {
                        updateLocation(event.location);
                    }
                });
                channelsRef.current[driverId] = channel;
            } catch (error) {
                console.log('Channel error:', error);
            }
        });
    };

    // ========================================================
    // UPDATE LOCATION (smooth movement)
    // ========================================================

    const updateLocation = (location, isSnapshot = false) => {
        const userId = Number(location.user_id);
        const latitude = Number(location.latitude);
        const longitude = Number(location.longitude);

        if (!userId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return;
        }

        let newCoord = { latitude, longitude };
        const now = Date.now();
        const ex = animationRefs.current[userId];

        // Rapido style: keep the selected van ON the route line
        let segHeading = null;
        if (userId === selectedIdRef.current && routeRef.current.length > 1) {
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
            animationRefs.current[userId] = {
                coordinate: new AnimatedRegion({
                    latitude,
                    longitude,
                    latitudeDelta: 0,
                    longitudeDelta: 0,
                }),
                last: newCoord,
                recvAt: now,
            };
        } else {
            const dist = distanceMeters(ex.last, newCoord);

            if (dist >= MIN_MOVE_M) {
                // animation length = real gap between updates, so the marker
                // glides continuously instead of move-stop-move
                let duration = Math.min(
                    Math.max(now - ex.recvAt, MIN_ANIM_MS),
                    MAX_ANIM_MS
                );
                // big jump after reconnect / resume: don't glide across the city
                const teleport = isSnapshot && dist > 150;

                // heading: phone GPS bearing when moving, else 2-point bearing
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
                    // road direction; flip it if the van is moving the other way
                    rawHeading =
                        angleDiff(segHeading, moveHeading) > 100 && dist > 8
                            ? (segHeading + 180) % 360
                            : segHeading;
                } else {
                    rawHeading = moveHeading;
                }

                const prevHeading = headingRefs.current[userId];
                const nextHeading =
                    prevHeading === undefined
                        ? rawHeading
                        : smoothHeading(prevHeading, rawHeading);
                headingRefs.current[userId] = nextHeading;
                setHeadings(prev => ({ ...prev, [userId]: nextHeading }));

                if (teleport) duration = 1;

                const markerMounted = !!markerRefs.current[userId];

                if (Platform.OS === 'android' && markerMounted) {
                    markerRefs.current[userId].animateMarkerToCoordinate(
                        newCoord,
                        duration
                    );
                } else if (Platform.OS === 'android') {
                    // map is closed: just keep the stored position fresh
                    ex.coordinate.setValue({
                        ...newCoord,
                        latitudeDelta: 0,
                        longitudeDelta: 0,
                    });
                } else {
                    ex.coordinate
                        .timing({ ...newCoord, duration, useNativeDriver: false })
                        .start();
                }

                ex.last = newCoord;
            }
            ex.recvAt = now;
        }

        setDriverLocations(prev => ({
            ...prev,
            [userId]: {
                ...location,
                latitude,
                longitude,
                speed: Number(location.speed || 0),
                accuracy: location.accuracy ? Number(location.accuracy) : null,
            },
        }));
    };

    // ========================================================
    // ROUTE: OWNER -> SELECTED DRIVER
    // ========================================================

    const fetchRoute = async (from, to, driverId) => {
        try {
            const url =
                `https://maps.googleapis.com/maps/api/directions/json` +
                `?origin=${from.latitude},${from.longitude}` +
                `&destination=${to.latitude},${to.longitude}` +
                `&mode=driving&key=${GOOGLE_API_KEY}`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.status !== 'OK' || !data.routes?.length) {
                console.log('Directions error:', data.status, data.error_message);
                return;
            }

            const route = data.routes[0];
            const leg = route.legs[0];
            const coords = decodePolyline(route.overview_polyline.points);

            if (!mountedRef.current) return;

            routeRef.current = coords;
            setRouteCoords(coords);
            setRouteInfo({
                distance: leg.distance.text,
                duration: leg.duration.text,
            });

            // fit camera only once per selected driver (not on every refresh)
            if (
                fitDoneForRef.current !== driverId &&
                coords.length > 1 &&
                mapRef.current
            ) {
                fitDoneForRef.current = driverId;
                mapRef.current.fitToCoordinates(coords, {
                    edgePadding: { top: 160, right: 60, bottom: 320, left: 60 },
                    animated: true,
                });
            }
        } catch (error) {
            console.log('Route fetch error:', error);
        }
    };

    const selectedLocation = selectedDriver
        ? driverLocations[selectedDriver.id]
        : null;

    useEffect(() => {
        if (!mapOpen || !selectedDriver || !ownerLocation || !selectedLocation) {
            return;
        }

        const to = {
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
        };
        const last = lastRouteRef.current;
        const now = Date.now();

        const firstTime = !last.from;
        const ownerMoved = last.from
            ? distanceMeters(last.from, ownerLocation) > 40
            : true;
        const proj = projectOnRoute(to, routeRef.current);
        const offRoute = !proj || proj.dist > OFF_ROUTE_M;
        const waitedEnough = now - last.time > 8000; // throttle API calls

        // route runs van -> owner, so the van travels along the line
        if (firstTime || ((ownerMoved || offRoute) && waitedEnough)) {
            lastRouteRef.current = { from: ownerLocation, to, time: now };
            fetchRoute(to, ownerLocation, selectedDriver.id);
        }
    }, [
        mapOpen,
        selectedDriver,
        ownerLocation,
        selectedLocation?.latitude,
        selectedLocation?.longitude,
    ]);

    const resetRoute = () => {
        routeRef.current = [];
        setRouteCoords([]);
        setRouteInfo(null);
        lastRouteRef.current = { from: null, to: null, time: 0 };
        fitDoneForRef.current = null;
    };

    // ========================================================
    // OPEN / CLOSE MAP
    // ========================================================

    const openMap = driver => {
        const location = driverLocations[driver.id];

        if (!location) {
            Alert.alert('Location', 'Van location not available yet.');
            return;
        }

        // marker will mount fresh: make sure it starts at the latest position
        const anim = animationRefs.current[driver.id];
        if (anim) {
            anim.coordinate.setValue({
                latitude: anim.last.latitude,
                longitude: anim.last.longitude,
                latitudeDelta: 0,
                longitudeDelta: 0,
            });
        }

        resetRoute();
        selectedIdRef.current = Number(driver.id);
        setSelectedDriver(driver);
        setMapOpen(true);
    };

    const closeMap = () => {
        setMapOpen(false);
        setSelectedDriver(null);
        selectedIdRef.current = null;
        resetRoute();
        markerRefs.current = {};
    };

    // ========================================================
    // CLEANUP
    // ========================================================

    const cleanup = () => {
        const echo = echoRef.current;

        if (echo) {
            Object.keys(channelsRef.current).forEach(driverId => {
                try {
                    echo.leave(`driver-location.${driverId}`);
                } catch (error) {
                    console.log(error);
                }
            });
            try {
                echo.disconnect();
            } catch (error) {
                console.log(error);
            }
        }

        if (watchIdRef.current !== null) {
            Geolocation.clearWatch(watchIdRef.current);
        }

        channelsRef.current = {};
        echoRef.current = null;
    };

    // ========================================================
    // DERIVED
    // ========================================================

    const onDutyDrivers = drivers.filter(driver => driver.duty_status === 'on');

    // ========================================================
    // RENDER: MAP VIEW (opens after tapping a van)
    // ========================================================

    if (mapOpen && selectedDriver) {
        const loc = selectedLocation;
        const anim = animationRefs.current[selectedDriver.id];
        const heading = headings[selectedDriver.id] || 0;
        const speedKmh = loc ? (Number(loc.speed) * 3.6).toFixed(1) : '0.0';

        // route ahead of the van only (line starts at the van, like Rapido)
        let visibleRoute = routeCoords;
        if (routeCoords.length > 1 && anim) {
            const proj = projectOnRoute(anim.last, routeCoords);
            if (proj) {
                visibleRoute = [
                    proj.point,
                    ...routeCoords.slice(proj.index + 1),
                ];
            }
        }

        return (
            <View style={styles.container}>
                <StatusBar
                    translucent
                    backgroundColor="transparent"
                    barStyle="dark-content"
                />

                <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    initialRegion={{
                        latitude: loc ? loc.latitude : 13.0827,
                        longitude: loc ? loc.longitude : 80.2707,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                    }}
                    showsUserLocation={false}
                    showsMyLocationButton={false}
                    zoomEnabled
                    rotateEnabled>
                    {/* ROUTE: white border first, dark line on top */}
                    {visibleRoute.length > 1 && (
                        <>
                            <Polyline
                                coordinates={visibleRoute}
                                strokeColor={ROUTE_BORDER_COLOR}
                                strokeWidth={9}
                                lineCap="round"
                                lineJoin="round"
                                zIndex={1}
                            />
                            <Polyline
                                coordinates={visibleRoute}
                                strokeColor={ROUTE_COLOR}
                                strokeWidth={5}
                                lineCap="round"
                                lineJoin="round"
                                zIndex={2}
                            />
                        </>
                    )}

                    {/* YOU */}
                    {ownerLocation && (
                        <Marker
                            coordinate={ownerLocation}
                            anchor={{ x: 0.5, y: 0.5 }}
                            title="You"
                            zIndex={5}
                            tracksViewChanges={false}>
                            <View style={styles.ownerOuter}>
                                <View style={styles.ownerInner} />
                            </View>
                        </Marker>
                    )}

                    {/* SELECTED VAN */}
                    {anim && (
                        <Marker.Animated
                            key={selectedDriver.id}
                            ref={ref =>
                                (markerRefs.current[selectedDriver.id] = ref)
                            }
                            coordinate={anim.coordinate}
                            anchor={{ x: 0.5, y: 0.5 }}
                            flat
                            rotation={(heading + ICON_ROTATION_OFFSET) % 360}
                            tracksViewChanges={trackView}
                            zIndex={10}
                            title={selectedDriver.name}
                            description={`Speed: ${speedKmh} km/h`}>
                            <View style={styles.vanWrap}>
                                {/* wheels */}
                                <View style={[styles.wheel, { left: 2, top: 10 }]} />
                                <View style={[styles.wheel, { right: 2, top: 10 }]} />
                                <View style={[styles.wheel, { left: 2, bottom: 10 }]} />
                                <View style={[styles.wheel, { right: 2, bottom: 10 }]} />

                                {/* body (front = top) */}
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
                <View style={[styles.mapTop, { top: insets.top + 10 }]}>
                    <TouchableOpacity
                        style={styles.backBtn}
                        activeOpacity={0.85}
                        onPress={closeMap}>
                        <Icon name="arrow-left" size={24} color={C.brown} />
                    </TouchableOpacity>

                    <View style={styles.mapTitleBox}>
                        <Text style={styles.mapTitle} numberOfLines={1}>
                            {selectedDriver.name}
                        </Text>
                        <Text style={styles.mapSub}>Live van location</Text>
                    </View>

                    <View
                        style={[
                            styles.liveBadge,
                            { backgroundColor: connected ? C.green : '#DC2626' },
                        ]}>
                        <Text style={styles.liveText}>
                            {connected ? 'LIVE' : 'OFFLINE'}
                        </Text>
                    </View>
                </View>

                {/* BOTTOM CARD */}
                <View
                    style={[
                        styles.mapCard,
                        { paddingBottom: insets.bottom + 16 },
                    ]}>
                    <View style={styles.cardRow}>
                        <View style={styles.vanIconBig}>
                            <Icon name="bus-school" size={28} color={C.brown} />
                        </View>

                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.cardName} numberOfLines={1}>
                                {selectedDriver.name}
                            </Text>
                            <Text style={styles.cardStatus}>
                                ● ON DUTY{'  •  '}
                                {speedKmh} km/h
                            </Text>
                        </View>
                    </View>

                    {routeInfo ? (
                        <View style={styles.etaBox}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.etaMain}>{routeInfo.duration}</Text>
                                <Text style={styles.etaSub}>
                                    {routeInfo.distance} away from you
                                </Text>
                            </View>
                            <Icon name="map-marker-distance" size={26} color={C.yellowDeep} />
                        </View>
                    ) : null}

                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={closeMap}
                        style={{ marginTop: 12 }}>
                        <LinearGradient
                            colors={[C.yellow, C.yellowDeep]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.backListBtn}>
                            <Icon name="format-list-bulleted" size={20} color={C.brown} />
                            <Text style={styles.backListText}>Back to Vans</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // ========================================================
    // RENDER: VAN LIST (first screen)
    // ========================================================

    return (
        <View style={styles.container}>
            <StatusBar
                translucent
                backgroundColor="transparent"
                barStyle="dark-content"
            />

            {/* HEADER */}
            <LinearGradient
                colors={[C.yellow, C.yellowSoft]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.listHeader, { paddingTop: insets.top + 16 }]}>
                <View style={styles.hCircle1} />
                <View style={styles.hCircle2} />

                <View style={styles.headerRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>Live Tracking</Text>
                        <Text style={styles.headerSub}>
                            {onDutyDrivers.length} {onDutyDrivers.length === 1 ? 'van' : 'vans'} ON DUTY
                        </Text>
                    </View>

                    <View
                        style={[
                            styles.liveBadge,
                            { backgroundColor: connected ? C.green : '#DC2626' },
                        ]}>
                        <Text style={styles.liveText}>
                            {connected ? 'LIVE' : 'OFFLINE'}
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            {/* LIST */}
            <ScrollView
                style={{ marginTop: -26 }}
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingBottom: insets.bottom + 24,
                }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[C.yellowDeep]}
                        tintColor={C.yellowDeep}
                    />
                }>
                <Text style={styles.sectionTitle}>On Duty Vans</Text>

                {loading ? (
                    <View style={styles.loading}>
                        <ActivityIndicator size="small" color={C.yellowDeep} />
                        <Text style={styles.loadingText}>Loading vans...</Text>
                    </View>
                ) : (
                    onDutyDrivers.map(driver => {
                        const location = driverLocations[driver.id];
                        const speed = location
                            ? (Number(location.speed) * 3.6).toFixed(1)
                            : '0.0';
                        const vehicle = driver.vehicle_number || driver.vehicle_no;

                        return (
                            <TouchableOpacity
                                key={driver.id}
                                activeOpacity={0.85}
                                style={styles.vanCard}
                                onPress={() => openMap(driver)}>
                                <View style={styles.vanIcon}>
                                    <Icon name="bus-school" size={28} color={C.brown} />
                                </View>

                                <View style={styles.vanInfo}>
                                    <Text style={styles.vanName} numberOfLines={1}>
                                        {driver.name}
                                    </Text>

                                    {vehicle ? (
                                        <Text style={styles.vanVehicle} numberOfLines={1}>
                                            {vehicle}
                                        </Text>
                                    ) : null}

                                    <Text style={styles.vanStatus}>
                                        ● ON DUTY{'  •  '}
                                        {location ? `${speed} km/h` : 'Waiting for location'}
                                    </Text>
                                </View>

                                <View style={styles.trackBtn}>
                                    <Icon name="map-marker-radius" size={18} color={C.yellow} />
                                    <Text style={styles.trackText}>Track</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}

                {!loading && onDutyDrivers.length === 0 && (
                    <View style={styles.empty}>
                        <View style={styles.emptyIcon}>
                            <Icon name="bus-clock" size={38} color={C.yellowDeep} />
                        </View>
                        <Text style={styles.emptyTitle}>No vans ON DUTY</Text>
                        <Text style={styles.emptyText}>
                            Vans will appear here when drivers start their trip.
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.sandal },
    map: { flex: 1 },

    // ---------- LIST HEADER ----------
    listHeader: {
        paddingHorizontal: 18,
        paddingBottom: 46,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        overflow: 'hidden',
    },
    hCircle1: {
        position: 'absolute',
        top: -30,
        right: -20,
        width: 130,
        height: 130,
        borderRadius: 65,
        backgroundColor: 'rgba(255,255,255,0.25)',
    },
    hCircle2: {
        position: 'absolute',
        bottom: -34,
        left: -24,
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.18)',
    },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    headerTitle: { fontSize: 26, fontWeight: '900', color: C.brown },
    headerSub: { marginTop: 3, fontSize: 13, fontWeight: '600', color: C.brownSoft },

    liveBadge: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
    },
    liveText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

    sectionTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: C.brown,
        marginTop: 38,
        marginBottom: 12,
    },

    // ---------- VAN CARD ----------
    vanCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 14,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.border,
        elevation: 3,
        shadowColor: '#9A6A00',
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
    },
    vanIcon: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: '#FFE89A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    vanInfo: { flex: 1, marginLeft: 12 },
    vanName: { fontSize: 16, fontWeight: '800', color: C.brown },
    vanVehicle: { marginTop: 2, fontSize: 12, color: C.muted },
    vanStatus: { marginTop: 4, fontSize: 12, fontWeight: '600', color: C.green },

    trackBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.brown,
        paddingHorizontal: 12,
        height: 36,
        borderRadius: 12,
    },
    trackText: { marginLeft: 5, color: C.yellow, fontSize: 13, fontWeight: '800' },

    loading: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20 },
    loadingText: { marginLeft: 10, color: C.muted },

    empty: { alignItems: 'center', paddingVertical: 40 },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FFE89A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyTitle: { marginTop: 14, fontSize: 17, fontWeight: '800', color: C.brown },
    emptyText: {
        marginTop: 4,
        fontSize: 13,
        color: C.muted,
        textAlign: 'center',
        paddingHorizontal: 30,
    },

    // ---------- MAP VIEW ----------
    mapTop: {
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
        shadowOffset: { width: 0, height: 3 },
    },
    mapTitleBox: {
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
        shadowOffset: { width: 0, height: 3 },
    },
    mapTitle: { fontSize: 16, fontWeight: '800', color: C.brown },
    mapSub: { fontSize: 11.5, color: C.muted, marginTop: 1 },

    mapCard: {
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
        shadowOffset: { width: 0, height: -3 },
    },
    cardRow: { flexDirection: 'row', alignItems: 'center' },
    vanIconBig: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: C.yellow,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardName: { fontSize: 17, fontWeight: '800', color: C.brown },
    cardStatus: { marginTop: 3, fontSize: 12.5, fontWeight: '600', color: C.green },

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
    etaMain: { fontSize: 20, fontWeight: '900', color: C.brown },
    etaSub: { marginTop: 2, fontSize: 12, color: C.muted },

    backListBtn: {
        height: 50,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    backListText: { marginLeft: 8, fontSize: 16, fontWeight: '800', color: C.brown },

    // ---------- MARKERS ----------
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
        shadowOffset: { width: 0, height: 2 },
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
    vanRoofLine: {
        width: 2,
        height: 18,
        backgroundColor: '#E0A800',
    },
    vanRearWindow: {
        width: 18,
        height: 5,
        marginTop: 4,
        borderRadius: 2,
        backgroundColor: C.brown,
        opacity: 0.7,
    },

    ownerOuter: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(26,115,232,0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    ownerInner: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#1A73E8',
        borderWidth: 2,
        borderColor: '#fff',
    },
});

export default OwnerLiveTracking;