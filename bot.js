// Requires
var irc = require('irc');

var ircServer = 'irc.mozilla.org',
    nick = '_TestDayBot',
    options = {channels: ['#testday'],autoRejoin: true,},
    client = new irc.Client(ircServer, nick, options),
    lastQuit = {},
    etherpad = 'https://etherpad.mozilla.org/testday-111202-webapps';

client.addListener('join', function(channel, who){
  if (who !== nick){
    var lastMessageTime = Date.now() - lastQuit[who];

    if (lastQuit[who] && lastMessageTime < 1800000){

    } else {
      console.log("Greeted " + who);
      client.say(channel, "Welcome to the Test Day " + who + "! Details of the Test Day can be found at " + etherpad);
    }
  }
});

client.addListener('message', function(from, to, message){
  if (message.search('[!:]bug') >= 0){
    client.say(to, "You can find details on how to raise a bug at https://developer.mozilla.org/en/Bug_writing_guidelines");
  }

  if (message.search('[!:]etherpad') >= 0){
    client.say(to, "Today's etherpad is " + etherpad);
  }
  if (message.search('[!:]sumo') >= 0){
    client.say(to, "SUMO is short for http://support.mozilla.com, the official, community-powered support website for Mozilla Firefox");
  }
  if (message.search('[!:]qmo') >= 0){
    client.say(to, "QMO is short for http://quality.mozilla.org, the official destination for everything related with Mozilla QA");
  }
});

client.addListener('quit', function(who, reason, channel){
  lastQuit[who] = Date.now();
});

client.addListener('part', function(channel, who, reason){
  lastQuit[who] = Date.now();
});

client.addListener('error', function(message){
  console.error(message);
});
