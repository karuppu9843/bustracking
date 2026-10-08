import React, {useCallback, useState} from 'react';
import {
  View, Text, TouchableOpacity, SectionList, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useFocusEffect} from '@react-navigation/native';

const API_BASE_URL = 'https://blackpathsoftwaresolutions.com/api';

const C = {
  sandal: '#FFF6E0', yellow: '#FFC400', brown: '#3A2A00',
  muted: '#8A7650', green: '#16A34A', red: '#DC2626',
};

const fmtTime = s => {
  if (!s) return '';
  const t = new Date(String(s).replace(' ', 'T'));
  return isNaN(t) ? '' : t.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
};

export default function DailyTripScreen({navigation}) {
  const insets = useSafeAreaInsets();
  const [trips, setTrips] = useState([]);
  const [summary, setSummary] = useState({total: 0, picked: 0, missed: 0});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const id = await AsyncStorage.getItem('userId');
      const res = await fetch(`${API_BASE_URL}/driver/daily-trip?user_id=${id}`, {
        headers: {Accept: 'application/json'},
      });
      const data = await res.json();
      if (!res.ok || data?.status !== 'success') {
        throw new Error(data?.message || 'Could not load trip.');
      }
      setTrips(data.trips || []);
      setSummary(data.summary || {total: 0, picked: 0, missed: 0});
    } catch (e) {
      setError(e?.message || 'Check internet and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // screen open aagura bothu ellam refresh
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const sections = [
    {
      key: 'picked',
      title: 'Picked Today',
      color: C.green,
      data: trips.filter(t => t.status === 'picked'),
    },
    {
      key: 'missed',
      title: 'Missed Today',
      color: C.red,
      data: trips.filter(t => t.status === 'missed'),
    },
  ];

  const renderItem = ({item, section}) => (
    <View style={styles.row}>
      <View style={[styles.badge, {backgroundColor: section.color}]}>
        <Icon name={section.key === 'picked' ? 'check' : 'close'} size={20} color="#fff" />
      </View>
      <View style={{flex: 1, marginLeft: 12}}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.time}>{fmtTime(item.updated_at)}</Text>
      </View>
    </View>
  );

  const renderHeader = ({section}) => (
    <View style={styles.secHead}>
      <View style={[styles.dot, {backgroundColor: section.color}]} />
      <Text style={[styles.secTitle, {color: section.color}]}>
        {section.title} ({section.data.length})
      </Text>
    </View>
  );

  const renderFooter = ({section}) =>
    section.data.length === 0 ? (
      <Text style={styles.none}>
        {section.key === 'picked' ? 'Yarum pick up aagala' : 'Yarum miss aagala'}
      </Text>
    ) : null;

  return (
    <View style={{flex: 1, backgroundColor: C.sandal, paddingTop: insets.top + 10}}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Icon name="chevron-left" size={26} color={C.brown} />
        </TouchableOpacity>
        <Text style={styles.title}>Daily Trip</Text>
        <View style={{width: 44}} />
      </View>

      <View style={styles.summary}>
        <View style={styles.sBox}>
          <Text style={[styles.sNum, {color: C.brown}]}>{summary.total}</Text>
          <Text style={styles.sLbl}>Total</Text>
        </View>
        <View style={styles.sBox}>
          <Text style={[styles.sNum, {color: C.green}]}>{summary.picked}</Text>
          <Text style={styles.sLbl}>Picked</Text>
        </View>
        <View style={styles.sBox}>
          <Text style={[styles.sNum, {color: C.red}]}>{summary.missed}</Text>
          <Text style={styles.sLbl}>Missed</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{marginTop: 40}} color={C.yellow} />
      ) : error ? (
        <Text style={styles.empty}>{error}</Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={i => String(i.id)}
          renderItem={renderItem}
          renderSectionHeader={renderHeader}
          renderSectionFooter={renderFooter}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{padding: 16, paddingBottom: insets.bottom + 20}}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16},
  back: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', elevation: 4,
  },
  title: {flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: C.brown},
  summary: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 18,
    marginHorizontal: 16, marginTop: 14, paddingVertical: 14, elevation: 4,
  },
  sBox: {flex: 1, alignItems: 'center'},
  sNum: {fontSize: 24, fontWeight: '900'},
  sLbl: {fontSize: 11, color: C.muted},
  secHead: {flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 8},
  dot: {width: 10, height: 10, borderRadius: 5, marginRight: 8},
  secTitle: {fontSize: 15, fontWeight: '800'},
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 16, padding: 14, marginBottom: 10, elevation: 3,
  },
  badge: {width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center'},
  name: {fontSize: 16, fontWeight: '800', color: C.brown},
  time: {fontSize: 12, color: C.muted, marginTop: 2},
  none: {color: C.muted, fontSize: 13, marginBottom: 6, marginLeft: 4},
  empty: {textAlign: 'center', marginTop: 40, color: C.muted, fontSize: 14},
});