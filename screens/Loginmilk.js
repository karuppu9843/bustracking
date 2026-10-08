 

import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ImageBackground,
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

export default function DriverLoginScreen({navigation}) {
  const insets = useSafeAreaInsets();
  const {height} = useWindowDimensions();

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
      Alert.alert(
        'Login Failed',
        data.message || 'Invalid login details',
      );

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

    if (
      user.role !== 'driver' &&
      user.role !== 'owner'
    ) {
      Alert.alert(
        'Access Denied',
        'This account does not have permission to use this app.',
      );

      return;
    }

    // ==========================================================
    // SAVE COMPLETE USER DATA
    // ==========================================================

    await AsyncStorage.setItem(
      'userData',
      JSON.stringify(user),
    );

    // ==========================================================
    // SAVE USER ID
    // ==========================================================

    if (
      user.id !== undefined &&
      user.id !== null
    ) {
      await AsyncStorage.setItem(
        'userId',
        String(user.id),
      );

      await AsyncStorage.setItem(
        'user_id',
        String(user.id),
      );
    }

    // ==========================================================
    // SESSION
    // ==========================================================

    await AsyncStorage.setItem(
      'authToken',
      'session-active',
    );

    // ==========================================================
    // ROLE FLAGS
    // ==========================================================

    if (user.role === 'driver') {

      await AsyncStorage.setItem(
        'isDriverLoggedIn',
        'true',
      );

      await AsyncStorage.removeItem(
        'isOwnerLoggedIn',
      );

    } else if (user.role === 'owner') {

      await AsyncStorage.setItem(
        'isOwnerLoggedIn',
        'true',
      );

      await AsyncStorage.removeItem(
        'isDriverLoggedIn',
      );

    }

    // ==========================================================
    // REMEMBER MOBILE
    // ==========================================================

    if (remember) {
      await AsyncStorage.setItem(
        'driverMobile',
        phone,
      );
    } else {
      await AsyncStorage.removeItem(
        'driverMobile',
      );
    }

    // ==========================================================
    // ROLE BASED NAVIGATION
    // ==========================================================

    if (user.role === 'owner') {

      console.log(
        'OWNER LOGIN → OwnerLiveTracking',
      );

      navigation.replace(
        'OwnerLiveTracking',
      );

    } else if (user.role === 'driver') {

      console.log(
        'DRIVER LOGIN → Home',
      );

      navigation.replace(
        'Home',
      );

    }

  } catch (error) {

    console.log(
      'LOGIN ERROR:',
      error,
    );

    Alert.alert(
      'Connection Error',
      'Server connection failed. Please try again.',
    );

  } finally {

    setLoading(false);

  }
};
 


  return (
    <ImageBackground
      source={require('../assets/login_bg.png')}
      style={styles.bg}
      resizeMode="cover">

      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: height * 0.47,
            paddingBottom: insets.bottom + 20,
            paddingHorizontal: 20,
          }}>

          <View style={styles.card}>

            {/* TITLE */}

            <Text style={styles.title}>
              Driver Login
            </Text>

            <Text style={styles.subtitle}>
              Login to start your delivery
            </Text>

            {/* MOBILE INPUT */}

            <View style={styles.inputBox}>

              <Icon
                name="phone-portrait-outline"
                size={24}
                color="#444"
              />

              <TextInput
                style={styles.input}
                placeholder="Mobile Number"
                placeholderTextColor="#6B7280"
                keyboardType="phone-pad"
                maxLength={10}
                value={mobile}
                editable={!loading}
                onChangeText={text => {
                  const cleaned =
                    text.replace(/[^0-9]/g, '');

                  setMobile(cleaned);
                  setLoginError('');
                }}
              />

            </View>

            <Text style={styles.helper}>
              Enter your registered mobile number
            </Text>

            {/* PASSWORD INPUT */}

            <View
              style={[
                styles.inputBox,
                {marginTop: 14},
              ]}>

              <Icon
                name="lock-closed-outline"
                size={24}
                color="#444"
              />

              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#6B7280"
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
                onPress={() =>
                  setShowPassword(value => !value)
                }>

                <Icon
                  name={
                    showPassword
                      ? 'eye-off-outline'
                      : 'eye-outline'
                  }
                  size={24}
                  color="#444"
                />

              </TouchableOpacity>

            </View>

            {/* LOGIN ERROR */}

            {loginError ? (
              <Text style={styles.errorText}>
                {loginError}
              </Text>
            ) : null}

            {/* REMEMBER + FORGOT */}

            <View style={styles.row}>

              <TouchableOpacity
                style={styles.rememberRow}
                activeOpacity={0.8}
                disabled={loading}
                onPress={() =>
                  setRemember(value => !value)
                }>

                <View
                  style={[
                    styles.checkbox,
                    !remember &&
                      styles.checkboxOff,
                  ]}>

                  {remember && (
                    <Icon
                      name="checkmark"
                      size={16}
                      color="#fff"
                    />
                  )}

                </View>

                <Text style={styles.rememberText}>
                  Remember Me
                </Text>

              </TouchableOpacity>

              <TouchableOpacity
                disabled={loading}
                onPress={() =>
                  navigation?.navigate(
                    'ForgotPassword',
                  )
                }>

                <Text style={styles.forgot}>
                  Forgot Password?
                </Text>

              </TouchableOpacity>

            </View>

            {/* LOGIN BUTTON */}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleLogin}
              disabled={loading}>

              <LinearGradient
                colors={[
                  '#1E7BEF',
                  '#0A57D0',
                ]}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={[
                  styles.loginBtn,
                  loading &&
                    styles.loginBtnDisabled,
                ]}>

                {loading ? (
                  <ActivityIndicator
                    size="small"
                    color="#fff"
                  />
                ) : (
                  <>
                    <Text style={styles.loginText}>
                      LOGIN
                    </Text>

                    <Icon
                      name="arrow-forward"
                      size={22}
                      color="#fff"
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

              <MaterialIcon
                name="headset"
                size={26}
                color="#0A57D0"
              />

              <Text style={styles.helpText}>
                Need Help? Contact Admin
              </Text>

            </TouchableOpacity>

          </View>

        </ScrollView>

      </KeyboardAvoidingView>

    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#1E78D8',
  },

  card: {
    backgroundColor:
      'rgba(255,255,255,0.96)',
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    elevation: 10,
    shadowColor: '#0A3A7A',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 8,
    },
  },

  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0B2A6B',
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 15,
    color: '#4B5563',
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
    borderColor: '#D9E2EF',
    backgroundColor: '#F8FAFD',
    paddingHorizontal: 14,
  },

  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    marginLeft: 12,
    paddingVertical: 0,
  },

  helper: {
    fontSize: 12,
    color: '#6B7280',
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
    backgroundColor: '#1660E0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkboxOff: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#B8C4D6',
  },

  rememberText: {
    fontSize: 15,
    color: '#222',
    marginLeft: 10,
  },

  forgot: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0A57D0',
  },

  loginBtn: {
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#0A57D0',
    shadowOpacity: 0.35,
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
    color: '#fff',
    fontSize: 19,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  helpBtn: {
    marginTop: 12,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#E8F1FC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  helpText: {
    fontSize: 15,
    color: '#0A57D0',
    marginLeft: 12,
  },
});
 