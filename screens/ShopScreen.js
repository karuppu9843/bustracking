// screens/ShopListScreen.js
import React, {useMemo, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

// ---------- DATA (replace with your API values) ----------
const ROUTE = {name: 'Route 1', area: 'Anna Nagar Area', shops: 14};

const SUMMARY = {total: 14, delivered: 8, pending: 6, notVisited: 0, milk: 120, curd: 60};

const SHOPS = [
  {id: 1, name: 'Sri Murugan Stores', area: 'Anna Nagar, Coimbatore', milk: 10, curd: 5, km: '1.2', status: 'Delivered', color: '#E23B2E', bg: '#FBEDE6'},
  {id: 2, name: 'Kumar Stores', area: 'R.S. Puram, Coimbatore', milk: 8, curd: 3, km: '2.5', status: 'Pending', color: '#4B5563', bg: '#EDEFF3'},
  {id: 3, name: 'Anand Supermarket', area: 'Saidapet, Coimbatore', milk: 12, curd: 5, km: '3.1', status: 'Pending', color: '#EF4444', bg: '#FBE9E9'},
  {id: 4, name: 'Siva Tea Stall', area: 'Gandhipuram, Coimbatore', milk: 10, curd: 4, km: '4.2', status: 'Delivered', color: '#16A34A', bg: '#E8F5EC'},
  {id: 5, name: 'ABC Bakery', area: 'Peelamedu, Coimbatore', milk: 8, curd: 3, km: '5.0', status: 'Not Visited', color: '#F59E0B', bg: '#FDF0DF'},
  {id: 6, name: 'Ilavarathukadai Stores', area: 'Singanallur, Coimbatore', milk: 15, curd: 6, km: '5.6', status: 'Pending', color: '#7C4A2D', bg: '#F3EBE5'},
  {id: 7, name: 'Krishna Stores', area: 'Kuniamuthur, Coimbatore', milk: 10, curd: 4, km: '6.1', status: 'Not Visited', color: '#7C3AED', bg: '#F0E9FB'},
  {id: 8, name: 'Lakshmi Stores', area: 'Ramanathapuram, Coimbatore', milk: 12, curd: 5, km: '6.8', status: 'Delivered', color: '#0D9488', bg: '#E3F3F2'},
];

const STATUS = {
  Delivered: {pillBg: '#DDF3E3', pillText: '#15803D', badge: '#16A34A', icon: 'check', iconBg: '#16A34A', btn: 'View Details'},
  Pending: {pillBg: '#FDE7D6', pillText: '#EA7A0C', badge: '#F59E0B', icon: 'clock-outline', iconBg: '#F59E0B', btn: 'Start Delivery'},
  'Not Visited': {pillBg: '#E6EAF0', pillText: '#4B5563', badge: '#4B5563', icon: 'lock', iconBg: null, btn: 'Start Delivery'},
};

const Txt = props => <Text allowFontScaling={false} {...props} />;

export default function ShopListScreen({navigation}) {
  const {width} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const k = Math.min(width / 411, 1.3); // size unit: 1 = normal phone
  const d = n => n * k;

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('All');

  const percent = Math.round((SUMMARY.delivered / SUMMARY.total) * 100);

  // Go to Delivery screen (screen name must match your navigator)
  const openDelivery = shop =>
    navigation.navigate('Delivery', {
      shop,
      route: ROUTE,
      viewOnly: shop.status === 'Delivered',
    });

  const tabs = [
    {k: 'All', label: `All (${SUMMARY.total})`, bg: '#0B62E6', color: '#fff'},
    {k: 'Pending', label: `Pending (${SUMMARY.pending})`, bg: '#FDEBDD', color: '#E2401C'},
    {k: 'Delivered', label: `Delivered (${SUMMARY.delivered})`, bg: '#DCF3E2', color: '#166534'},
    {k: 'Not Visited', label: `Not Visited (${SUMMARY.notVisited})`, bg: '#E7EBF2', color: '#374151'},
  ];

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SHOPS.filter(sh => {
      const okTab = tab === 'All' || sh.status === tab;
      const okQ = !q || sh.name.toLowerCase().includes(q) || sh.area.toLowerCase().includes(q);
      return okTab && okQ;
    });
  }, [query, tab]);

  const cardShadow = {
    elevation: 2,
    shadowColor: '#1B3A6B',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 2},
  };

  const stats = [
    {v: SUMMARY.total, l: 'Total Shops', type: 'store'},
    {v: SUMMARY.delivered, l: 'Delivered', type: 'check'},
    {v: SUMMARY.pending, l: 'Pending', type: 'clock'},
    {v: `${SUMMARY.milk} Ltr`, l: "Today's Milk", type: 'milk'},
    {v: `${SUMMARY.curd} Cup`, l: "Today's Curd", type: 'curd'},
  ];

  const statIcon = type => {
    if (type === 'store') return <Icon name="storefront" size={d(32)} color="#F97316" />;
    if (type === 'milk') return <Icon name="bottle-tonic-outline" size={d(30)} color="#1B78F0" />;
    if (type === 'curd') return <Icon name="bowl-mix" size={d(32)} color="#16A34A" />;
    return (
      <View
        style={{
          width: d(34),
          height: d(34),
          borderRadius: d(17),
          backgroundColor: type === 'check' ? '#16A34A' : '#F59E0B',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={type === 'check' ? 'check' : 'clock-outline'} size={d(22)} color="#fff" />
      </View>
    );
  };

  const Header = (
    <View>
      {/* stats */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{paddingHorizontal: d(12), paddingVertical: d(6)}}>
        {stats.map(st => (
          <View
            key={st.l}
            style={[
              {
                minWidth: d(118),
                height: d(58),
                borderRadius: d(12),
                backgroundColor: '#fff',
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: d(10),
                marginRight: d(8),
              },
              cardShadow,
            ]}>
            {statIcon(st.type)}
            <View style={{marginLeft: d(8)}}>
              <Txt style={{fontSize: d(17), fontWeight: '800', color: '#0F172A'}}>{st.v}</Txt>
              <Txt style={{fontSize: d(11.5), color: '#4B5563'}}>{st.l}</Txt>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* search + filter */}
      <View style={{flexDirection: 'row', paddingHorizontal: d(12), marginTop: d(8)}}>
        <View
          style={{
            flex: 1,
            height: d(44),
            borderRadius: d(12),
            backgroundColor: '#fff',
            borderWidth: 1,
            borderColor: '#DDE5F0',
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: d(12),
          }}>
          <Icon name="magnify" size={d(24)} color="#374151" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search shop name, area..."
            placeholderTextColor="#6B7280"
            style={{flex: 1, fontSize: d(14.5), color: '#111827', paddingVertical: 0, marginLeft: d(8)}}
          />
          {!!query && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Icon name="close" size={d(22)} color="#374151" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {}}
          style={{
            height: d(44),
            paddingHorizontal: d(14),
            marginLeft: d(8),
            borderRadius: d(12),
            backgroundColor: '#fff',
            borderWidth: 1,
            borderColor: '#DDE5F0',
            flexDirection: 'row',
            alignItems: 'center',
          }}>
          <Icon name="filter-variant" size={d(22)} color="#1B6EF3" />
          <Txt style={{fontSize: d(14.5), fontWeight: '600', color: '#111827', marginLeft: d(6)}}>
            Filter
          </Txt>
        </TouchableOpacity>
      </View>

      {/* tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{paddingHorizontal: d(12), paddingVertical: d(10)}}>
        {tabs.map(t => {
          const active = tab === t.k;
          return (
            <TouchableOpacity
              key={t.k}
              activeOpacity={0.85}
              onPress={() => setTab(t.k)}
              style={{
                height: d(38),
                paddingHorizontal: d(16),
                borderRadius: d(10),
                backgroundColor: t.bg,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: d(8),
                borderWidth: active && t.k !== 'All' ? 1.5 : 0,
                borderColor: t.color,
              }}>
              <Txt style={{fontSize: d(14), fontWeight: '700', color: t.color}}>{t.label}</Txt>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderItem = ({item}) => {
    const st = STATUS[item.status];
    const isDone = item.status === 'Delivered';
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => openDelivery(item)}
        style={[
          {
            marginHorizontal: d(12),
            marginBottom: d(10),
            borderRadius: d(14),
            backgroundColor: '#fff',
            padding: d(12),
          },
          cardShadow,
        ]}>
        {/* top row */}
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <View
            style={{
              width: d(30),
              height: d(30),
              borderRadius: d(15),
              backgroundColor: st.badge,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Txt style={{fontSize: d(14), fontWeight: '700', color: '#fff'}}>{item.id}</Txt>
          </View>

          <View
            style={{
              width: d(50),
              height: d(50),
              borderRadius: d(25),
              backgroundColor: item.bg,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: d(10),
            }}>
            <Icon name="storefront" size={d(32)} color={item.color} />
          </View>

          <View style={{flex: 1, marginLeft: d(12)}}>
            <Txt style={{fontSize: d(16.5), fontWeight: '800', color: '#0B2A6B'}} numberOfLines={1}>
              {item.name}
            </Txt>
            <View style={{flexDirection: 'row', alignItems: 'center', marginTop: d(3)}}>
              <Icon name="map-marker" size={d(15)} color="#6B7280" />
              <Txt style={{fontSize: d(12.5), color: '#4B5563', marginLeft: d(4)}} numberOfLines={1}>
                {item.area}
              </Txt>
            </View>
            <View style={{flexDirection: 'row', alignItems: 'center', marginTop: d(5)}}>
              <Icon name="bottle-tonic-outline" size={d(18)} color="#1B78F0" />
              <Txt style={{fontSize: d(13.5), fontWeight: '600', color: '#111827', marginLeft: d(4)}}>
                {item.milk} Ltr
              </Txt>
              <Txt style={{fontSize: d(14), color: '#9CA3AF', marginHorizontal: d(8)}}>|</Txt>
              <Icon name="bowl-mix-outline" size={d(18)} color="#374151" />
              <Txt style={{fontSize: d(13.5), fontWeight: '600', color: '#111827', marginLeft: d(4)}}>
                {item.curd} Cup
              </Txt>
            </View>
          </View>

          <Icon name="chevron-right" size={d(24)} color="#4B5563" />
        </View>

        {/* bottom row */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: d(10),
          }}>
          <View
            style={{
              height: d(30),
              borderRadius: d(9),
              backgroundColor: st.pillBg,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: d(8),
            }}>
            {st.iconBg ? (
              <View
                style={{
                  width: d(20),
                  height: d(20),
                  borderRadius: d(10),
                  backgroundColor: st.iconBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon name={st.icon} size={d(14)} color="#fff" />
              </View>
            ) : (
              <Icon name={st.icon} size={d(20)} color="#1F2937" />
            )}
            <Txt style={{fontSize: d(12.5), fontWeight: '600', color: st.pillText, marginLeft: d(6)}}>
              {item.status}
            </Txt>
          </View>

          <View style={{flexDirection: 'row', alignItems: 'center', marginLeft: d(14)}}>
            <Icon name="map-marker" size={d(17)} color="#4B5563" />
            <Txt style={{fontSize: d(13), color: '#374151', marginLeft: d(3)}}>{item.km} km</Txt>
          </View>

          <View style={{flex: 1}} />

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => openDelivery(item)}
            style={{
              height: d(34),
              paddingHorizontal: d(16),
              borderRadius: d(9),
              backgroundColor: isDone ? '#DCEAFB' : '#0B62E6',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Txt style={{fontSize: d(13.5), fontWeight: '700', color: isDone ? '#1462D6' : '#fff'}}>
              {st.btn}
            </Txt>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const bottomH = d(124) + insets.bottom;

  return (
    <View style={{flex: 1, backgroundColor: '#0A47B0'}}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* ============ BLUE HEADER ============ */}
      <LinearGradient
        colors={['#0B55C8', '#0A3C9C']}
        start={{x: 0.5, y: 0}}
        end={{x: 0.5, y: 1}}
        style={{paddingTop: insets.top + d(10), paddingBottom: d(26), paddingHorizontal: d(14)}}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <TouchableOpacity onPress={() => navigation?.goBack()} style={{paddingRight: d(12)}}>
            <Icon name="arrow-left" size={d(28)} color="#fff" />
          </TouchableOpacity>
          <View style={{flex: 1}}>
            <Txt style={{fontSize: d(20), fontWeight: '800', color: '#fff'}} numberOfLines={1}>
              {ROUTE.name} - Shop List
            </Txt>
            <Txt style={{fontSize: d(13), color: '#E6EEFF', marginTop: d(1)}} numberOfLines={1}>
              {ROUTE.area} • {ROUTE.shops} Shops
            </Txt>
          </View>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {}}
            style={{
              height: d(38),
              paddingHorizontal: d(12),
              borderRadius: d(10),
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.7)',
              backgroundColor: 'rgba(255,255,255,0.12)',
              flexDirection: 'row',
              alignItems: 'center',
            }}>
            <Icon name="map" size={d(20)} color="#fff" />
            <Txt style={{fontSize: d(13.5), fontWeight: '600', color: '#fff', marginLeft: d(6)}}>
              View Map
            </Txt>
          </TouchableOpacity>
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
          paddingTop: d(10),
          overflow: 'hidden',
        }}>
        <FlatList
          data={data}
          keyExtractor={i => String(i.id)}
          renderItem={renderItem}
          ListHeaderComponent={Header}
          ListEmptyComponent={
            <Txt style={{textAlign: 'center', marginTop: d(40), fontSize: d(15), color: '#6B7280'}}>
              No shops found
            </Txt>
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingBottom: bottomH + d(10)}}
        />
      </View>

      {/* ============ BOTTOM BAR ============ */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: bottomH,
          backgroundColor: '#fff',
          borderTopLeftRadius: d(20),
          borderTopRightRadius: d(20),
          paddingHorizontal: d(12),
          paddingTop: d(10),
          elevation: 16,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: {width: 0, height: -4},
        }}>
        {/* progress */}
        <View
          style={{
            height: d(52),
            borderRadius: d(12),
            backgroundColor: '#F4F8FD',
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: d(10),
          }}>
          <View
            style={{
              width: d(36),
              height: d(36),
              borderRadius: d(18),
              backgroundColor: '#E5F0FE',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon name="map-marker-radius" size={d(24)} color="#1B6EF3" />
          </View>
          <View style={{marginLeft: d(10)}}>
            <Txt style={{fontSize: d(12), color: '#374151'}}>Route Progress</Txt>
            <Txt style={{fontSize: d(17), fontWeight: '800', color: '#0F172A'}}>
              {SUMMARY.delivered} / {SUMMARY.total}
            </Txt>
          </View>
          <View
            style={{
              flex: 1,
              height: d(9),
              borderRadius: d(5),
              backgroundColor: '#DDE2E9',
              overflow: 'hidden',
              marginLeft: d(14),
            }}>
            <View style={{width: `${percent}%`, height: '100%', backgroundColor: '#16A34A'}} />
          </View>
          <Txt style={{fontSize: d(13), fontWeight: '700', color: '#111827', marginLeft: d(10)}}>
            {percent}%
          </Txt>
        </View>

        {/* buttons */}
        <View style={{flexDirection: 'row', marginTop: d(8)}}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {}}
            style={{
              flex: 1,
              height: d(42),
              borderRadius: d(12),
              backgroundColor: '#DFF4E4',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: d(8),
            }}>
            <Icon name="map" size={d(22)} color="#15803D" />
            <Txt style={{fontSize: d(14), fontWeight: '700', color: '#0F172A', marginLeft: d(8)}}>
              View Route Map
            </Txt>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {}}
            style={{
              flex: 1,
              height: d(42),
              borderRadius: d(12),
              backgroundColor: '#0B62E6',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon name="clipboard-text-outline" size={d(22)} color="#fff" />
            <Txt style={{fontSize: d(14), fontWeight: '700', color: '#fff', marginLeft: d(8)}}>
              Today's Summary
            </Txt>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}