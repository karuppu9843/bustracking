import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';

import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ------------------------------------------------------------
// THEME  (Yellow + Sandal)
// ------------------------------------------------------------

const C = {
  sandal: '#F6E7C8',
  sandalLight: '#FFF6E0',
  sandalDark: '#E8D3A6',
  yellow: '#FFC400',
  yellowDeep: '#F29D00',
  brown: '#4A3200',
  brownSoft: '#7A5A1E',
  inputBg: '#FFFAEC',
  inputBorder: '#EBD9AE',
};

export default function DriverLoginScreen({navigation}) {
  const insets = useSafeAreaInsets();
  const {height, width} = useWindowDimensions();

  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const validateMobile = value => {
    return /^[6-9]\d{9}$/.test(value);
  };

  const handleLogin = async () => {
    setLoginError('');

    const phone = mobile.trim();

    // ============================================================
    // MOBILE VALIDATION
    // ============================================================

    if (!phone) {
      setLoginError('Phone number is required');
      return;
    }

    if (!validateMobile(phone)) {
      setLoginError('Enter a valid 10-digit phone number');
      return;
    }

    // ============================================================
    // PASSWORD VALIDATION
    // ============================================================

    if (!password) {
      Alert.alert('Required', 'Please enter your password');
      return;
    }

    setLoading(true);

    try {
      // ==========================================================
      // LOGIN API
      // ==========================================================

      const response = await fetch(
        'https://blackpathsoftwaresolutions.com/api/driver/login',
        {
          method: 'POST',

          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            login: phone,
            password: password,
          }),
        },
      );

      const data = await response.json();

      console.log('LOGIN RESPONSE:', data);

      // ==========================================================
      // LOGIN FAILED
      // ==========================================================

      if (data.status !== 'success') {
        Alert.alert('Login Failed', data.message || 'Invalid login details');

        return;
      }

      // ==========================================================
      // USER DATA
      // ==========================================================

      const user = data.user;

      if (!user) {
        Alert.alert(
          'Login Failed',
          'User information not received from server.',
        );

        return;
      }

      console.log('LOGIN USER:', user);
      console.log('USER ROLE:', user.role);

      // ==========================================================
      // ALLOW DRIVER + OWNER ONLY
      // ==========================================================

      if (user.role !== 'driver' && user.role !== 'owner' && user.role !== 'parent') {
        Alert.alert(
          'Access Denied',
          'This account does not have permission to use this app.',
        );

        return;
      }

      // ==========================================================
      // SAVE COMPLETE USER DATA
      // ==========================================================

      await AsyncStorage.setItem('userData', JSON.stringify(user));

      // ==========================================================
      // SAVE USER ID
      // ==========================================================

      if (user.id !== undefined && user.id !== null) {
        await AsyncStorage.setItem('userId', String(user.id));

        await AsyncStorage.setItem('user_id', String(user.id));
      }

      // ==========================================================
      // SESSION
      // ==========================================================

      await AsyncStorage.setItem('authToken', 'session-active');

      // ==========================================================
      // ROLE FLAGS
      // ==========================================================

      if (user.role === 'driver') {
        await AsyncStorage.setItem('isDriverLoggedIn', 'true');

        await AsyncStorage.removeItem('isOwnerLoggedIn');
      } else if (user.role === 'owner') {
        await AsyncStorage.setItem('isOwnerLoggedIn', 'true');

        await AsyncStorage.removeItem('isDriverLoggedIn');
      }

      // ==========================================================
      // REMEMBER MOBILE
      // ==========================================================

      if (remember) {
        await AsyncStorage.setItem('driverMobile', phone);
      } else {
        await AsyncStorage.removeItem('driverMobile');
      }

      // ==========================================================
      // ROLE BASED NAVIGATION
      // ==========================================================

      if (user.role === 'owner') {
        console.log('OWNER LOGIN → OwnerLiveTracking');

        navigation.replace('OwnerLiveTracking');
      }else if (user.role === 'parent') {

  await AsyncStorage.setItem(
    'parent_id',
    String(user.id)
  );

  navigation.replace('ParentsHome');
} else if (user.role === 'driver') {
        console.log('DRIVER LOGIN → Home');

        navigation.replace('Home');
      }
    } catch (error) {
      console.log('LOGIN ERROR:', error);

      Alert.alert(
        'Connection Error',
        'Server connection failed. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const topShape = height * 0.42;

  return (
    <View style={styles.bg}>
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
            top: -topShape * 0.3,
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
            top: -topShape * 0.38,
            borderRadius: width,
          },
        ]}
      />

      <View style={[styles.deco, {top: height * 0.07, right: -28, width: 100, height: 100}]} />
      <View style={[styles.deco, {top: height * 0.2, left: -20, width: 64, height: 64}]} />

      {/* HEADER (logo + name) */}

      <View style={[styles.header, {top: insets.top + height * 0.05}]}>
        <View style={styles.logoOuter}>
          <View style={styles.logoInner}>
            <MaterialIcon name="bus-school" size={46} color={C.brown} />
          </View>
        </View>

        <Text style={styles.brand}>SUNRISE</Text>

        <View style={styles.pill}>
          <Text style={styles.pillText}>SCHOOL VAN</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: height * 0.34,
            paddingBottom: insets.bottom + 20,
            paddingHorizontal: 20,
          }}>
          <View style={styles.card}>
            {/* TITLE */}

            <Text style={styles.title}>Driver Login</Text>

            <Text style={styles.subtitle}>Login to start your trip</Text>

            {/* MOBILE INPUT */}

            <View style={styles.inputBox}>
              <Icon name="phone-portrait-outline" size={22} color={C.brownSoft} />

              <TextInput
                style={styles.input}
                placeholder="Mobile Number"
                placeholderTextColor="#9A8660"
                keyboardType="phone-pad"
                maxLength={10}
                value={mobile}
                editable={!loading}
                onChangeText={text => {
                  const cleaned = text.replace(/[^0-9]/g, '');

                  setMobile(cleaned);
                  setLoginError('');
                }}
              />
            </View>

            <Text style={styles.helper}>
              Enter your registered mobile number
            </Text>

            {/* PASSWORD INPUT */}

            <View style={[styles.inputBox, {marginTop: 14}]}>
              <Icon name="lock-closed-outline" size={22} color={C.brownSoft} />

              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#9A8660"
                secureTextEntry={!showPassword}
                value={password}
                editable={!loading}
                onChangeText={text => {
                  setPassword(text);
                  setLoginError('');
                }}
              />

              <TouchableOpacity
                disabled={loading}
                onPress={() => setShowPassword(value => !value)}>
                <Icon
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={C.brownSoft}
                />
              </TouchableOpacity>
            </View>

            {/* LOGIN ERROR */}

            {loginError ? (
              <Text style={styles.errorText}>{loginError}</Text>
            ) : null}

            {/* REMEMBER + FORGOT */}

            <View style={styles.row}>
              <TouchableOpacity
                style={styles.rememberRow}
                activeOpacity={0.8}
                disabled={loading}
                onPress={() => setRemember(value => !value)}>
                <View
                  style={[styles.checkbox, !remember && styles.checkboxOff]}>
                  {remember && (
                    <Icon name="checkmark" size={16} color={C.brown} />
                  )}
                </View>

                <Text style={styles.rememberText}>Remember Me</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={loading}
                onPress={() => navigation?.navigate('ForgotPassword')}>
                <Text style={styles.forgot}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* LOGIN BUTTON */}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleLogin}
              disabled={loading}>
              <LinearGradient
                colors={[C.yellow, C.yellowDeep]}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={[styles.loginBtn, loading && styles.loginBtnDisabled]}>
                {loading ? (
                  <ActivityIndicator size="small" color={C.brown} />
                ) : (
                  <>
                    <Text style={styles.loginText}>LOGIN</Text>

                    <Icon
                      name="arrow-forward"
                      size={22}
                      color={C.brown}
                      style={{marginLeft: 10}}
                    />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* HELP BUTTON */}

            <TouchableOpacity
              style={styles.helpBtn}
              activeOpacity={0.8}
              disabled={loading}>
              <MaterialIcon name="headset" size={24} color={C.brown} />

              <Text style={styles.helpText}>Need Help? Contact School Admin</Text>
            </TouchableOpacity>
          </View>

          {/* FOOTER NOTE */}

          <View style={styles.safeRow}>
            <MaterialIcon name="shield-check" size={18} color={C.brownSoft} />
            <Text style={styles.safeText}>Safe Journey • Happy Kids</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
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

  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },

  logoOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#B77A00',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 6},
  },

  logoInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.yellow,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  brand: {
    marginTop: 10,
    fontSize: 26,
    fontWeight: '900',
    color: C.brown,
    letterSpacing: 3,
  },

  pill: {
    marginTop: 6,
    backgroundColor: C.brown,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 16,
  },

  pillText: {
    color: C.yellow,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 3,
  },

  card: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    elevation: 10,
    shadowColor: '#9A6A00',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 8,
    },
  },

  title: {
    fontSize: 26,
    fontWeight: '800',
    color: C.brown,
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 15,
    color: C.brownSoft,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 16,
  },

  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.inputBorder,
    backgroundColor: C.inputBg,
    paddingHorizontal: 14,
  },

  input: {
    flex: 1,
    fontSize: 16,
    color: C.brown,
    marginLeft: 12,
    paddingVertical: 0,
  },

  helper: {
    fontSize: 12,
    color: C.brownSoft,
    marginTop: 5,
    marginLeft: 4,
  },

  errorText: {
    color: '#DC2626',
    fontSize: 13,
    marginTop: 7,
    marginLeft: 4,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 16,
  },

  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: C.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkboxOff: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: C.inputBorder,
  },

  rememberText: {
    fontSize: 15,
    color: C.brown,
    marginLeft: 10,
  },

  forgot: {
    fontSize: 15,
    fontWeight: '700',
    color: C.yellowDeep,
  },

  loginBtn: {
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: C.yellowDeep,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 5,
    },
  },

  loginBtnDisabled: {
    opacity: 0.75,
  },

  loginText: {
    color: C.brown,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 1,
  },

  helpBtn: {
    marginTop: 12,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#FFF1CC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  helpText: {
    fontSize: 15,
    color: C.brown,
    marginLeft: 12,
    fontWeight: '600',
  },

  safeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },

  safeText: {
    fontSize: 13,
    color: C.brownSoft,
    marginLeft: 6,
  },
});