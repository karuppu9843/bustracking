// screens/DeliveryEntryScreen.js
import React, {useRef, useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Clipboard from '@react-native-clipboard/clipboard';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

// ---------- DATA (replace with your API values) ----------
const MILK_RATE = 50;
const CURD_RATE = 20;
const PREVIOUS_OUTSTANDING = 250;
const TOTAL_SHOPS = 14;
const UPI_ID = 'krishna@okaxis';
const PAYEE = 'KRISHNA ENTERPRISES';

const DEFAULT_SHOP = {
  id: 1,
  name: 'Sri Murugan Stores',
  area: 'Anna Nagar, Coimbatore',
  milk: 10,
  curd: 5,
  km: '1.2',
};

const Txt = props => <Text allowFontScaling={false} {...props} />;
const money = n => `₹${Number(n || 0).toFixed(2)}`;

export default function DeliveryEntryScreen({navigation, route}) {
  const {width} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const k = Math.min(width / 411, 1.3);
  const d = n => n * k;

  const shop = route?.params?.shop || DEFAULT_SHOP;
  const shopCode = `S${String(shop.id).padStart(3, '0')}`;

  const [milkDel, setMilkDel] = useState(String(shop.milk));
  const [curdDel, setCurdDel] = useState(String(shop.curd));
  const [method, setMethod] = useState('UPI');
  const [upiApp, setUpiApp] = useState('GPay');
  const [remarks, setRemarks] = useState('');

  const milkQty = Number(milkDel) || 0;
  const curdQty = Number(curdDel) || 0;
  const milkAmt = milkQty * MILK_RATE;
  const curdAmt = curdQty * CURD_RATE;
  const todayAmt = milkAmt + curdAmt;
  const payable = PREVIOUS_OUTSTANDING + todayAmt;

  const [received, setReceived] = useState(String(payable));
  const edited = useRef(false);
  useEffect(() => {
    if (!edited.current) setReceived(String(payable));
  }, [payable]);

  const balance = Math.max(payable - (Number(received) || 0), 0);

  const step = (val, setVal, delta) => {
    const n = Math.max((Number(val) || 0) + delta, 0);
    setVal(String(n));
  };

  const onDelivered = () => {
    // TODO: call your API here with milkQty, curdQty, received, method, remarks
    Alert.alert('Delivered', `${shop.name} marked as delivered.`, [
      {text: 'OK', onPress: () => navigation?.goBack()},
    ]);
  };
  const onSaveNext = () => {
    // TODO: save entry via API, then open next shop
    navigation?.goBack();
  };
  const copyUpi = () => {
    Clipboard.setString(UPI_ID);
    Alert.alert('Copied', UPI_ID);
  };

  const cardStyle = {
    backgroundColor: '#fff',
    borderRadius: d(16),
    padding: d(14),
    marginHorizontal: d(12),
    marginTop: d(12),
    elevation: 2,
    shadowColor: '#1B3A6B',
    shadowOpacity: 0.07,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 2},
  };

  const CardTitle = ({icon, title, right}) => (
    <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: d(12)}}>
      <View
        style={{
          width: d(28),
          height: d(28),
          borderRadius: d(7),
          backgroundColor: '#1660E0',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={icon} size={d(18)} color="#fff" />
      </View>
      <Txt style={{fontSize: d(18), fontWeight: '800', color: '#0B2A6B', marginLeft: d(10), flex: 1}}>
        {title}
      </Txt>
      {right}
    </View>
  );

  const Stepper = ({value, setValue}) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: d(44),
        borderRadius: d(10),
        backgroundColor: '#E3EEFB',
        overflow: 'hidden',
      }}>
      <TouchableOpacity
        onPress={() => step(value, setValue, -1)}
        style={{width: d(34), height: '100%', alignItems: 'center', justifyContent: 'center'}}>
        <Icon name="minus" size={d(22)} color="#1660E0" />
      </TouchableOpacity>
      <TextInput
        value={value}
        onChangeText={t => setValue(t.replace(/[^0-9]/g, ''))}
        keyboardType="numeric"
        style={{
          width: d(56),
          height: d(38),
          backgroundColor: '#fff',
          borderRadius: d(8),
          textAlign: 'center',
          fontSize: d(16),
          fontWeight: '600',
          color: '#111827',
          paddingVertical: 0,
        }}
      />
      <TouchableOpacity
        onPress={() => step(value, setValue, 1)}
        style={{width: d(34), height: '100%', alignItems: 'center', justifyContent: 'center'}}>
        <Icon name="plus" size={d(22)} color="#1660E0" />
      </TouchableOpacity>
    </View>
  );

  const ProductRow = ({icon, iconColor, iconBg, name, rate, unit, ordered, value, setValue}) => (
    <View style={{flexDirection: 'row', alignItems: 'center', paddingVertical: d(8)}}>
      <View
        style={{
          width: d(50),
          height: d(50),
          borderRadius: d(25),
          backgroundColor: iconBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={icon} size={d(30)} color={iconColor} />
      </View>
      <View style={{marginLeft: d(10), width: d(70)}}>
        <Txt style={{fontSize: d(16), fontWeight: '800', color: '#0F172A'}}>{name}</Txt>
        <Txt style={{fontSize: d(12.5), color: '#4B5563'}}>
          ₹{rate} / {unit}
        </Txt>
      </View>
      <View style={{marginLeft: d(8)}}>
        <Txt style={{fontSize: d(11.5), color: '#4B5563', marginBottom: d(4)}}>Ordered ({unit})</Txt>
        <View
          style={{
            width: d(62),
            height: d(44),
            borderRadius: d(10),
            backgroundColor: '#F1F4F8',
            borderWidth: 1,
            borderColor: '#E1E7EF',
            justifyContent: 'center',
            paddingHorizontal: d(10),
          }}>
          <Txt style={{fontSize: d(16), color: '#111827'}}>{ordered}</Txt>
        </View>
      </View>
      <View style={{marginLeft: d(8)}}>
        <Txt style={{fontSize: d(11.5), color: '#4B5563', marginBottom: d(4)}}>Delivered ({unit})</Txt>
        <Stepper value={value} setValue={setValue} />
      </View>
    </View>
  );

  const AmountLine = ({title, sub, amount}) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: d(9),
        borderBottomWidth: 1,
        borderBottomColor: '#EDF1F6',
      }}>
      <View>
        <Txt style={{fontSize: d(15), fontWeight: '700', color: '#111827'}}>{title}</Txt>
        <Txt style={{fontSize: d(12.5), color: '#4B5563'}}>{sub}</Txt>
      </View>
      <Txt style={{fontSize: d(16), fontWeight: '800', color: '#0F172A'}}>{amount}</Txt>
    </View>
  );

  const Band = ({label, value, bg, color, big}) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: bg,
        borderRadius: d(10),
        paddingHorizontal: d(12),
        height: d(big ? 46 : 42),
        marginTop: d(8),
      }}>
      <Txt style={{fontSize: d(big ? 16 : 15), fontWeight: '800', color}}>{label}</Txt>
      <Txt style={{fontSize: d(big ? 19 : 17), fontWeight: '800', color}}>{value}</Txt>
    </View>
  );

  const methods = [
    {k: 'UPI', icon: 'qrcode-scan', color: '#F97316'},
    {k: 'Cash', icon: 'cash-multiple', color: '#16A34A'},
    {k: 'Others', icon: 'dots-horizontal-circle', color: '#4B5563'},
  ];

  const upiApps = [
    {k: 'GPay', node: <Icon name="google" size={d(26)} color="#4285F4" />},
    {
      k: 'PhonePe',
      node: (
        <View
          style={{
            width: d(38),
            height: d(38),
            borderRadius: d(19),
            backgroundColor: '#5F259F',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Txt style={{color: '#fff', fontSize: d(18), fontWeight: '800'}}>पे</Txt>
        </View>
      ),
    },
    {k: 'Paytm', node: <Txt style={{fontSize: d(13), fontWeight: '900', color: '#00B9F1'}}>Paytm</Txt>},
    {k: 'Other UPI', node: <Icon name="dots-horizontal" size={d(26)} color="#4B5563" />},
  ];

  return (
    <View style={{flex: 1, backgroundColor: '#0A47B0'}}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* ============ HEADER ============ */}
      <LinearGradient
        colors={['#0B55C8', '#0A3C9C']}
        style={{paddingTop: insets.top + d(10), paddingBottom: d(26), paddingHorizontal: d(14)}}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <TouchableOpacity onPress={() => navigation?.goBack()} style={{paddingRight: d(12)}}>
            <Icon name="arrow-left" size={d(28)} color="#fff" />
          </TouchableOpacity>
          <View style={{flex: 1}}>
            <Txt style={{fontSize: d(20), fontWeight: '800', color: '#fff'}} numberOfLines={1}>
              {shop.name}
            </Txt>
            <View style={{flexDirection: 'row', alignItems: 'center', marginTop: d(2)}}>
              <Icon name="map-marker" size={d(15)} color="#fff" />
              <Txt style={{fontSize: d(13), color: '#E6EEFF', marginLeft: d(4)}} numberOfLines={1}>
                {shop.area}
              </Txt>
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {}}
            style={{
              height: d(38),
              paddingHorizontal: d(12),
              borderRadius: d(10),
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.8)',
              flexDirection: 'row',
              alignItems: 'center',
            }}>
            <Icon name="map-marker" size={d(20)} color="#fff" />
            <Txt style={{fontSize: d(13.5), fontWeight: '600', color: '#fff', marginLeft: d(6)}}>
              Navigate
            </Txt>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ============ BODY ============ */}
      <KeyboardAvoidingView
        style={{
          flex: 1,
          marginTop: d(-16),
          backgroundColor: '#F4F8FD',
          borderTopLeftRadius: d(22),
          borderTopRightRadius: d(22),
          overflow: 'hidden',
        }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingBottom: d(100) + insets.bottom}}>
          {/* ---- Shop card ---- */}
          <View style={[cardStyle, {flexDirection: 'row', alignItems: 'center'}]}>
            <View
              style={{
                width: d(70),
                height: d(70),
                borderRadius: d(35),
                backgroundColor: '#FBEDE6',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name="storefront" size={d(44)} color="#E23B2E" />
            </View>
            <View style={{flex: 1, marginLeft: d(12)}}>
              <Txt style={{fontSize: d(18), fontWeight: '800', color: '#0B2A6B'}} numberOfLines={1}>
                {shop.name}
              </Txt>
              <Txt style={{fontSize: d(13), color: '#4B5563', marginTop: d(2)}}>
                Shop ID: {shopCode}  |  Route 1 ({shop.id}/{TOTAL_SHOPS})
              </Txt>
              <View style={{flexDirection: 'row', alignItems: 'center', marginTop: d(3)}}>
                <Icon name="map-marker" size={d(15)} color="#6B7280" />
                <Txt style={{fontSize: d(13), color: '#4B5563', marginLeft: d(4)}} numberOfLines={1}>
                  {shop.area}
                </Txt>
              </View>
            </View>
            <View
              style={{
                backgroundColor: '#E8F1FC',
                borderRadius: d(12),
                padding: d(8),
                alignItems: 'center',
                marginLeft: d(8),
              }}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Icon name="map-marker" size={d(20)} color="#1660E0" />
                <Txt style={{fontSize: d(16), fontWeight: '800', color: '#0B2A6B', marginLeft: d(3)}}>
                  {shop.km} km
                </Txt>
              </View>
              <TouchableOpacity
                onPress={() => {}}
                style={{
                  marginTop: d(6),
                  paddingHorizontal: d(10),
                  height: d(28),
                  borderRadius: d(8),
                  backgroundColor: '#fff',
                  borderWidth: 1,
                  borderColor: '#1660E0',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Txt style={{fontSize: d(12), fontWeight: '600', color: '#1660E0'}}>View on Map</Txt>
              </TouchableOpacity>
            </View>
          </View>

          {/* ---- Delivery entry ---- */}
          <View style={cardStyle}>
            <CardTitle icon="tune-variant" title="Delivery Entry" />
            <View
              style={{
                backgroundColor: '#E8F1FC',
                borderRadius: d(10),
                paddingVertical: d(7),
                paddingHorizontal: d(12),
                marginBottom: d(6),
              }}>
              <Txt style={{fontSize: d(13), fontWeight: '700', color: '#1660E0'}}>
                Today's Plan:  Milk {shop.milk} Ltr  |  Curd {shop.curd} Cup
              </Txt>
            </View>

            <ProductRow
              icon="bottle-tonic-outline"
              iconColor="#1B78F0"
              iconBg="#E5F0FE"
              name="Milk"
              rate={MILK_RATE}
              unit="Ltr"
              ordered={shop.milk}
              value={milkDel}
              setValue={setMilkDel}
            />
            <View style={{height: 1, backgroundColor: '#EDF1F6'}} />
            <ProductRow
              icon="bowl-mix"
              iconColor="#16A34A"
              iconBg="#E3F5E7"
              name="Curd"
              rate={CURD_RATE}
              unit="Cup"
              ordered={shop.curd}
              value={curdDel}
              setValue={setCurdDel}
            />
          </View>

          {/* ---- Amount details ---- */}
          <View style={cardStyle}>
            <CardTitle icon="calculator-variant" title="Amount Details" />
            <AmountLine title="Milk Amount" sub={`${milkQty} Ltr × ₹${MILK_RATE}`} amount={money(milkAmt)} />
            <AmountLine title="Curd Amount" sub={`${curdQty} Cup × ₹${CURD_RATE}`} amount={money(curdAmt)} />
            <Band label="Total Amount" value={money(todayAmt)} bg="#E3EEFB" color="#0B2A6B" />

            <View style={{height: d(12)}} />
            <View style={{backgroundColor: '#F3F5F9', borderRadius: d(10), padding: d(10)}}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                <Txt style={{fontSize: d(13.5), color: '#4B5563'}}>Previous Outstanding</Txt>
                <Txt style={{fontSize: d(14), fontWeight: '800', color: '#111827'}}>
                  {money(PREVIOUS_OUTSTANDING)}
                </Txt>
              </View>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: d(6)}}>
                <Txt style={{fontSize: d(13.5), color: '#4B5563'}}>Today's Amount</Txt>
                <Txt style={{fontSize: d(14), fontWeight: '800', color: '#111827'}}>{money(todayAmt)}</Txt>
              </View>
            </View>
            <Band label="Total Payable" value={money(payable)} bg="#FDE3E3" color="#DC2626" big />

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: d(10),
              }}>
              <Txt style={{fontSize: d(14), color: '#374151'}}>Amount Received</Txt>
              <View
                style={{
                  width: d(130),
                  height: d(44),
                  borderRadius: d(10),
                  borderWidth: 1,
                  borderColor: '#D5DDE8',
                  backgroundColor: '#fff',
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: d(10),
                }}>
                <Txt style={{fontSize: d(16), color: '#111827'}}>₹</Txt>
                <TextInput
                  value={received}
                  onChangeText={t => {
                    edited.current = true;
                    setReceived(t.replace(/[^0-9.]/g, ''));
                  }}
                  keyboardType="numeric"
                  style={{flex: 1, fontSize: d(16), color: '#111827', paddingVertical: 0, marginLeft: d(4)}}
                />
              </View>
            </View>
            <Band label="Balance Amount" value={money(balance)} bg="#DFF4E4" color="#15803D" big />
          </View>

          {/* ---- Payment method ---- */}
          <View style={cardStyle}>
            <CardTitle icon="currency-inr" title="Payment Method" />
            <View style={{flexDirection: 'row'}}>
              {methods.map((m, i) => {
                const active = method === m.k;
                return (
                  <TouchableOpacity
                    key={m.k}
                    activeOpacity={0.85}
                    onPress={() => setMethod(m.k)}
                    style={{
                      flex: 1,
                      height: d(46),
                      borderRadius: d(10),
                      borderWidth: active ? 1.5 : 1,
                      borderColor: active ? '#1660E0' : '#DDE5F0',
                      backgroundColor: active ? '#EEF5FF' : '#fff',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: i === 0 ? 0 : d(8),
                    }}>
                    <Icon name={m.icon} size={d(22)} color={m.color} />
                    <Txt
                      style={{
                        fontSize: d(14.5),
                        fontWeight: active ? '700' : '500',
                        color: active ? '#1660E0' : '#111827',
                        marginLeft: d(6),
                      }}>
                      {m.k}
                    </Txt>
                  </TouchableOpacity>
                );
              })}
            </View>

            {method === 'UPI' && (
              <View>
                <Txt style={{fontSize: d(16), fontWeight: '800', color: '#0B2A6B', marginTop: d(14)}}>
                  UPI Payment
                </Txt>
                <View style={{flexDirection: 'row', marginTop: d(10)}}>
                  {upiApps.map(a => {
                    const active = upiApp === a.k;
                    return (
                      <TouchableOpacity
                        key={a.k}
                        activeOpacity={0.85}
                        onPress={() => setUpiApp(a.k)}
                        style={{flex: 1, alignItems: 'center'}}>
                        <View
                          style={{
                            width: d(58),
                            height: d(58),
                            borderRadius: d(14),
                            borderWidth: active ? 1.5 : 1,
                            borderColor: active ? '#1660E0' : '#E1E7EF',
                            backgroundColor: '#fff',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                          {a.node}
                        </View>
                        <Txt style={{fontSize: d(12), color: '#374151', marginTop: d(5)}}>{a.k}</Txt>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Scan & pay */}
                <View
                  style={{
                    marginTop: d(14),
                    backgroundColor: '#E9F7EE',
                    borderRadius: d(14),
                    padding: d(12),
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}>
                  <View style={{backgroundColor: '#fff', borderRadius: d(10), padding: d(8)}}>
                    <Image
                      source={require('../assets/qr.png')}
                      style={{width: d(112), height: d(112)}}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={{flex: 1, marginLeft: d(14)}}>
                    <Txt style={{fontSize: d(16), fontWeight: '800', color: '#0F172A'}}>Scan & Pay</Txt>
                    <Txt style={{fontSize: d(13.5), fontWeight: '800', color: '#0B2A6B', marginTop: d(6)}}>
                      {PAYEE}
                    </Txt>
                    <TouchableOpacity
                      onPress={copyUpi}
                      style={{flexDirection: 'row', alignItems: 'center', marginTop: d(6)}}>
                      <Txt style={{fontSize: d(13), color: '#374151', flexShrink: 1}}>UPI ID: {UPI_ID}</Txt>
                      <Icon name="content-copy" size={d(18)} color="#1660E0" style={{marginLeft: d(6)}} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* ---- Remarks ---- */}
          <View style={cardStyle}>
            <CardTitle icon="note-text-outline" title="Remarks (Optional)" />
            <TextInput
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Add any note about this delivery..."
              placeholderTextColor="#9CA3AF"
              multiline
              style={{
                minHeight: d(70),
                borderRadius: d(10),
                borderWidth: 1,
                borderColor: '#DDE5F0',
                paddingHorizontal: d(12),
                paddingTop: d(10),
                fontSize: d(14.5),
                color: '#111827',
                textAlignVertical: 'top',
              }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ============ BOTTOM ACTIONS ============ */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#fff',
          flexDirection: 'row',
          paddingHorizontal: d(12),
          paddingTop: d(10),
          paddingBottom: insets.bottom + d(10),
          elevation: 16,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: {width: 0, height: -4},
        }}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onSaveNext}
          style={{
            flex: 1,
            height: d(50),
            borderRadius: d(12),
            backgroundColor: '#E3EEFB',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: d(10),
          }}>
          <Icon name="chevron-right" size={d(24)} color="#1660E0" />
          <Txt style={{fontSize: d(13.5), fontWeight: '800', color: '#1660E0', marginLeft: d(4)}}>
            SAVE & NEXT SHOP
          </Txt>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onDelivered}
          style={{
            flex: 1,
            height: d(50),
            borderRadius: d(12),
            backgroundColor: '#15803D',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="check" size={d(24)} color="#fff" />
          <Txt style={{fontSize: d(13.5), fontWeight: '800', color: '#fff', marginLeft: d(6)}}>
            MARK AS DELIVERED
          </Txt>
        </TouchableOpacity>
      </View>
    </View>
  );
}