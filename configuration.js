var envs = require('envs');

module.exports = {
  host: envs('IRC_HOST', 'irc.mozilla.org'),
  port: envs('IRC_PORT', '6697'),
  nick: envs('IRC_NICKNAME', '_TestDayBot'),
  password: envs('IRC_PASSWORD', 'password'),
  channels: envs('IRC_CHANNELS', '#qa'),
  secure: envs('IRC_SECURE', 'true'),
  autoRejoin: envs('IRC_AUTO_REJOIN', 'true'),
  admins: envs('ADMINS', 'ashughes,whimboo'),
  helpers: envs('HELPERS', 'ashughes'),
  adChannels: envs('AD_CHANNELS', '#contributors,#developers,#interns,#introduction,#mozillians,#newbies,#seneca'),
  adMessage: envs('AD_MESSAGE', 'Mozilla QA is holding a Test Day today. Interested in participating? Please join us in #qa!'),
}
