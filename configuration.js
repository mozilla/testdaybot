var envs = require('envs');

module.exports = {
  host: envs('IRC_HOST', 'irc.mozilla.org'), // Host of IRC server to connect to
  port: envs('IRC_PORT', '6697'), // Port of IRC server to connect to
  nick: envs('IRC_NICKNAME', '_TestDayBot'), // IRC nick to use
  password: envs('IRC_PASSWORD', 'password'), // NickServ registered password
  channels: envs('IRC_CHANNELS', '#qa'), // comma separated list of IRC channels to join
  secure: envs('IRC_SECURE', 'true'), // use secure connection to IRC
  autoRejoin: envs('IRC_AUTO_REJOIN', 'true'), // auto rejoin if disconnected from IRC
  admins: envs('ADMINS', 'admin1,admin2'), // comma separated IRC nicks of default admins
  helpers: envs('HELPERS', 'helper1,helper2'), // comma separated IRC nicks of default helpers
  adChannels: envs('AD_CHANNELS', '#channel1,#channel2'),  // comma separated IRC channels to advertise in
  adMessage: envs('AD_MESSAGE', 'Mozilla QA is holding a Test Day today!'), // message to use when advertising the test day
}
