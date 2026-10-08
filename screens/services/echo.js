// screens/services/echo.js

import Echo from 'laravel-echo';
import Pusher from 'pusher-js/react-native';

// Reverb requires Pusher
global.Pusher = Pusher;

const REVERB_HOST = 'https://blackpathsoftwaresolutions.com';
const REVERB_PORT = 443;
const REVERB_APP_KEY = 'swzc1oohx2jmjrq9eftw';
 

const echo = new Echo({
  broadcaster: 'reverb',

  key: REVERB_APP_KEY,

  wsHost: REVERB_HOST,

  wsPort: REVERB_PORT,
  wssPort: REVERB_PORT,

  forceTLS: true,

  enabledTransports: ['ws', 'wss'],

  disableStats: true,
});

export default echo;