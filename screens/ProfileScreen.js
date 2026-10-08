// screens/ProfileScreen.js
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

// ---------- DATA (replace with your API values) ----------
const USER = {
  name: 'Krishna',
  role: 'Delivery Executive',
  id: 'EMP-0142',
  phone: '+91 98765 43210',
  vehicle: 'TN 38 AB 1234',
  route: 'Route 1 - Anna Nagar Area',
};

const TODAY = {delivered: 8, total: 14, collected: 4250};

const Txt = props => <Text allowFontScaling={false} {...props} />;
const money = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function ProfileScreen({navigation}) {
  const {width} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const k = Math.min(width / 411, 1.3);
  const d = n => n * k;

  const initials = USER.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const cardStyle = {
    backgroundColor: '#fff',
    borderRadius: d(16),
    marginHorizontal: d(12),
    marginTop: d(12),
    elevation: 2,
    shadowColor: '#1B3A6B',
    shadowOpacity: 0.07,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 2},
  };

  const infoRows = [
    {icon: 'card-account-details-outline', label: 'Employee ID', value: USER.id},
    {icon: 'phone-outline', label: 'Phone', value: USER.phone},
    {icon: 'truck-delivery-outline', label: 'Vehicle No.', value: USER.vehicle},
    {icon: 'map-marker-path', label: 'Assigned Route', value: USER.route},
  ];

  const menu = [
    {icon: 'map-marker-multiple-outline', label: 'My Routes', color: '#1660E0', bg: '#E3EEFB', onPress: () => {}},
    {icon: 'history', label: 'Delivery History', color: '#16A34A', bg: '#E3F5E7', onPress: () => {}},
    {icon: 'cash-multiple', label: 'Collection Summary', color: '#F59E0B', bg: '#FDF0DF', onPress: () => {}},
    {icon: 'translate', label: 'Language', color: '#7C3AED', bg: '#F0E9FB', onPress: () => {}},
    {icon: 'help-circle-outline', label: 'Help & Support', color: '#0D9488', bg: '#E3F3F2', onPress: () => {}},
  ];

  const logout = () =>
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          // TODO: clear token / session here
          navigation?.reset?.({index: 0, routes: [{name: 'Login'}]});
        },
      },
    ]);

  const percent = Math.round((TODAY.delivered / TODAY.total) * 100);

  return (
    <View style={{flex: 1, backgroundColor: '#0A47B0'}}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* ============ HEADER ============ */}
      <LinearGradient
        colors={['#0B55C8', '#0A3C9C']}
        start={{x: 0.5, y: 0}}
        end={{x: 0.5, y: 1}}
        style={{paddingTop: insets.top + d(10), paddingBottom: d(34), paddingHorizontal: d(14)}}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <TouchableOpacity onPress={() => navigation?.goBack()} style={{paddingRight: d(12)}}>
            <Icon name="arrow-left" size={d(28)} color="#fff" />
          </TouchableOpacity>
          <Txt style={{fontSize: d(20), fontWeight: '800', color: '#fff', flex: 1}}>My Profile</Txt>
        </View>

        <View style={{flexDirection: 'row', alignItems: 'center', marginTop: d(16)}}>
          <View
            style={{
              width: d(72),
              height: d(72),
              borderRadius: d(36),
              backgroundColor: 'rgba(255,255,255,0.18)',
              borderWidth: 2,
              borderColor: 'rgba(255,255,255,0.7)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Txt style={{fontSize: d(26), fontWeight: '800', color: '#fff'}}>{initials}</Txt>
          </View>
          <View style={{flex: 1, marginLeft: d(14)}}>
            <Txt style={{fontSize: d(21), fontWeight: '800', color: '#fff'}} numberOfLines={1}>
              {USER.name}
            </Txt>
            <Txt style={{fontSize: d(13.5), color: '#E6EEFF', marginTop: d(2)}}>{USER.role}</Txt>
          </View>
        </View>
      </LinearGradient>

      {/* ============ BODY ============ */}
      <View
        style={{
          flex: 1,
          marginTop: d(-16),
          backgroundColor: '#F4F8FD',
          borderTopLeftRadius: d(22),
          borderTopRightRadius: d(22),
          overflow: 'hidden',
        }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingBottom: insets.bottom + d(24)}}>
          {/* today's summary */}
          <View style={[cardStyle, {padding: d(14)}]}>
            <Txt style={{fontSize: d(16), fontWeight: '800', color: '#0B2A6B'}}>Today's Summary</Txt>
            <View style={{flexDirection: 'row', marginTop: d(12)}}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: '#DFF4E4',
                  borderRadius: d(12),
                  padding: d(10),
                  marginRight: d(8),
                }}>
                <Txt style={{fontSize: d(12), color: '#374151'}}>Delivered</Txt>
                <Txt style={{fontSize: d(20), fontWeight: '800', color: '#15803D', marginTop: d(2)}}>
                  {TODAY.delivered} / {TODAY.total}
                </Txt>
              </View>
              <View style={{flex: 1, backgroundColor: '#E3EEFB', borderRadius: d(12), padding: d(10)}}>
                <Txt style={{fontSize: d(12), color: '#374151'}}>Collected</Txt>
                <Txt style={{fontSize: d(20), fontWeight: '800', color: '#0B2A6B', marginTop: d(2)}}>
                  {money(TODAY.collected)}
                </Txt>
              </View>
            </View>
            <View
              style={{
                height: d(9),
                borderRadius: d(5),
                backgroundColor: '#DDE2E9',
                overflow: 'hidden',
                marginTop: d(12),
              }}>
              <View style={{width: `${percent}%`, height: '100%', backgroundColor: '#16A34A'}} />
            </View>
            <Txt style={{fontSize: d(12), color: '#4B5563', marginTop: d(6)}}>{percent}% of route completed</Txt>
          </View>

          {/* info */}
          <View style={[cardStyle, {paddingHorizontal: d(14), paddingVertical: d(6)}]}>
            {infoRows.map((r, i) => (
              <View
                key={r.label}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: d(11),
                  borderBottomWidth: i === infoRows.length - 1 ? 0 : 1,
                  borderBottomColor: '#EDF1F6',
                }}>
                <Icon name={r.icon} size={d(22)} color="#1660E0" />
                <View style={{marginLeft: d(12), flex: 1}}>
                  <Txt style={{fontSize: d(12), color: '#6B7280'}}>{r.label}</Txt>
                  <Txt style={{fontSize: d(14.5), fontWeight: '700', color: '#0F172A', marginTop: d(1)}}>
                    {r.value}
                  </Txt>
                </View>
              </View>
            ))}
          </View>

          {/* menu */}
          <View style={[cardStyle, {paddingHorizontal: d(14), paddingVertical: d(6)}]}>
            {menu.map((m, i) => (
              <TouchableOpacity
                key={m.label}
                activeOpacity={0.7}
                onPress={m.onPress}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: d(11),
                  borderBottomWidth: i === menu.length - 1 ? 0 : 1,
                  borderBottomColor: '#EDF1F6',
                }}>
                <View
                  style={{
                    width: d(38),
                    height: d(38),
                    borderRadius: d(10),
                    backgroundColor: m.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Icon name={m.icon} size={d(22)} color={m.color} />
                </View>
                <Txt style={{flex: 1, fontSize: d(15), fontWeight: '600', color: '#111827', marginLeft: d(12)}}>
                  {m.label}
                </Txt>
                <Icon name="chevron-right" size={d(24)} color="#4B5563" />
              </TouchableOpacity>
            ))}
          </View>

          {/* logout */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={logout}
            style={{
              marginHorizontal: d(12),
              marginTop: d(16),
              height: d(50),
              borderRadius: d(12),
              backgroundColor: '#FDE3E3',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon name="logout" size={d(22)} color="#DC2626" />
            <Txt style={{fontSize: d(15), fontWeight: '800', color: '#DC2626', marginLeft: d(8)}}>Logout</Txt>
          </TouchableOpacity>

          <Txt style={{textAlign: 'center', fontSize: d(12), color: '#9CA3AF', marginTop: d(14)}}>
            App version 1.0.0
          </Txt>
        </ScrollView>
      </View>
    </View>
  );
}