import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  Animated,
  StyleSheet,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SIZE = 200;

export default function SplashScreen({navigation}) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const footer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // ---------------------------------------------------------
    // SPLASH ANIMATION
    // ---------------------------------------------------------

    Animated.sequence([
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),

        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }),
      ]),

      Animated.timing(footer, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // ---------------------------------------------------------
    // CHECK LOGIN
    // ---------------------------------------------------------

    const checkLogin = async () => {
      try {
        // Small delay so splash is visible
        await new Promise(resolve =>
          setTimeout(resolve, 1800),
        );

        // -----------------------------------------------------
        // GET SAVED SESSION
        // -----------------------------------------------------

        const authToken =
          await AsyncStorage.getItem('authToken');

        const userData =
          await AsyncStorage.getItem('userData');

        console.log(
          'SPLASH AUTH TOKEN:',
          authToken,
        );

        console.log(
          'SPLASH USER DATA:',
          userData,
        );

        // -----------------------------------------------------
        // NO LOGIN
        // -----------------------------------------------------

        if (
          !authToken ||
          authToken !== 'session-active' ||
          !userData
        ) {
          console.log(
            'NO ACTIVE LOGIN → Login',
          );

          navigation.replace('Login');

          return;
        }

        // -----------------------------------------------------
        // PARSE USER
        // -----------------------------------------------------

        let user;

        try {
          user = JSON.parse(userData);
        } catch (error) {
          console.log(
            'USER DATA PARSE ERROR:',
            error,
          );

          // Clear invalid session
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

        console.log(
          'SPLASH USER:',
          user,
        );

        console.log(
          'SPLASH ROLE:',
          user?.role,
        );

        // -----------------------------------------------------
        // OWNER
        // -----------------------------------------------------

        if (user?.role === 'owner') {
          console.log(
            'ACTIVE OWNER → OwnerLiveTracking',
          );

          navigation.replace(
            'OwnerLiveTracking',
          );

          return;
        }

        // -----------------------------------------------------
        // DRIVER
        // -----------------------------------------------------

        if (user?.role === 'driver') {
          console.log(
            'ACTIVE DRIVER → Home',
          );

          navigation.replace('Home');

          return;
        }

        // -----------------------------------------------------
        // UNKNOWN ROLE
        // -----------------------------------------------------

        console.log(
          'UNKNOWN ROLE → CLEAR SESSION',
        );

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
        console.log(
          'SPLASH LOGIN CHECK ERROR:',
          error,
        );

        // If session check fails,
        // send user to Login
        navigation.replace('Login');
      }
    };

    checkLogin();

    // ---------------------------------------------------------
    // CLEANUP
    // ---------------------------------------------------------

    return () => {
      // Nothing required here because
      // checkLogin handles its own navigation.
    };
  }, [fade, scale, footer, navigation]);

  // -----------------------------------------------------------
  // UI
  // -----------------------------------------------------------

  return (
    <ImageBackground
      source={require('../assets/splash_bg.png')}
      style={styles.bg}
      resizeMode="cover">

      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      <View style={styles.center}>

        <Animated.View
          style={[
            styles.content,
            {
              opacity: fade,
              transform: [{scale}],
            },
          ]}>

          {/* KRISHNA IMAGE */}

          <View style={styles.ring}>
            <Image
              source={require('../assets/krishna.png')}
              style={styles.krishna}
            />
          </View>

          {/* NAME */}

          <Text style={styles.name}>
            KRISHNA
          </Text>

          <Text style={styles.enterprises}>
            ENTERPRISES
          </Text>

          <Text style={styles.app}>
            Milk Distribution App
          </Text>

          <View style={styles.taglineRow}>

            <Text style={styles.tagline}>
              Fresh Milk... Healthy Life...
            </Text>

            <View style={styles.line} />

          </View>

        </Animated.View>
      </View>

      {/* FOOTER */}

      <Animated.View
        style={[
          styles.footer,
          {
            opacity: footer,
          },
        ]}>

        <Text style={styles.version}>
          Driver App • v1.0.0
        </Text>

      </Animated.View>

    </ImageBackground>
  );
}

// =============================================================
// STYLES
// =============================================================

const styles = StyleSheet.create({

  bg: {
    flex: 1,
    backgroundColor: '#2A86E0',
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    alignItems: 'center',
  },

  ring: {
    width: SIZE + 12,
    height: SIZE + 12,
    borderRadius: (SIZE + 12) / 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#2E7D32',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 6,
    },
  },

  krishna: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
  },

  name: {
    fontSize: 36,
    fontWeight: '900',
    color: '#0B2A7A',
    letterSpacing: 1.5,
    marginTop: 16,
  },

  enterprises: {
    fontSize: 23,
    fontWeight: '800',
    color: '#0E8A3E',
    letterSpacing: 3,
    marginTop: -2,
  },

  app: {
    fontSize: 17,
    color: '#1F2F5C',
    letterSpacing: 1,
    marginTop: 6,
  },

  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },

  tagline: {
    fontSize: 14,
    color: '#111827',
  },

  line: {
    width: 40,
    height: 2,
    backgroundColor: '#0E8A3E',
    marginLeft: 8,
  },

  footer: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    alignItems: 'center',
  },

  version: {
    fontSize: 14,
    color: '#1F5F2A',
  },

});
 
