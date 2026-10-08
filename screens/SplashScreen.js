import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  Animated,
  Easing,
  StyleSheet,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ------------------------------------------------------------
// THEME  (Yellow + Sandal)
// ------------------------------------------------------------

const C = {
  sandal: '#F6E7C8', // sandalwood cream (main background)
  sandalLight: '#FFF6E0',
  sandalDark: '#E8D3A6',
  yellow: '#FFC400', // school-bus yellow
  yellowDeep: '#F29D00',
  brown: '#4A3200', // dark text
  brownSoft: '#7A5A1E',
  road: '#5B4A2B',
};

const LOGO = 150;

export default function SplashScreen({navigation}) {
  const {width, height} = useWindowDimensions();

  const logoFade = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const textFade = useRef(new Animated.Value(0)).current;
  const textSlide = useRef(new Animated.Value(24)).current;
  const busX = useRef(new Animated.Value(-120)).current;
  const footer = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // ---------------------------------------------------------
    // SPLASH ANIMATION
    // ---------------------------------------------------------

    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoFade, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }),
      ]),

      Animated.parallel([
        Animated.timing(textFade, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(textSlide, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(busX, {
          toValue: width + 120,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),

      Animated.timing(footer, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Loading dots
    const pulse = (val, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0.3,
            duration: 350,
            useNativeDriver: true,
          }),
        ]),
      );

    const dots = Animated.parallel([
      pulse(dot1, 0),
      pulse(dot2, 150),
      pulse(dot3, 300),
    ]);
    dots.start();

    // ---------------------------------------------------------
    // CHECK LOGIN  (logic unchanged)
    // ---------------------------------------------------------

    const checkLogin = async () => {
      try {
        // Small delay so splash is visible
        await new Promise(resolve => setTimeout(resolve, 2400));

        const authToken = await AsyncStorage.getItem('authToken');
        const userData = await AsyncStorage.getItem('userData');

        console.log('SPLASH AUTH TOKEN:', authToken);
        console.log('SPLASH USER DATA:', userData);

        // NO LOGIN
        if (!authToken || authToken !== 'session-active' || !userData) {
          console.log('NO ACTIVE LOGIN → Login');
          navigation.replace('Login');
          return;
        }

        // PARSE USER
        let user;

        try {
          user = JSON.parse(userData);
        } catch (error) {
          console.log('USER DATA PARSE ERROR:', error);

          await AsyncStorage.multiRemove([
            'authToken',
            'userData',
            'userId',
            'user_id',
            'isDriverLoggedIn',
            'isOwnerLoggedIn',
          ]);

          navigation.replace('Login');
          return;
        }

        console.log('SPLASH USER:', user);
        console.log('SPLASH ROLE:', user?.role);

        // OWNER
        if (user?.role === 'owner') {
          console.log('ACTIVE OWNER → OwnerLiveTracking');
          navigation.replace('OwnerLiveTracking');
          return;
        }

        // DRIVER
        if (user?.role === 'driver') {
          console.log('ACTIVE DRIVER → Home');
          navigation.replace('Home');
          return;
        }

         if (user?.role === 'parent') {
          console.log('ACTIVE Parent → Home');
          navigation.replace('ParentsHome');
          return;
        }

        // UNKNOWN ROLE
        console.log('UNKNOWN ROLE → CLEAR SESSION');

        await AsyncStorage.multiRemove([
          'authToken',
          'userData',
          'userId',
          'user_id',
          'isDriverLoggedIn',
          'isOwnerLoggedIn',
        ]);

        navigation.replace('Login');
      } catch (error) {
        console.log('SPLASH LOGIN CHECK ERROR:', error);
        navigation.replace('Login');
      }
    };

    checkLogin();

    return () => {
      dots.stop();
    };
  }, [
    logoFade,
    logoScale,
    textFade,
    textSlide,
    busX,
    footer,
    dot1,
    dot2,
    dot3,
    width,
    navigation,
  ]);

  // -----------------------------------------------------------
  // UI
  // -----------------------------------------------------------

  const topShape = height * 0.4;

  return (
    <View style={styles.root}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />

      {/* SANDAL BACKGROUND */}

      <LinearGradient
        colors={[C.sandalLight, C.sandal, C.sandalDark]}
        start={{x: 0.5, y: 0}}
        end={{x: 0.5, y: 1}}
        style={StyleSheet.absoluteFill}
      />

      {/* YELLOW TOP CURVE */}

      <View
        style={[
          styles.topShape,
          {
            height: topShape,
            width: width * 1.6,
            left: -width * 0.3,
            top: -topShape * 0.35,
            borderRadius: width,
          },
        ]}
      />

      <View
        style={[
          styles.topShapeLight,
          {
            height: topShape * 0.8,
            width: width * 1.4,
            left: -width * 0.2,
            top: -topShape * 0.42,
            borderRadius: width,
          },
        ]}
      />

      {/* DECOR CIRCLES */}

      <View style={[styles.deco, {top: height * 0.12, right: -30, width: 110, height: 110}]} />
      <View style={[styles.deco, {top: height * 0.26, left: -24, width: 70, height: 70}]} />

      {/* CENTER CONTENT */}

      <View style={styles.center}>
        <Animated.View
          style={{
            opacity: logoFade,
            transform: [{scale: logoScale}],
          }}>
          <View style={styles.logoOuter}>
            <View style={styles.logoInner}>
              <Icon name="bus-school" size={78} color={C.brown} />
            </View>
          </View>
        </Animated.View>

        <Animated.View
          style={{
            alignItems: 'center',
            opacity: textFade,
            transform: [{translateY: textSlide}],
          }}>
          <Text style={styles.name}>SUNRISE</Text>

          <View style={styles.pill}>
            <Text style={styles.pillText}>SCHOOL VAN</Text>
          </View>

          <Text style={styles.app}>Student Transport Tracker</Text>

          <View style={styles.taglineRow}>
            <View style={styles.line} />
            <Text style={styles.tagline}>Safe Journey • Happy Kids</Text>
            <View style={styles.line} />
          </View>

          {/* LOADING DOTS */}

          <View style={styles.dotsRow}>
            <Animated.View style={[styles.dot, {opacity: dot1}]} />
            <Animated.View style={[styles.dot, {opacity: dot2}]} />
            <Animated.View style={[styles.dot, {opacity: dot3}]} />
          </View>
        </Animated.View>
      </View>

      {/* ROAD + MOVING BUS */}

      <View style={styles.roadWrap}>
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 16,
            transform: [{translateX: busX}],
          }}>
          <Icon name="bus-side" size={64} color={C.yellowDeep} />
        </Animated.View>

        <View style={styles.road}>
          <View style={styles.roadDashRow}>
            {Array.from({length: 14}).map((_, i) => (
              <View key={i} style={styles.roadDash} />
            ))}
          </View>
        </View>
      </View>

      {/* FOOTER */}

      <Animated.View style={[styles.footer, {opacity: footer}]}>
        <Text style={styles.version}>Driver App • v1.0.0</Text>
      </Animated.View>
    </View>
  );
}

