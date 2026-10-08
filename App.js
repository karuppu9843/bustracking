// App.js
import React from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import SplashScreen from './screens/SplashScreen';
import DriverLoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import ParentsHome from './screens/ParentsHome';
import ParentTracking from './screens/ParentTracking';
import RouteMapScreen from './screens/RouteMapScreen';
import DailyTripScreen from './screens/DailyTripScreen';
import ShopScreen from './screens/ShopScreen';
import DeliveryScreen from './screens/Delivery';
import ProfileScreen from './screens/ProfileScreen';
import OwnerLiveTracking from './screens/OwnerLiveTracking';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{headerShown: false}}>
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Login" component={DriverLoginScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
           <Stack.Screen name="ParentsHome" component={ParentsHome} />
            <Stack.Screen name="ParentTracking" component={ParentTracking} />
            <Stack.Screen name="RouteMapScreen" component={RouteMapScreen} />
             <Stack.Screen name="DailyTripScreen" component={DailyTripScreen} />
          <Stack.Screen name="Shop" component={ShopScreen} />
           <Stack.Screen name="Delivery" component={DeliveryScreen} />
           <Stack.Screen name="OwnerLiveTracking" component={OwnerLiveTracking} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
              
          {/* Add more screens here, e.g. Home, ForgotPassword */}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}