// =============================================================
// STYLES
// =============================================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.sandal,
  },

  topShape: {
    position: 'absolute',
    backgroundColor: C.yellow,
  },

  topShapeLight: {
    position: 'absolute',
    backgroundColor: '#FFD94D',
    opacity: 0.55,
  },

  deco: {
    position: 'absolute',
    borderRadius: 100,
    backgroundColor: '#FFFFFF',
    opacity: 0.22,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },

  logoOuter: {
    width: LOGO + 22,
    height: LOGO + 22,
    borderRadius: (LOGO + 22) / 2,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    shadowColor: '#B77A00',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: {width: 0, height: 8},
  },

  logoInner: {
    width: LOGO,
    height: LOGO,
    borderRadius: LOGO / 2,
    backgroundColor: C.yellow,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  name: {
    marginTop: 22,
    fontSize: 38,
    fontWeight: '900',
    color: C.brown,
    letterSpacing: 3,
  },

  pill: {
    marginTop: 8,
    backgroundColor: C.brown,
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 20,
  },

  pillText: {
    color: C.yellow,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 4,
  },

  app: {
    marginTop: 12,
    fontSize: 16,
    color: C.brownSoft,
    letterSpacing: 1,
    fontWeight: '600',
  },

  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },

  tagline: {
    fontSize: 13.5,
    color: C.brown,
    marginHorizontal: 10,
  },

  line: {
    width: 30,
    height: 2,
    backgroundColor: C.yellowDeep,
    borderRadius: 1,
  },

  dotsRow: {
    flexDirection: 'row',
    marginTop: 26,
  },

  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: C.yellowDeep,
    marginHorizontal: 4,
  },

  roadWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 64,
    height: 80,
    justifyContent: 'flex-end',
  },

  road: {
    height: 16,
    backgroundColor: C.road,
    justifyContent: 'center',
  },

  roadDashRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },

  roadDash: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FFE9A8',
  },

  footer: {
    position: 'absolute',
    bottom: 26,
    width: '100%',
    alignItems: 'center',
  },

  version: {
    fontSize: 13,
    color: C.brownSoft,
    letterSpacing: 0.5,
  },
});